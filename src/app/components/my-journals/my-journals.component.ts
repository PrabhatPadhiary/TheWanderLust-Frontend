import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { JournalService, JournalFeedItem } from '../../services/journal.service';
import { ToastrService } from 'ngx-toastr';

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

  // Menu state
  openMenuJournalId: string | null = null;
  menuPosition = { top: 0, right: 0 };
  journalToDelete: JournalFeedItem | null = null;
  deletingJournal = false;

  constructor(
    private router: Router,
    public authService: AuthService,
    private journalService: JournalService,
    private toastr: ToastrService
  ) {}

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.openMenuJournalId) this.openMenuJournalId = null;
  }

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
      this.router.navigate(['/community/journal', journal.id]);
    }
  }

  editJournal(journal: JournalFeedItem): void {
    this.openMenuJournalId = null;
    this.router.navigate(['/community/write'], { queryParams: { edit: journal.id } });
  }

  writeNewJournal(): void {
    this.router.navigate(['/community/write']);
  }

  toggleMenu(journal: JournalFeedItem, event: Event): void {
    event.stopPropagation();
    if (this.openMenuJournalId === journal.id) {
      this.openMenuJournalId = null;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.menuPosition = {
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right
    };
    this.openMenuJournalId = journal.id;
  }

  getOpenMenuJournal(): JournalFeedItem | undefined {
    return this.journals.find(j => j.id === this.openMenuJournalId);
  }

  openDeleteConfirm(journal: JournalFeedItem): void {
    this.openMenuJournalId = null;
    this.journalToDelete = journal;
  }

  cancelDelete(): void {
    this.journalToDelete = null;
  }

  confirmDelete(): void {
    if (!this.journalToDelete || this.deletingJournal) return;
    this.deletingJournal = true;

    this.journalService.deleteJournal(this.journalToDelete.id).subscribe({
      next: () => {
        this.journals = this.journals.filter(j => j.id !== this.journalToDelete!.id);
        this.toastr.success('Journal deleted');
        this.deletingJournal = false;
        this.journalToDelete = null;
      },
      error: () => {
        this.toastr.error('Failed to delete journal');
        this.deletingJournal = false;
      }
    });
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
