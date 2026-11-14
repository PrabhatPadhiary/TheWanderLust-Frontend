import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';
import { JournalService, JournalFeedItem } from '../../services/journal.service';
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
}

@Component({
  selector: 'app-community',
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
  standalone: false
})
export class CommunityComponent implements OnInit, OnDestroy {

  activeTab: 'journals' | 'squads' = 'journals';
  journalSort: 'recent' | 'popular' = 'recent';

  journals: TripJournal[] = [];
  feedLoading = true;
  uploadState: JournalUploadState = { status: 'idle', journalId: null, title: null };
  private uploadSub?: Subscription;

  showAuthBlur = false;

  // Journal menu state
  openMenuJournalId: string | null = null;
  journalMenuPosition = { top: 0, right: 0 };
  journalToDelete: TripJournal | null = null;
  deletingJournal = false;

  constructor(
    public authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private journalService: JournalService,
    public uploadStateService: JournalUploadStateService,
    private toastr: ToastrService
  ) {}

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.openMenuJournalId) this.openMenuJournalId = null;
  }

  ngOnInit(): void {
    this.checkAuth();
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
    this.feedLoading = true;
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
    const month = publishedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
      imageUrl: item.photos && item.photos.length > 0 ? item.photos[0].url : null
    };
  }

  private checkAuth(): void {
    if (!this.authService.isLoggedIn) {
      this.showAuthBlur = true;
      const dialogRef = this.dialog.open(AuthGateModalComponent, {
        data: { destination: '' },
        panelClass: 'auth-gate-dialog',
        maxWidth: '500px',
        width: '500px',
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result?.type === 'authenticated') {
          this.showAuthBlur = false;
        } else {
          // User dismissed without logging in — redirect home
          this.router.navigate(['/']);
        }
      });
    }
  }

  onWriteJournal(): void {
    if (!this.authService.isLoggedIn) {
      this.checkAuth();
      return;
    }
    this.router.navigate(['/community/write']);
  }

  editJournal(journal: TripJournal): void {
    this.openMenuJournalId = null;
    this.router.navigate(['/community/write'], { queryParams: { edit: journal.id } });
  }

  isOwnJournal(journal: TripJournal): boolean {
    return this.authService.currentUser?.id === journal.authorId;
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

  setTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  setSort(sort: typeof this.journalSort): void {
    this.journalSort = sort;
  }

  openJournal(journalId: string, fragment?: string): void {
    this.router.navigate(['/community/journal', journalId], fragment ? { fragment } : {});
  }

  likeJournal(journal: TripJournal): void {
    if (!this.authService.isLoggedIn) {
      this.checkAuth();
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

  // ── Journal menu actions ──────────────────────────────────────────────────

  toggleJournalMenu(journal: TripJournal, event: Event): void {
    event.stopPropagation();
    if (this.openMenuJournalId === journal.id) {
      this.openMenuJournalId = null;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.journalMenuPosition = {
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right
    };
    this.openMenuJournalId = journal.id;
  }

  getOpenMenuJournal(): TripJournal | undefined {
    return this.journals.find(j => j.id === this.openMenuJournalId);
  }

  openDeleteConfirm(journal: TripJournal): void {
    this.openMenuJournalId = null;
    this.journalToDelete = journal;
  }

  cancelDeleteJournal(): void {
    this.journalToDelete = null;
  }

  confirmDeleteJournal(): void {
    if (!this.journalToDelete || this.deletingJournal) return;
    this.deletingJournal = true;

    this.journalService.deleteJournal(this.journalToDelete.id).subscribe({
      next: () => {
        this.journals = this.journals.filter(j => j.id !== this.journalToDelete!.id);
        this.toastr.success('Journal deleted successfully');
        this.deletingJournal = false;
        this.journalToDelete = null;
      },
      error: () => {
        this.toastr.error('Failed to delete journal. Try again.');
        this.deletingJournal = false;
      }
    });
  }

  saveJournal(journal: TripJournal): void {
    journal.saves++;
  }
}
