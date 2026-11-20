import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';
import { JournalService, JournalFeedItem, vibesOf, vibeLabel } from '../../services/journal.service';
import { StoryActionsService } from '../../services/story-actions.service';
import { JournalUploadStateService, JournalUploadState } from '../../services/journal-upload-state.service';
import { ToastrService } from 'ngx-toastr';

export interface TripJournal {
  id: string;
  authorId: string;
  authorName: string;
  authorInitial: string;
  authorColor: string;
  authorLocation: string;
  tripCount: number;
  destinationName: string;
  destinationCountry: string;
  month: string;
  title: string;
  excerpt: string;
  tags: string[];
  placesMentioned: string[];
  likes: number;
  isLiked: boolean;
  comments: number;
  saves: number;
  tripBadge: string | null;
  imageUrl: string | null;
  /** Up to three photos, in order (the card's collage). */
  photos: string[];
  vibes: string[];
  publishedAt: string;
}

/** Most liked first, then most discussed, then newest (as in the app). */
function byPopularity(a: TripJournal, b: TripJournal): number {
  return (b.likes - a.likes) || (b.comments - a.comments)
    || (new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

@Component({
  selector: 'app-community',
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
  standalone: false
})
export class CommunityComponent implements OnInit, OnDestroy {

  journalSort: 'recent' | 'popular' = 'recent';
  searchQuery = '';
  activeVibe = 'all';
  readonly vibeLabel = vibeLabel;

  journals: TripJournal[] = [];
  feedLoading = true;
  uploadState: JournalUploadState = { status: 'idle', journalId: null, title: null };
  private uploadSub?: Subscription;

  constructor(
    public authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private journalService: JournalService,
    public uploadStateService: JournalUploadStateService,
    private toastr: ToastrService,
    private storyActions: StoryActionsService,
  ) {}

  ngOnInit(): void {
    // Show the feed from last time straight away (if any); a fresh one replaces it below.
    const cached = this.journalService.peekFeed();
    if (cached) {
      this.journals = cached.map(item => this.mapFeedItemToJournal(item));
      this.feedLoading = false;
    }
    // Wait for Firebase auth to restore before loading feed
    // so the backend can resolve the current user and return correct isLiked values
    this.authService.authReady.then(() => this.loadFeed());
    this.uploadSub = this.uploadStateService.upload$.subscribe(state => {
      this.uploadState = state;
    });
  }

  ngOnDestroy(): void {
    this.uploadSub?.unsubscribe();
  }

  private loadFeed(): void {
    this.feedLoading = this.journals.length === 0;   // quiet refresh when there's something to show
    this.journalService.getFeed().subscribe({
      next: (items) => {
        this.journals = items.map(item => this.mapFeedItemToJournal(item));
        this.feedLoading = false;
      },
      error: () => { this.feedLoading = false; }
    });
  }

  private mapFeedItemToJournal(item: JournalFeedItem): TripJournal {
    const authorName = item.author?.name || 'Anonymous';
    const colors = ['#2B3F51', '#213242', '#273C50', '#742710', '#293F54', '#1B2936'];
    const colorIndex = authorName.charCodeAt(0) % colors.length;

    // Calculate trip duration badge
    let tripBadge: string | null = null;
    if (item.startDate && item.endDate) {
      const days = Math.round((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) tripBadge = `${days} day trip`;
    }

    // Format month
    const publishedDate = item.publishedAt ? new Date(item.publishedAt) : new Date(item.createdAt);
    const month = publishedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    return {
      id: item.id,
      authorId: item.author?.id || '',
      authorName: authorName,
      authorInitial: authorName.charAt(0).toUpperCase(),
      authorColor: colors[colorIndex],
      authorLocation: '',
      tripCount: 0,
      destinationName: item.destination,
      destinationCountry: '',
      month: month,
      title: item.title,
      excerpt: item.body.length > 200 ? item.body.substring(0, 200) + '...' : item.body,
      tags: [],
      placesMentioned: item.places?.map(p => p.placeName) || [],
      likes: item.likesCount || 0,
      isLiked: item.isLiked || false,
      comments: item.commentsCount || 0,
      saves: 0,
      tripBadge: tripBadge,
      imageUrl: item.photos && item.photos.length > 0 ? item.photos[0].url : null,
      photos: [...(item.photos || [])].sort((a, b) => a.order - b.order).slice(0, 3).map(p => p.url),
      vibes: vibesOf(item.vibes),
      publishedAt: item.publishedAt || item.createdAt,
    };
  }

  /**
   * Stories are open to everyone; signing in is only needed to take part
   * (like, write). Asks to sign in, then carries on with what they were doing.
   * Closing the box just leaves them reading.
   */
  private askToSignIn(then: () => void): void {
    this.dialog.open(AuthGateModalComponent, {
      data: { destination: '' },
      panelClass: 'auth-gate-dialog',
      maxWidth: '500px',
      width: '500px',
    }).afterClosed().subscribe(result => {
      if (result?.type === 'authenticated') then();
    });
  }

  onWriteJournal(): void {
    if (!this.authService.isLoggedIn) {
      this.askToSignIn(() => this.router.navigate(['/community/write']));
      return;
    }
    this.router.navigate(['/community/write']);
  }

  /** Destinations people have written about, most stories first (from the feed). */
  get popularDestinations(): { name: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const j of this.journals) {
      const name = (j.destinationName || '').trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  setSort(sort: typeof this.journalSort): void {
    this.journalSort = sort;
  }

  openJournal(journalId: string, fragment?: string): void {
    this.router.navigate(['/community/story', journalId], fragment ? { fragment } : {});
  }

  likeJournal(journal: TripJournal): void {
    if (!this.authService.isLoggedIn) {
      this.askToSignIn(() => this.likeJournal(journal));
      return;
    }

    // Optimistic update
    const wasLiked = journal.isLiked;
    journal.isLiked = !wasLiked;
    journal.likes += wasLiked ? -1 : 1;

    this.journalService.toggleLike(journal.id).subscribe({
      next: (res) => {
        // Sync with server truth
        journal.isLiked = res.liked;
        journal.likes = res.likesCount;
      },
      error: () => {
        // Revert on failure
        journal.isLiked = wasLiked;
        journal.likes += wasLiked ? 1 : -1;
        this.toastr.error('Could not update like. Try again.');
      }
    });
  }

  // ── Search, vibes and sort ─────────────────────────────────────────────

  /** Vibes that actually appear in the feed, most used first, with how many stories have each. */
  get vibeOptions(): { vibe: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const j of this.journals) for (const v of j.vibes) counts.set(v, (counts.get(v) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([vibe, count]) => ({ vibe, count }));
  }

  vibeOpen = false;

  pickVibe(v: string): void {
    this.activeVibe = v;
    this.vibeOpen = false;
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  closeVibeMenu(): void {
    this.vibeOpen = false;
  }

  /** The feed after the search, the vibe and the sort. */
  get shownJournals(): TripJournal[] {
    const q = this.searchQuery.trim().toLowerCase();
    const matching = this.journals
      .filter(j => this.activeVibe === 'all' || j.vibes.includes(this.activeVibe))
      .filter(j => !q
        || (j.destinationName || '').toLowerCase().includes(q)
        || (j.title || '').toLowerCase().includes(q)
        || (j.authorName || '').toLowerCase().includes(q));
    // The feed already comes newest first.
    return this.journalSort === 'popular' ? [...matching].sort(byPopularity) : matching;
  }

  trackById(_: number, j: TripJournal): string { return j.id; }

  // ── A story's actions ─────────────────────────────────────────────────

  shareJournal(j: TripJournal): void {
    this.storyActions.share({ id: j.id, title: j.title });
  }

  /** The ⋯ menu: edit / hide / share / delete yours; share / not interested / report / block others'. */
  async openStoryMenu(j: TripJournal, event?: Event): Promise<void> {
    const outcome = await this.storyActions.openMenu({
      id: j.id,
      title: j.title,
      author: { id: j.authorId, name: j.authorName },
      visibility: 'public',   // the feed only has public stories
    }, event?.currentTarget as HTMLElement | null);
    if (!outcome) return;
    if (outcome.type === 'blocked') {
      this.journals = this.journals.filter(x => x.authorId !== outcome.userId);
    } else if (outcome.type === 'deleted' || outcome.type === 'removed'
      || (outcome.type === 'visibility' && outcome.visibility === 'private')) {
      this.journals = this.journals.filter(x => x.id !== j.id);
    }
  }
}
