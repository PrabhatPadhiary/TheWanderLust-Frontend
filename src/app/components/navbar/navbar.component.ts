import { Component, EventEmitter, HostListener, Input, OnInit, OnDestroy, Output, ElementRef, ViewChild, AfterViewInit, QueryList, ViewChildren } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';
import { TripResponse } from '../../services/trip.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

declare var google: any;

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: false
})
export class NavbarComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() destinationName: string = '';
  @Input() tripName: string = '';
  @Input() existingTrip: TripResponse | null = null;
  @Input() isTripPlanner: boolean = false;
  @Input() primaryDestinationPlaceId: string = '';
  /** Landing mode: transparent navbar that frosts on scroll, shows section links */
  @Input() isLanding: boolean = false;
  /** Dark glass look, for pages over dark/cinematic heroes (the landing page). */
  @Input() dark: boolean = false;
  /** With `dark`: the page under the bar is light now (dark text and icons). */
  @Input() onLight: boolean = false;
  /** Destination mode: logo-only brand, single search bar, left-aligned to match content */
  @Input() isDestination: boolean = false;
  @Output() localSearchInput = new EventEmitter<string>();
  /** Destination mode: the page's section tabs (Stay / Eat / Do). */
  @Input() sectionTabs: { id: string; label: string; short?: string; badge?: number | string }[] = [];
  @Input() activeSection = '';
  @Output() sectionChange = new EventEmitter<string>();
  /** Destination mode: show Plan trip (or Continue planning + New trip) in the bar. */
  @Input() planActions = false;
  @Output() planTrip = new EventEmitter<void>();
  @Output() newTrip = new EventEmitter<void>();
  /** Trip planner: you own this trip (edit and delete show in the bar). */
  @Input() tripOwner = false;
  @Output() editTrip = new EventEmitter<void>();
  @Output() deleteTrip = new EventEmitter<void>();
  /** Phones: the destination search opens over the bar from a search button. */
  mobileSearchOpen = false;
  /** Width of each section tab in the bar (must match the SCSS). */
  readonly sectionTabWidth = 128;
  get sectionPillTransform(): string {
    const i = Math.max(0, this.sectionTabs.findIndex(t => t.id === this.activeSection));
    return `translateX(${i * this.sectionTabWidth}px)`;
  }

  predictions: any[] = [];
  showDropdown = false;
  showUserMenu = false;
  searchActive = false;
  showTripTooltip = false;
  scrolled = false;
  navIndex = 0;
  pillReady = false; // controls transition — off until after first paint
  hideSearchBar = false;
  isCommunityPage = false;
  isStaticLandingPage = false;
  private searchSubject = new Subject<string>();
  private autocompleteService: any;
  private blurTimeout: any;
  private initialized = false;
  private routerSub!: Subscription;

  private readonly navRoutes = ['explore', 'features', 'community', 'pricing'];

  /** Width of each section link (bigger on the dark landing bar; must match the SCSS). */
  get linkWidth(): number { return this.dark ? 132 : 110; }

  /**
   * Where each pill sits on screen. Every page has its own navbar, so on arrival the
   * pill starts where it was on the previous page (remembered below) and slides to
   * this page's tab, instead of just appearing there.
   */
  private static lastPill: Record<'landing' | 'app', number> = { landing: -1, app: -1 };
  landingPill = -1;
  appPill = -1;

  get pillTransform(): string {
    return `translateX(${this.landingPill * this.linkWidth}px)`;
  }

  constructor(
    public authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.updateIndex(e.urlAfterRedirects || e.url);
      if (this.pillReady) this.syncPills();
    });
    this.updateIndex(this.router.url);
    // Start each pill where it was on the last page (or right on this page's tab if it wasn't shown).
    const last = NavbarComponent.lastPill;
    this.landingPill = last.landing >= 0 && this.navIndex >= 0 ? last.landing : this.navIndex;
    this.appPill = last.app >= 0 && this.appIndex >= 0 ? last.app : this.appIndex;
  }

  ngAfterViewInit(): void {
    // After the first paint, turn the transition on and slide each pill to this page's tab.
    requestAnimationFrame(() => {
      this.pillReady = true;
      requestAnimationFrame(() => this.syncPills());
    });
  }

  /** Move the pills to the current tabs and remember where they are for the next page. */
  private syncPills(): void {
    this.landingPill = this.navIndex;
    this.appPill = this.appIndex;
    if (this.isLanding) NavbarComponent.lastPill.landing = this.navIndex;
    if (this.isAppPage) NavbarComponent.lastPill.app = this.appIndex;
  }

  /** Account pages (My Trips, Favourites, My Journals, Profile, Settings): the floating bar with their own switch. */
  get isAppPage(): boolean { return !this.isLanding && !this.isDestination && !this.isTripPlanner; }
  /** Which of Favourites / My Trips / My Journals is open (-1: none, e.g. Profile). */
  appIndex = -1;
  get appTabWidth(): number { return typeof window !== 'undefined' && window.innerWidth <= 760 ? 52 : 132; }

  private updateIndex(url: string): void {
    this.appIndex = url.startsWith('/favourites') ? 0 : url.startsWith('/my-trips') ? 1 : url.startsWith('/my-journals') ? 2 : -1;
    if (url.startsWith('/features'))       this.navIndex = 1;
    else if (url.startsWith('/community')) this.navIndex = 2;
    else if (url.startsWith('/pricing'))   this.navIndex = 3;
    else if (url === '/' || url.startsWith('/home') || url.startsWith('/v2') || url.startsWith('/#')) this.navIndex = 0;
    else                                   this.navIndex = -1;   // e.g. Download, Privacy: nothing highlighted

    this.hideSearchBar = url.startsWith('/my-trips') || url.startsWith('/favourites') || url.startsWith('/my-journals');
    this.isCommunityPage = url.startsWith('/community');
    this.isStaticLandingPage = url.startsWith('/features') || url.startsWith('/pricing');
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrolled = window.scrollY > 50;
  }

  private initAutocomplete(): void {
    if (this.initialized) return;
    if (typeof google !== 'undefined' && google.maps?.places) {
      this.autocompleteService = new google.maps.places.AutocompleteService();
      this.initialized = true;

      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(value => value.length >= 2)
      ).subscribe(value => {
        this.autocompleteService.getPlacePredictions(
          { input: value },
          (predictions: any[], status: string) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              const allowedTypes = ['locality', 'administrative_area_level_1', 'country'];
              this.predictions = predictions
                .filter((pred: any) => pred.types?.some((type: string) => allowedTypes.includes(type)))
                .sort((a: any, b: any) => {
                  const priority = (types: string[]) => {
                    if (types.includes('locality')) return 1;
                    if (types.includes('administrative_area_level_1')) return 2;
                    if (types.includes('country')) return 3;
                    return 4;
                  };
                  return priority(a.types) - priority(b.types);
                });
              this.showDropdown = this.predictions.length > 0;
            } else {
              this.predictions = [];
              this.showDropdown = false;
            }
          }
        );
      });
    }
  }

  onSearchInput(event: Event): void {
    this.initAutocomplete();
    const value = (event.target as HTMLInputElement).value;
    if (value.length < 2) {
      this.predictions = [];
      this.showDropdown = false;
      return;
    }
    this.searchSubject.next(value);
  }

  onLocalSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.localSearchInput.emit(value);
  }

  selectPlace(prediction: any): void {
    this.predictions = [];
    this.showDropdown = false;
    this.searchActive = false;
    this.router.navigate(['/destination', prediction.place_id], {
      state: { destinationName: prediction.structured_formatting?.main_text || prediction.description }
    });
  }

  onBlur(): void {
    this.blurTimeout = setTimeout(() => {
      this.showDropdown = false;
      this.mobileSearchOpen = false;
    }, 200);
  }



  onFavouritesClick(): void {
    this.router.navigate(['/favourites']);
  }

  goTo(path: string): void {
    this.showUserMenu = false;
    this.router.navigate([path]);
  }

  onTripsClick(): void {
    if (!this.authService.isLoggedIn) {
      this.openAuthModal();
      return;
    }
    this.router.navigate(['/my-trips']);
  }

  onJournalsClick(): void {
    if (!this.authService.isLoggedIn) {
      this.openAuthModal();
      return;
    }
    this.router.navigate(['/my-journals']);
  }

  onSignIn(): void {
    if (this.authService.isLoggedIn) {
      if (this.isCommunityPage) {
        this.router.navigate(['/my-journals']);
      } else {
        this.router.navigate(['/my-trips']);
      }
    } else {
      this.openAuthModal();
    }
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu(): void {
    setTimeout(() => {
      this.showUserMenu = false;
    }, 150);
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      this.toastr.info('Signed out successfully');
    } finally {
      this.showUserMenu = false;
    }
  }

  getTripCapsuleLabel(): string {
    if (!this.existingTrip) return '';
    const name = this.existingTrip.name || `${this.destinationName} Trip`;
    if (this.existingTrip.startDate && this.existingTrip.endDate) {
      const start = new Date(this.existingTrip.startDate);
      const end = new Date(this.existingTrip.endDate);
      const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (nights > 0) return `${name} · ${nights} night${nights !== 1 ? 's' : ''}`;
    }
    return name;
  }

  navigateToTrip(): void {
    if (!this.existingTrip) return;
    this.router.navigate(['/trip-planner', this.existingTrip.id], {
      state: {
        destination: this.destinationName,
        tripId: this.existingTrip.id,
        tripName: this.existingTrip.name,
        status: this.existingTrip.status,
        fromDate: this.existingTrip.startDate || null,
        toDate: this.existingTrip.endDate || null,
        travellers: this.existingTrip.travelersCount || 0
      }
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  scrollToSection(section: string): void {
    this.navIndex = 0; // Explore
    if (this.pillReady) this.syncPills();
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      this.router.navigate(['/']);
    }
  }

  backToDestination(): void {
    if (this.primaryDestinationPlaceId) {
      this.router.navigate(['/destination', this.primaryDestinationPlaceId]);
    } else {
      this.router.navigate(['/']);
    }
  }

  getUserInitial(): string {
    const name = this.authService.currentUser?.name;
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  private openAuthModal(): void {
    const dialogRef = this.dialog.open(AuthGateModalComponent, {
      data: { destination: this.destinationName },
      panelClass: 'auth-gate-dialog',
      maxWidth: '500px',
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.type === 'authenticated') {
        // User is now logged in, UI updates reactively
      }
    });
  }
}
