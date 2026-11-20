import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { JournalService, JournalFeedItem } from '../../services/journal.service';
import { StoryActionsService } from '../../services/story-actions.service';

@Component({
  selector: 'app-my-journals',
  templateUrl: './my-journals.component.html',
  styleUrls: ['./my-journals.component.scss'],
  standalone: false
})
export class MyJournalsComponent implements OnInit {

  journals: JournalFeedItem[] = [];
  loading = true;
  activeFilter: 'all' | 'published' | 'draft' = 'all';


  constructor(
    private router: Router,
    public authService: AuthService,
    private journalService: JournalService,
    private storyActions: StoryActionsService,
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/community']);
      return;
    }
    this.authService.authReady.then(() => this.loadJournals());
  }

  private loadJournals(): void {
    this.loading = true;
    this.journalService.getMyJournals().subscribe({
      next: (items) => {
        this.journals = items;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get filteredJournals(): JournalFeedItem[] {
    if (this.activeFilter === 'all') return this.journals;
    return this.journals.filter(j => j.status === this.activeFilter);
  }

  setFilter(filter: 'all' | 'published' | 'draft'): void {
    this.activeFilter = filter;
  }

  get publishedCount(): number {
    return this.journals.filter(j => j.status === 'published').length;
  }

  get draftCount(): number {
    return this.journals.filter(j => j.status === 'draft').length;
  }

  goBack(): void {
    this.router.navigate(['/community']);
  }

  openJournal(journal: JournalFeedItem): void {
    if (journal.status === 'draft') {
      this.router.navigate(['/community/write'], { queryParams: { edit: journal.id } });
    } else {
      this.router.navigate(['/community/story', journal.id]);
    }
  }

  writeNewJournal(): void {
    this.router.navigate(['/community/write']);
  }

  /** Same ⋯ menu as in Community: edit, hide / show, share, delete (drafts: edit, delete). */
  async openMenu(journal: JournalFeedItem, event: Event): Promise<void> {
    event.stopPropagation();
    const outcome = await this.storyActions.openMenu(journal, event.currentTarget as HTMLElement | null);
    if (!outcome) return;
    if (outcome.type === 'deleted') {
      this.journals = this.journals.filter(j => j.id !== journal.id);
    } else if (outcome.type === 'visibility') {
      journal.visibility = outcome.visibility;
    }
  }

  getAuthorInitial(journal: JournalFeedItem): string {
    return journal.author?.name?.charAt(0).toUpperCase() ?? '?';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getExcerpt(body: string): string {
    if (!body) return '';
    return body.length > 120 ? body.substring(0, 120) + '...' : body;
  }
}
