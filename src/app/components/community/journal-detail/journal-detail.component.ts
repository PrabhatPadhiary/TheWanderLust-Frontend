import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { JournalService, JournalDetail, JournalComment } from '../../../services/journal.service';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-journal-detail',
  templateUrl: './journal-detail.component.html',
  styleUrls: ['./journal-detail.component.scss'],
  standalone: false
})
export class JournalDetailComponent implements OnInit {

  journal: JournalDetail | null = null;
  loading = true;
  notFound = false;

  // like state
  isLiked = false;
  likesCount = 0;
  likeInFlight = false;

  // photo gallery
  activePhotoIndex = 0;
  lightboxOpen = false;

  // comments
  newComment = '';
  postingComment = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private journalService: JournalService,
    public authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.notFound = true; this.loading = false; return; }

    this.authService.authReady.then(() => {
      this.journalService.getById(id).subscribe({
        next: (j) => {
          this.journal = j;
          this.isLiked = j.isLikedByMe;
          this.likesCount = j.likesCount;
          this.loading = false;

          // Auto-scroll to comments if fragment is present
          this.route.fragment.subscribe(fragment => {
            if (fragment === 'comments') {
              setTimeout(() => {
                document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
              }, 150);
            }
          });
        },
        error: () => {
          this.notFound = true;
          this.loading = false;
        }
      });
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  get activePhotoUrl(): string {
    return this.journal?.photos?.[this.activePhotoIndex]?.url ?? '';
  }

  get totalPhotos(): number {
    return this.journal?.photos?.length ?? 0;
  }

  get authorInitial(): string {
    return this.journal?.author.name?.charAt(0).toUpperCase() ?? '?';
  }

  get authorColor(): string {
    const colors = ['#e85d04', '#2563eb', '#16a34a', '#7c3aed', '#db2777', '#0891b2'];
    const name = this.journal?.author.name ?? '';
    return colors[name.charCodeAt(0) % colors.length];
  }

  get tripDurationLabel(): string {
    if (!this.journal?.startDate || !this.journal?.endDate) return '';
    const days = Math.round(
      (new Date(this.journal.endDate).getTime() - new Date(this.journal.startDate).getTime())
      / (1000 * 60 * 60 * 24)
    );
    return days > 0 ? `${days} day trip` : '';
  }

  get formattedDateRange(): string {
    if (!this.journal?.startDate) return '';
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const start = new Date(this.journal.startDate).toLocaleDateString('en-US', opts);
    if (!this.journal.endDate) return start;
    const end = new Date(this.journal.endDate).toLocaleDateString('en-US', opts);
    return `${start} – ${end}`;
  }

  get travelersLabel(): string {
    const count = this.journal?.travelersCount;
    if (!count) return '';
    if (count === 1) return 'Solo';
    if (count === 2) return 'Couple';
    return `Group of ${count}`;
  }

  get travelersEmoji(): string {
    const count = this.journal?.travelersCount;
    if (!count) return '';
    if (count === 1) return '🧳';
    if (count === 2) return '👫';
    return '👨‍👩‍👧‍👦';
  }

  get budgetLabel(): string {
    const b = this.journal?.budget;
    const c = this.journal?.currency ?? 'INR';
    if (!b) return '';
    if (b < 20000) return 'Budget';
    if (b < 60000) return 'Mid-range';
    return 'Luxury';
  }

  get budgetEmoji(): string {
    const b = this.journal?.budget;
    if (!b) return '';
    if (b < 20000) return '💰';
    if (b < 60000) return '₹₹';
    return '💎';
  }

  get proTipsArray(): string[] {
    if (!this.journal?.proTips) return [];
    return this.journal.proTips
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }

  get bodyFirstParagraph(): string {
    if (!this.journal?.body) return '';
    const paras = this.journal.body.split('\n\n').filter(p => p.trim());
    return paras[0] ?? '';
  }

  get bodyRemainingParagraphs(): string[] {
    if (!this.journal?.body) return [];
    const paras = this.journal.body.split('\n\n').filter(p => p.trim());
    return paras.slice(1);
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      food: '🍽️', stay: '🏨', attraction: '🏛️', activity: '🎯',
      beach: '🏖️', nature: '🌿', shopping: '🛍️', transport: '🚗'
    };
    return icons[category?.toLowerCase()] ?? '📍';
  }

  relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days === 1 ? 'Yesterday' : days + ' days ago'}`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getCommentInitial(comment: JournalComment): string {
    return comment.author.name?.charAt(0).toUpperCase() ?? '?';
  }

  getCommentColor(comment: JournalComment): string {
    const colors = ['#e85d04', '#2563eb', '#16a34a', '#7c3aed', '#db2777', '#0891b2'];
    return colors[comment.author.name?.charCodeAt(0) % colors.length];
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/community']);
  }

  toggleLike(): void {
    if (!this.authService.isLoggedIn) return;
    if (this.likeInFlight) return;

    // Optimistic
    this.likeInFlight = true;
    const wasLiked = this.isLiked;
    this.isLiked = !wasLiked;
    this.likesCount += wasLiked ? -1 : 1;

    this.journalService.toggleLike(this.journal!.id).subscribe({
      next: (res) => {
        this.isLiked = res.liked;
        this.likesCount = res.likesCount;
        this.likeInFlight = false;
      },
      error: () => {
        this.isLiked = wasLiked;
        this.likesCount += wasLiked ? 1 : -1;
        this.likeInFlight = false;
        this.toastr.error('Could not update like. Try again.');
      }
    });
  }

  openLightbox(index: number): void {
    this.activePhotoIndex = index;
    this.lightboxOpen = true;
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
  }

  prevPhoto(): void {
    const total = this.journal?.photos.length ?? 0;
    this.activePhotoIndex = (this.activePhotoIndex - 1 + total) % total;
  }

  nextPhoto(): void {
    const total = this.journal?.photos.length ?? 0;
    this.activePhotoIndex = (this.activePhotoIndex + 1) % total;
  }

  shareJournal(): void {
    if (navigator.share) {
      navigator.share({ title: this.journal?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      this.toastr.success('Link copied to clipboard');
    }
  }

  postComment(): void {
    if (!this.newComment.trim() || !this.journal) return;
    if (!this.authService.isLoggedIn) return;

    this.postingComment = true;
    this.journalService.postComment(this.journal.id, this.newComment.trim()).subscribe({
      next: (res) => {
        this.journal!.comments.push(res);
        this.journal!.commentsCount++;
        this.newComment = '';
        this.postingComment = false;
      },
      error: () => {
        this.toastr.error('Failed to post comment');
        this.postingComment = false;
      }
    });
  }
}
