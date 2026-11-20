import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { JournalService, REPORT_REASONS, storyUrl } from './journal.service';
import { AuthGateModalComponent } from '../components/auth-gate-modal/auth-gate-modal.component';
import { ChoiceDialogComponent, ChoiceDialogData } from '../components/choice-dialog/choice-dialog.component';

/** The bits of a story the menu needs (a feed item or a full story both fit). */
export interface StoryRef {
  id: string;
  title: string;
  author?: { id: string; name: string } | null;
  visibility?: string | null;
  /** 'draft' for an unfinished story (its menu is just Edit and Delete). */
  status?: string | null;
}

/** What happened, so the page can update itself. */
export type StoryOutcome =
  | { type: 'deleted' }
  | { type: 'removed' }                          // not interested / reported: take it off screen
  | { type: 'blocked'; userId: string }          // hide everything by this person
  | { type: 'visibility'; visibility: 'public' | 'private' }
  | null;

/**
 * A story's ⋯ menu, the same as in the app:
 *  - your own: Edit story · Hide from / Show in Community · Share · Delete story
 *  - someone else's: Share · Not interested · Report story · Block <name>
 *    (the last three ask you to sign in first)
 */
@Injectable({ providedIn: 'root' })
export class StoryActionsService {
  constructor(
    private dialog: MatDialog,
    private journals: JournalService,
    private auth: AuthService,
    private toastr: ToastrService,
    private router: Router,
  ) {}

  isMine(story: StoryRef): boolean {
    const me = this.auth.currentUser?.id;
    return !!me && !!story.author?.id && story.author.id === me;
  }

  /** The ⋯ menu; with `anchor` (the ⋯ button) it opens right there instead of mid-screen. */
  async openMenu(story: StoryRef, anchor?: HTMLElement | null): Promise<StoryOutcome> {
    return this.isMine(story) ? this.ownMenu(story, anchor) : this.othersMenu(story, anchor);
  }

  /** Share sheet where there is one (phones), otherwise copy the link. */
  async share(story: StoryRef): Promise<void> {
    const url = storyUrl(story.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: story.title, text: `"${story.title}": a trip story on Wayraa`, url });
        return;
      }
    } catch {
      return;   // closing the share sheet isn't an error
    }
    try {
      await navigator.clipboard.writeText(url);
      this.toastr.success('Link copied');
    } catch {
      this.toastr.error('Couldn\'t copy the link');
    }
  }

  /** Block someone, after a confirmation. True once they're blocked. */
  async confirmBlock(person: { id: string; name: string }): Promise<boolean> {
    if (!(await this.signedIn())) return false;
    const ok = await this.choose({
      title: `Block ${person.name}?`,
      message: 'You won\'t see their stories or comments. They won\'t be told. You can unblock them any time in Settings.',
      options: [{ key: 'block', label: 'Block', danger: true }],
    });
    if (ok !== 'block') return false;
    try {
      await firstValueFrom(this.journals.blockUser(person.id));
      this.toastr.success(`${person.name} is blocked`);
      return true;
    } catch {
      this.toastr.error('Couldn\'t block them. Please try again.');
      return false;
    }
  }

  // ── Menus ───────────────────────────────────────────────────────────────

  private async ownMenu(story: StoryRef, anchor?: HTMLElement | null): Promise<StoryOutcome> {
    const hidden = story.visibility === 'private';
    const draft = story.status === 'draft';
    const key = await this.choose({
      title: story.title || 'Untitled story',
      message: draft ? 'A draft: only you can see it.' : hidden ? 'Hidden from Community: only you can see it.' : undefined,
      options: draft ? [
        { key: 'edit', label: 'Continue editing' },
        { key: 'delete', label: 'Delete draft', danger: true },
      ] : [
        { key: 'edit', label: 'Edit story' },
        { key: 'visibility', label: hidden ? 'Show in Community' : 'Hide from Community' },
        { key: 'share', label: 'Share' },
        { key: 'delete', label: 'Delete story', danger: true },
      ],
    }, anchor);
    switch (key) {
      case 'edit':
        this.router.navigate(['/community/write'], { queryParams: { edit: story.id } });
        return null;
      case 'visibility':
        return this.setVisibility(story, hidden ? 'public' : 'private');
      case 'share':
        await this.share(story);
        return null;
      case 'delete':
        return this.confirmDelete(story);
      default:
        return null;
    }
  }

  private async othersMenu(story: StoryRef, anchor?: HTMLElement | null): Promise<StoryOutcome> {
    const author = story.author?.name || 'this traveller';
    const key = await this.choose({
      title: story.title,
      options: [
        { key: 'share', label: 'Share' },
        { key: 'hide', label: 'Not interested' },
        { key: 'report', label: 'Report story' },
        ...(story.author?.id ? [{ key: 'block', label: `Block ${author}`, danger: true }] : []),
      ],
    }, anchor);
    switch (key) {
      case 'share':
        await this.share(story);
        return null;
      case 'hide':
        return this.notInterested(story);
      case 'report':
        return this.report(story);
      case 'block':
        return (await this.confirmBlock({ id: story.author!.id, name: author }))
          ? { type: 'blocked', userId: story.author!.id }
          : null;
      default:
        return null;
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  private async setVisibility(story: StoryRef, visibility: 'public' | 'private'): Promise<StoryOutcome> {
    try {
      await firstValueFrom(this.journals.setVisibility(story.id, visibility));
      this.toastr.success(visibility === 'private'
        ? 'Hidden from Community. Only you can see it now.'
        : 'Back in Community. Everyone can see it again.');
      return { type: 'visibility', visibility };
    } catch {
      this.toastr.error('Couldn\'t change that. Please try again.');
      return null;
    }
  }

  private async confirmDelete(story: StoryRef): Promise<StoryOutcome> {
    const ok = await this.choose({
      title: 'Delete this story?',
      message: 'Its photos, likes and comments will be removed too. This can\'t be undone.',
      options: [{ key: 'delete', label: 'Delete', danger: true }],
    });
    if (ok !== 'delete') return null;
    try {
      await firstValueFrom(this.journals.deleteJournal(story.id));
      this.toastr.success('Story deleted');
      return { type: 'deleted' };
    } catch {
      this.toastr.error('Couldn\'t delete the story. Please try again.');
      return null;
    }
  }

  private async notInterested(story: StoryRef): Promise<StoryOutcome> {
    if (!(await this.signedIn())) return null;
    try {
      await firstValueFrom(this.journals.hide(story.id));
      this.toastr.success('Hidden from your feed. You won\'t see this story in Community any more.');
      return { type: 'removed' };
    } catch {
      this.toastr.error('Couldn\'t hide it. Please try again.');
      return null;
    }
  }

  private async report(story: StoryRef): Promise<StoryOutcome> {
    if (!(await this.signedIn())) return null;
    const reason = await this.choose({
      title: 'Why are you reporting this story?',
      message: 'Your report is anonymous.',
      options: REPORT_REASONS.map(r => ({ key: r.key, label: r.label })),
    });
    if (!reason) return null;
    try {
      await firstValueFrom(this.journals.report(story.id, reason));
      this.toastr.success('Thanks for letting us know. We\'ll review this story within 24 hours.');
      return { type: 'removed' };
    } catch {
      this.toastr.error('Couldn\'t send the report. Please try again.');
      return null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * A list of choices or a confirmation; resolves with the chosen key.
   * With `anchor` (wider screens) it opens as a small menu beside that button,
   * flipping above it when there's no room below.
   */
  choose(data: ChoiceDialogData, anchor?: HTMLElement | null): Promise<string | undefined> {
    const placed = anchor ? this.placeBeside(anchor, data) : null;
    return firstValueFrom(this.dialog.open(ChoiceDialogComponent, {
      data: { ...data, compact: !!placed },
      panelClass: placed ? ['custom-dialog-container', 'choice-popover'] : 'custom-dialog-container',
      backdropClass: placed ? 'cdk-overlay-transparent-backdrop' : undefined,
      position: placed ?? undefined,
      autoFocus: false,
      restoreFocus: false,
    }).afterClosed());
  }

  /** Where a menu goes next to its button, or null on small screens (centred there). */
  private placeBeside(anchor: HTMLElement, data: ChoiceDialogData): { top: string; left: string } | null {
    if (typeof window === 'undefined' || window.innerWidth < 640) return null;
    const r = anchor.getBoundingClientRect();
    const width = 260, gap = 6, edge = 16;
    // Title + message + options + cancel, roughly (the compact menu's sizes).
    const height = 52 + (data.message ? 40 : 0) + data.options.length * 42 + 52;
    let top = r.bottom + gap;
    if (top + height > window.innerHeight - edge) top = Math.max(edge, r.top - gap - height);
    const left = Math.min(Math.max(edge, r.right - width), window.innerWidth - width - edge);
    return { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` };
  }

  /** True when signed in, asking to sign in first if not. */
  async signedIn(): Promise<boolean> {
    if (this.auth.isLoggedIn) return true;
    const result = await firstValueFrom(this.dialog.open(AuthGateModalComponent, {
      data: { destination: '' },
      panelClass: 'auth-gate-dialog',
      maxWidth: '500px',
      width: '500px',
    }).afterClosed());
    return result?.type === 'authenticated';
  }
}
