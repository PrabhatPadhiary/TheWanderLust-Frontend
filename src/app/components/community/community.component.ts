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

export interface CommunityQuestion {
  id: string;
  text: string;
  destination: string;
  answers: number;
  tag: string;
}

export interface TrendingDestination {
  name: string;
  tripsPlanned: number;
  change: number;
}

export interface TopTraveler {
  name: string;
  initial: string;
  color: string;
  trips: number;
  badge: string;
  budget: string;
  saves: number;
}

@Component({
  selector: 'app-community',
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
  standalone: false
})
export class CommunityComponent implements OnInit, OnDestroy {

  activeTab: 'journals' | 'ask' | 'squads' | 'trending' = 'journals';
  journalSort: 'recent' | 'popular' = 'recent';

  stats = [
    { value: '2,400+', label: 'Travellers' },
    { value: '840',    label: 'Trip Journals' },
    { value: '190+',   label: 'Destinations' },
    { value: '3.2K',   label: 'Questions Answered' },
  ];

  journals: TripJournal[] = [];
  feedLoading = true;
  uploadState: JournalUploadState = { status: 'idle', journalId: null, title: null };
  private uploadSub?: Subscription;

  questions: CommunityQuestion[] = [
    { id: '1', text: 'Is Wayanad worth visiting in June during monsoon?', destination: 'Wayanad', answers: 14, tag: 'Wayanad' },
    { id: '2', text: 'Best budget stays near Dubai Metro line?', destination: 'Dubai', answers: 6, tag: 'Dubai' },
    { id: '3', text: 'Solo female travel in Coorg — is it safe?', destination: 'Coorg', answers: 21, tag: 'Coorg' },
    { id: '4', text: 'How many days is enough for Manali in October?', destination: 'Manali', answers: 33, tag: 'Manali' },
    { id: '5', text: 'Best rooftop cafes in Goa that aren\'t touristy?', destination: 'Goa', answers: 9, tag: 'Goa' },
  ];

  trending: TrendingDestination[] = [
    { name: 'Wayanad, Kerala',  tripsPlanned: 289, change: 32 },
    { name: 'Coorg, Karnataka', tripsPlanned: 193, change: 18 },
    { name: 'Dubai, UAE',       tripsPlanned: 154, change: 12 },
    { name: 'Manali, HP',       tripsPlanned: 142, change: 8  },
    { name: 'Goa',              tripsPlanned: 381, change: 5  },
  ];

  topTravelers: TopTraveler[] = [
    { name: 'Rahul Menon',  initial: 'R', color: '#e85d04', trips: 12, badge: 'Adventure', budget: '₹45', saves: 3 },
    { name: 'Priya Nair',   initial: 'P', color: '#db2777', trips: 9,  badge: 'Foodie',    budget: '₹30', saves: 0 },
    { name: 'Karan Mehta',  initial: 'K', color: '#7c3aed', trips: 15, badge: 'Budget Pro', budget: '₹20', saves: 1 },
  ];

  newQuestion = '';
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
    const colors = ['#02334a', '#4a1942', '#1a365d', '#744210', '#1e3a5f', '#3d0c45'];
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

  setTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  setSort(sort: typeof this.journalSort): void {
    this.journalSort = sort;
  }

  goToDestination(name: string): void {
    // Navigate to search with destination name pre-filled (future: resolve placeId)
    this.router.navigate(['/']);
  }

  submitQuestion(): void {
    if (!this.newQuestion.trim()) return;
    this.questions.unshift({
      id: Date.now().toString(),
      text: this.newQuestion.trim(),
      destination: 'General',
      answers: 0,
      tag: 'General'
    });
    this.newQuestion = '';
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
