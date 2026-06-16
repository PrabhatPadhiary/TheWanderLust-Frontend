import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';
import { JournalService, JournalFeedItem } from '../../services/journal.service';

export interface TripJournal {
  id: string;
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
export class CommunityComponent implements OnInit {

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

  constructor(
    public authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private journalService: JournalService
  ) {}

  ngOnInit(): void {
    this.checkAuth();
    this.loadFeed();
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
    const colors = ['#e85d04', '#2563eb', '#16a34a', '#7c3aed', '#db2777', '#0891b2'];
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

  likeJournal(journal: TripJournal): void {
    journal.likes++;
  }

  saveJournal(journal: TripJournal): void {
    journal.saves++;
  }
}
