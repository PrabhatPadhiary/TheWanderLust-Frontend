import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { JournalService, JournalDetail, JournalComment, JournalFeedItem } from '../../../services/journal.service';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { AuthGateModalComponent } from '../../auth-gate-modal/auth-gate-modal.component';
import { SeoService } from '../../../services/seo.service';
import { StoryActionsService } from '../../../services/story-actions.service';
import { FavouritesService } from '../../../services/favourites.service';
import { AddToTripModalComponent, AddToTripModalData } from '../../add-to-trip-modal/add-to-trip-modal.component';
import { PlaceDto, PlaceDetailsResponse } from '../../../models/destination.model';
import { firstValueFrom } from 'rxjs';
import { NavHistoryService } from '../../../services/nav-history.service';

type StoryPlace = JournalDetail['places'][number];

@Component({
  selector: 'app-journal-detail',
  templateUrl: './journal-detail.component.html',
  styleUrls: ['./journal-detail.component.scss'],
  standalone: false
})
export class JournalDetailComponent implements OnInit, OnDestroy {

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

  /** The author's other public stories (up to 3, newest first). */
  moreFromAuthor: JournalFeedItem[] = [];

  private paramSub?: Subscription;

  // A place from the story, open in the side panel
  panelPlace: PlaceDto | null = null;
  panelOpen = false;
  private panelStoryPlace: StoryPlace | null = null;
  private panelDetails: PlaceDetailsResponse | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private journalService: JournalService,
    public authService: AuthService,
    private toastr: ToastrService,
    private seo: SeoService,
    private dialog: MatDialog,
    private storyActions: StoryActionsService,
    private favourites: FavouritesService,
    public navHistory: NavHistoryService,
  ) {}

  /** The story's own title, summary and photo for search and link previews (private stories stay out). */
  private applySeo(j: JournalDetail): void {
    const text = (j.body || '').replace(/\s+/g, ' ').trim();
    const description = text.length > 155 ? text.slice(0, 152).replace(/\s+\S*$/, '') + '…' : text;
    const photo = [...(j.photos || [])].sort((a, b) => a.order - b.order)[0]?.url;
    const isPublic = (j.visibility || '').toLowerCase() === 'public';
    this.seo.set({
      title: `${j.title} · ${j.destination} travel story · Wayraa`,
      description: description || `A trip to ${j.destination}, shared on Wayraa.`,
      image: photo,
      type: 'article',
      noindex: !isPublic,
    });
    this.seo.setJsonLd(isPublic ? {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: j.title,
      description,
      image: photo ? [photo] : undefined,
      datePublished: j.publishedAt || j.createdAt,
      author: { '@type': 'Person', name: j.author?.name || 'Wayraa traveller' },
      publisher: { '@type': 'Organization', name: 'Wayraa', logo: { '@type': 'ImageObject', url: 'https://wayraa.com/assets/images/logo/wayraa_logo_notext.png' } },
      mainEntityOfPage: `https://wayraa.com/community/story/${j.id}`,
      contentLocation: { '@type': 'Place', name: j.destination },
    } : null);
  }

  ngOnInit(): void {
    // Follows the id in the URL, so opening another story from "More from…"
    // (same page, new id) loads that story.
    this.paramSub = this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) { this.notFound = true; this.loading = false; return; }
      this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  private load(id: string): void {
    this.loading = true;
    this.notFound = false;
    this.journal = null;
    this.moreFromAuthor = [];
    this.activePhotoIndex = 0;
    this.lightboxOpen = false;
    this.newComment = '';

    this.authService.authReady.then(() => {
      this.journalService.getById(id).subscribe({
        next: (j) => {
          this.journal = j;
          this.applySeo(j);
          this.isLiked = j.isLikedByMe;
          this.likesCount = j.likesCount;
          this.loading = false;
          this.loadMoreFromAuthor(j);

          if (this.route.snapshot.fragment === 'comments') {
            setTimeout(() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' }), 150);
          } else if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0 });
          }
        },
        error: () => {
          this.notFound = true;
          this.loading = false;
        }
      });
    });
  }

  /**
   * The author's other public stories, from the community feed (newest public
   * stories). Hidden when there are none.
   */
  private loadMoreFromAuthor(j: JournalDetail): void {
    this.journalService.getFeed().subscribe({
      next: (items) => {
        if (this.journal?.id !== j.id) return;   // moved on to another story meanwhile
        this.moreFromAuthor = (items || [])
          .filter(i => i.author?.id === j.author.id && i.id !== j.id)
          .slice(0, 3);
      },
      error: () => { this.moreFromAuthor = []; },
    });
  }

  openStory(id: string): void {
    this.router.navigate(['/community/story', id]);
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
    const colors = ['#2B3F51', '#213242', '#273C50', '#742710', '#293F54', '#1B2936'];
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

  /** The trip's actual spend for the stats card, e.g. "₹12,000". */
  get budgetAmount(): string {
    const b = this.journal?.budget;
    if (!b) return '';
    const c = this.journal?.currency || 'INR';
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(b);
    } catch {
      return `${c} ${b.toLocaleString('en-IN')}`;
    }
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
    const colors = ['#2B3F51', '#213242', '#273C50', '#742710', '#293F54', '#1B2936'];
    return colors[comment.author.name?.charCodeAt(0) % colors.length];
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Back to wherever you came from (another story, a place…); Community if you opened this one from a link. */
  goBack(): void {
    this.navHistory.back('/community');
  }

  /** Reading is open to everyone; liking and commenting ask to sign in first, then carry on. */
  askToSignIn(then?: () => void): void {
    this.dialog.open(AuthGateModalComponent, {
      data: { destination: '' },
      panelClass: 'auth-gate-dialog',
      maxWidth: '500px',
      width: '500px',
    }).afterClosed().subscribe(result => {
      if (result?.type === 'authenticated') then?.();
    });
  }

  /** "Plan a trip like this": straight to planning (the planner asks to sign in when needed). */
  startPlanning(): void {
    this.router.navigate(['/']);
  }

  toggleLike(): void {
    if (!this.authService.isLoggedIn) {
      this.askToSignIn(() => this.toggleLike());
      return;
    }
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
    if (this.journal) this.storyActions.share(this.journal);
  }

  // ── The story's ⋯ menu ────────────────────────────────────────────────────

  get isMine(): boolean {
    return !!this.journal && this.storyActions.isMine(this.journal);
  }

  async openStoryMenu(event?: Event): Promise<void> {
    if (!this.journal) return;
    const outcome = await this.storyActions.openMenu(this.journal, event?.currentTarget as HTMLElement | null);
    if (!outcome) return;
    if (outcome.type === 'visibility') {
      this.journal.visibility = outcome.visibility;
      return;
    }
    // Deleted, hidden, reported or its author blocked: nothing left to read here.
    this.router.navigate(['/community']);
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  isMyComment(c: JournalComment): boolean {
    return !!this.authService.currentUser?.id && c.author?.id === this.authService.currentUser.id;
  }

  /** Your comment: delete it. Someone else's: block them (signed in). */
  async openCommentMenu(c: JournalComment, event?: Event): Promise<void> {
    if (!this.journal) return;
    const anchor = event?.currentTarget as HTMLElement | null;
    const journal = this.journal;
    if (this.isMyComment(c)) {
      const ok = await this.storyActions.choose({
        title: 'Delete comment?',
        options: [{ key: 'delete', label: 'Delete', danger: true }],
      }, anchor);
      if (ok !== 'delete') return;
      try {
        await firstValueFrom(this.journalService.deleteComment(journal.id, c.id));
        journal.comments = journal.comments.filter(x => x.id !== c.id);
        journal.commentsCount = Math.max(0, journal.commentsCount - 1);
      } catch {
        this.toastr.error('Couldn\'t delete the comment. Please try again.');
      }
      return;
    }
    const name = c.author?.name || 'this person';
    const key = await this.storyActions.choose({
      title: name,
      options: [{ key: 'block', label: `Block ${name}`, danger: true }],
    }, anchor);
    if (key !== 'block') return;
    if (!(await this.storyActions.confirmBlock({ id: c.author.id, name }))) return;
    if (journal.author?.id === c.author.id) {
      this.router.navigate(['/community']);   // they wrote the story too
      return;
    }
    const left = journal.comments.filter(x => x.author?.id !== c.author.id);
    journal.commentsCount = Math.max(0, journal.commentsCount - (journal.comments.length - left.length));
    journal.comments = left;
  }

  // ── Places mentioned: open one in the side panel ──────────────────────────

  openPlace(place: StoryPlace): void {
    if (!place.googlePlaceId) return;
    this.panelStoryPlace = place;
    this.panelDetails = null;
    this.panelPlace = {
      placeId: place.googlePlaceId,
      name: place.placeName,
      vicinity: '',
      rating: null,
      userRatingsTotal: null,
      priceLevel: null,
      geometry: { latitude: place.latitude ?? 0, longitude: place.longitude ?? 0 },
      photos: [],
      types: [],
    };
    this.panelOpen = true;
  }

  closePlace(): void {
    this.panelOpen = false;
  }

  onPlaceDetails(d: PlaceDetailsResponse): void {
    this.panelDetails = d;
  }

  /** The open place with whatever the panel has loaded (address, rating, photo). */
  private get fullPanelPlace(): PlaceDto | null {
    if (!this.panelPlace) return null;
    const d = this.panelDetails;
    return d ? {
      ...this.panelPlace,
      name: d.name || this.panelPlace.name,
      vicinity: d.formattedAddress || '',
      rating: d.rating,
      userRatingsTotal: d.userRatingsTotal,
      priceLevel: d.priceLevel,
      geometry: d.geometry || this.panelPlace.geometry,
      photos: d.photos || [],
    } : this.panelPlace;
  }

  async addPlaceToTrip(): Promise<void> {
    const place = this.fullPanelPlace;
    if (!place || !this.journal) return;
    if (!(await this.storyActions.signedIn())) return;
    const cat = this.panelStoryPlace?.category;
    const category = cat === 'stay' ? 'stay' : cat === 'food' ? 'food' : 'activity';
    const ref = this.dialog.open(AddToTripModalComponent, {
      panelClass: 'custom-dialog-container',
      data: { place, category, destinationName: this.journal.destination } as AddToTripModalData,
    });
    ref.afterClosed().subscribe(result => {
      if (result === 'create-new') {
        // A new trip starts from its destination: search for it on Explore.
        this.panelOpen = false;
        this.router.navigate(['/']);
        this.toastr.info(`Search for ${this.journal?.destination || 'your destination'} to start a new trip`);
      }
    });
  }

  toggleFavouritePlace(): void {
    const place = this.fullPanelPlace;
    if (!place) return;
    if (this.favourites.isFavourite(place.placeId)) {
      this.favourites.remove(place.placeId);
      return;
    }
    const cat = this.panelStoryPlace?.category;
    this.favourites.add({
      placeId: place.placeId,
      placeName: place.name,
      vicinity: place.vicinity,
      rating: place.rating,
      userRatingsTotal: place.userRatingsTotal,
      photoUrl: place.photos[0]?.url || null,
      category: cat === 'stay' ? 'lodging' : cat === 'food' ? 'restaurant' : 'tourist_attraction',
    });
  }

  scrollToComments(): void {
    const el = document.getElementById('comments');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
