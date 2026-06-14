import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { DestinationService } from '../../services/destination.service';
import { PlaceCategoriesResponse, PlaceDto } from '../../models/destination.model';
import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';
import { TripPlanModalComponent } from '../trip-planner/modals/trip-plan-modal/trip-plan-modal.component';
import { AddToTripModalComponent, AddToTripModalData, AddToTripModalResult } from '../add-to-trip-modal/add-to-trip-modal.component';
import { TripService, TripResponse } from '../../services/trip.service';
import { AuthService } from '../../services/auth.service';
import { FavouritesService, FavouriteItem } from '../../services/favourites.service';
import { LoaderService } from '../../services/loader.service';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

declare var google: any;

@Component({
  selector: 'app-destination',
  templateUrl: './destination.component.html',
  styleUrls: ['./destination.component.scss'],
  standalone: false
})
export class DestinationComponent implements OnInit, AfterViewInit, OnDestroy {
  destination: PlaceCategoriesResponse | null = null;
  loading = true;
  error: string | null = null;
  placeId: string = '';
  heroImages: string[] = [];
  currentSlide = 0;
  tripCardTab: 'stays' | 'food' | 'explore' = 'stays';
  checkinDate: Date | null = null;
  checkoutDate: Date | null = null;
  reservationDate: Date | null = null;
  private slideInterval: any;

  // Chip definitions
  foodChips = ['All', 'Fine Dining', 'Cafes', 'Street Food', 'Bars', 'Rooftop'];
  staysChips = ['All', 'Hotels', 'Resorts', 'Boutique', 'Hostels', 'Villas'];
  tourismChips = ['All', 'Temples', 'Museums', 'Beaches', 'Adventure', 'Nightlife'];

  // Active chip per section
  activeFoodChip = 'All';
  activeStaysChip = 'All';
  activeTourismChip = 'All';

  // Active content tab
  activeSection: 'stays' | 'food' | 'attractions' = 'stays';

  // Per-category loading flags
  foodLoading = false;
  staysLoading = false;
  tourismLoading = false;

  // Cache: stores the base (All) results per category so chip "All" never re-fetches
  private categoryCache: Partial<Record<'stays' | 'food' | 'attractions', PlaceDto[]>> = {};

  // ===== MAP =====
  @ViewChild('destMapContainer', { static: false }) destMapContainer!: ElementRef;
  private destMap: any = null;
  private destMarkers: any[] = [];
  private destMapReady = false;

  get tabInkTransform(): string {
    const index = { stays: 0, food: 1, attractions: 2 }[this.activeSection];
    return `translateX(${index * 100}%)`;
  }

  /** Places currently visible in the active tab — used to pin map markers */
  get activePlaces(): PlaceDto[] {
    if (!this.destination) return [];
    if (this.activeSection === 'stays') return this.destination.lodging;
    if (this.activeSection === 'food') return this.destination.restaurants;
    return this.destination.touristAttractions;
  }

  setActiveSection(tab: 'stays' | 'food' | 'attractions'): void {
    this.activeSection = tab;
    this.loadCategoryIfNeeded(tab);
    // markers update after data loads — triggered from applyCategoryCache
  }

  // Destination search
  destPredictions: any[] = [];
  showDestDropdown = false;
  leftSearchActive = false;
  favourites = new Set<string>(); // kept for template compatibility
  existingTrip: TripResponse | null = null;
  selectedPlace: PlaceDto | null = null;
  panelOpen = false;
  private destSearchSubject = new Subject<string>();
  private destAutocompleteService: any;
  private destBlurTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private destinationService: DestinationService,
    private dialog: MatDialog,
    private authService: AuthService,
    public favouritesService: FavouritesService,
    private tripService: TripService,
    private loaderService: LoaderService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.placeId = params.get('placeId') || '';
      if (this.placeId) {
        // Reset everything on destination change
        this.destination = null;
        this.heroImages = [];
        this.currentSlide = 0;
        this.loading = true;
        this.existingTrip = null;
        this.categoryCache = {};
        this.activeSection = 'stays';
        this.activeFoodChip = 'All';
        this.activeStaysChip = 'All';
        this.activeTourismChip = 'All';

        this.loadDestinationMeta();
      }
    });
  }

  /** Bootstraps the destination from router state (name) + lazy place fetching. No /search call needed. */
  loadDestinationMeta(): void {
    this.loading = true;
    this.error = null;

    // Name comes from router state when navigating via autocomplete — free, no API call
    const nav = window.history.state;
    const nameFromState: string = nav?.destinationName || '';

    // Build a minimal destination object immediately so the header renders without waiting
    this.destination = {
      placeId: this.placeId,
      name: nameFromState,
      formattedAddress: '',
      geometry: { latitude: 0, longitude: 0 },
      restaurants: [],
      lodging: [],
      touristAttractions: []
    };

    // If no name in state (direct URL / bookmark), resolve it from Google Places SDK
    if (!nameFromState) {
      this.resolveNameFromPlacesSDK();
    }

    this.loaderService.show('Discovering this destination...');

    this.authService.authReady.then(() => {
      if (this.authService.isLoggedIn) {
        this.authService.getFirebaseToken().then(token => {
          if (token) {
            this.tripService.getTripByDestination(this.placeId).subscribe({
              next: (trip) => { this.existingTrip = trip; },
              error: () => { this.existingTrip = null; }
            });
            this.tripService.getAllTrips().subscribe({
              next: (trips) => { this.allTrips = trips.filter(t => t.status?.toLowerCase() !== 'completed'); }
            });
          }
        });
      }
    });

    // Only one places call on load — the default tab (stays)
    this.loadCategoryIfNeeded('stays');

    this.loading = false;
    this.loaderService.hide();

    setTimeout(() => {
      this.initAnimations();
      this.initDestSearch();
    }, 50);
  }

  /** Fallback: resolve destination name from Google Places SDK when no router state is available */
  private resolveNameFromPlacesSDK(): void {
    const tryResolve = () => {
      if (typeof google === 'undefined' || !google.maps?.places) {
        // SDK not ready yet — retry once after a short delay
        setTimeout(() => tryResolve(), 500);
        return;
      }
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      service.getDetails(
        { placeId: this.placeId, fields: ['name'] },
        (result: any, status: string) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && result?.name) {
            if (this.destination) {
              this.destination = { ...this.destination, name: result.name };
            }
          }
        }
      );
    };
    tryResolve();
  }

  /** Fetches a category only if not already cached; restores from cache on repeat visits */
  private loadCategoryIfNeeded(tab: 'stays' | 'food' | 'attractions'): void {
    if (this.categoryCache[tab]) {
      this.applyCategoryCache(tab);
      return;
    }

    const categoryParam = tab === 'stays' ? 'stays'
      : tab === 'food' ? 'restaurants'
      : 'attractions';

    this.setTabLoading(tab, true);

    this.destinationService.getPlacesByCategory(this.placeId, categoryParam as any).subscribe({
      next: (places) => {
        this.categoryCache[tab] = places;
        this.applyCategoryCache(tab);
        this.setTabLoading(tab, false);
      },
      error: () => { this.setTabLoading(tab, false); }
    });
  }

  private applyCategoryCache(tab: 'stays' | 'food' | 'attractions'): void {
    if (!this.destination) return;
    const places = this.categoryCache[tab] ?? [];
    if (tab === 'stays')       this.destination.lodging = places;
    else if (tab === 'food')   this.destination.restaurants = places;
    else                       this.destination.touristAttractions = places;

    // If destination geometry is still 0,0 and we now have places with real coords, use them
    if (
      this.destination.geometry.latitude === 0 &&
      this.destination.geometry.longitude === 0 &&
      places.length > 0 &&
      places[0].geometry?.latitude
    ) {
      this.destination = {
        ...this.destination,
        geometry: {
          latitude: places[0].geometry.latitude,
          longitude: places[0].geometry.longitude
        }
      };
      // Re-center the map now that we have real coordinates
      if (this.destMap) {
        this.destMap.setCenter({
          lat: places[0].geometry.latitude,
          lng: places[0].geometry.longitude
        });
      }
    }

    // Update map markers whenever the displayed set changes
    if (this.destMapReady) this.updateDestMarkers();
  }
  private setTabLoading(tab: 'stays' | 'food' | 'attractions', state: boolean): void {
    if (tab === 'stays')       this.staysLoading = state;
    else if (tab === 'food')   this.foodLoading = state;
    else                       this.tourismLoading = state;

    // When the first data batch finishes loading, the sticky band is now visible
    // and the map container finally has real dimensions — force a resize + re-init.
    if (!state && !this.destMapReady && this.destMap) {
      setTimeout(() => {
        google.maps.event.trigger(this.destMap, 'resize');
        this.destMapReady = true;
        this.updateDestMarkers();
      }, 100);
    }

    // If map hasn't been initialised at all yet (e.g. Google SDK loaded after data),
    // kick off init now that the container is guaranteed to have size.
    if (!state && !this.destMap) {
      this.waitForGoogleMapsAndInit();
    }
  }

  private loadHeroImage(): void {
    this.destinationService.getHeroImage(this.placeId).subscribe({
      next: (data) => {
        this.heroImages = data.imageUrls || [];
        if (this.heroImages.length > 1) {
          this.startSlideshow();
        }
      },
      error: () => {
        this.heroImages = [];
      }
    });
  }

  private startSlideshow(): void {
    this.slideInterval = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % this.heroImages.length;
    }, 7000);
  }

  // ===== CHIP HANDLERS =====
  // "All" restores the cached base result — no network call.
  // Any other chip calls the filter endpoint within the category.

  onStaysChipClick(chip: string): void {
    this.activeStaysChip = chip;
    if (chip === 'All') { this.applyCategoryCache('stays'); return; }
    this.staysLoading = true;
    this.destinationService.filter(this.placeId, chip.toLowerCase()).subscribe({
      next: (data) => { if (this.destination) this.destination.lodging = data; this.staysLoading = false; },
      error: () => { this.staysLoading = false; }
    });
  }

  onFoodChipClick(chip: string): void {
    this.activeFoodChip = chip;
    if (chip === 'All') { this.applyCategoryCache('food'); return; }
    this.foodLoading = true;
    this.destinationService.filter(this.placeId, chip.toLowerCase()).subscribe({
      next: (data) => { if (this.destination) this.destination.restaurants = data; this.foodLoading = false; },
      error: () => { this.foodLoading = false; }
    });
  }

  onTourismChipClick(chip: string): void {
    this.activeTourismChip = chip;
    if (chip === 'All') { this.applyCategoryCache('attractions'); return; }
    this.tourismLoading = true;
    this.destinationService.filter(this.placeId, chip.toLowerCase()).subscribe({
      next: (data) => { if (this.destination) this.destination.touristAttractions = data; this.tourismLoading = false; },
      error: () => { this.tourismLoading = false; }
    });
  }

  getRatingStars(rating: number | null): string {
    if (!rating) return '—';
    return '⭐'.repeat(Math.round(rating));
  }

  // Destination search methods
  private initDestSearch(): void {
    this.destAutocompleteService = new google.maps.places.AutocompleteService();

    this.destSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(value => value.length >= 2)
    ).subscribe(value => {
      this.destAutocompleteService.getPlacePredictions(
        { input: value },
        (predictions: any[], status: string) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            const allowedTypes = ['locality', 'administrative_area_level_1', 'country'];
            this.destPredictions = predictions
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
            this.showDestDropdown = this.destPredictions.length > 0;
          } else {
            this.destPredictions = [];
            this.showDestDropdown = false;
          }
        }
      );
    });
  }

  onDestSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value.length < 2) {
      this.destPredictions = [];
      this.showDestDropdown = false;
      return;
    }
    this.destSearchSubject.next(value);
  }

  selectDestPlace(prediction: any): void {
    this.destPredictions = [];
    this.showDestDropdown = false;
    this.router.navigate(['/destination', prediction.place_id], {
      state: { destinationName: prediction.structured_formatting?.main_text || prediction.description }
    });
  }

  onDestBlur(): void {
    this.destBlurTimeout = setTimeout(() => {
      this.showDestDropdown = false;
    }, 200);
  }

  onLocalSearch(input: Event | string): void {
    const value = typeof input === 'string'
      ? input.toLowerCase()
      : (input.target as HTMLInputElement).value.toLowerCase();
    if (!value) return;
    // Scroll to matching section
    if (value.includes('stay') || value.includes('hotel') || value.includes('resort')) {
      this.scrollToSection('stays');
    } else if (value.includes('food') || value.includes('restaurant') || value.includes('eat') || value.includes('cafe')) {
      this.scrollToSection('food');
    } else if (value.includes('attract') || value.includes('tour') || value.includes('thing')) {
      this.scrollToSection('attractions');
    }
  }

  toggleFavourite(placeId: string): void {
    // Find the place in our data
    const allPlaces = [
      ...(this.destination?.restaurants || []),
      ...(this.destination?.lodging || []),
      ...(this.destination?.touristAttractions || [])
    ];
    const place = allPlaces.find(p => p.placeId === placeId);

    if (this.favouritesService.isFavourite(placeId)) {
      this.favouritesService.remove(placeId);
    } else if (place) {
      const category = this.destination!.restaurants.includes(place) ? 'restaurant'
        : this.destination!.lodging.includes(place) ? 'lodging'
        : 'tourist_attraction';

      this.favouritesService.add({
        placeId: place.placeId,
        placeName: place.name,
        vicinity: place.vicinity,
        rating: place.rating,
        userRatingsTotal: place.userRatingsTotal,
        photoUrl: place.photos.length > 0 ? place.photos[0].url : null,
        category
      });
    }
  }

  openPanel(place: PlaceDto): void {
    this.selectedPlace = place;
    this.panelOpen = true;
  }

  closePanel(): void {
    this.panelOpen = false;
  }

  onAddToItinerary(place: PlaceDto): void {
    // TODO: Add to itinerary logic
    console.log('Added to itinerary:', place.name);
  }

  // Add to Trip
  allTrips: TripResponse[] = [];
  placeDropdownId: string | null = null;

  openAddToTripModal(place: PlaceDto): void {
    if (!this.authService.isLoggedIn) {
      const authRef = this.dialog.open(AuthGateModalComponent, {
        data: { destination: this.destination?.name || '' },
        panelClass: 'auth-gate-dialog',
        maxWidth: '420px',
        width: '400px'
      });
      authRef.afterClosed().subscribe(result => {
        if (result?.type === 'authenticated') this.openAddToTripModal(place);
      });
      return;
    }

    const category = this.destination?.lodging.includes(place) ? 'stay'
      : this.destination?.restaurants.includes(place) ? 'food'
      : 'activity';

    const dialogRef = this.dialog.open(AddToTripModalComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        place,
        category,
        destinationName: this.destination?.name || ''
      } as AddToTripModalData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'create-new') {
        this.openTripPlanModal();
      }
      // AddToTripModalResult — place was added, button component auto-updates via tripsCache
    });
  }

  isPlaceInAnyTrip(placeId: string): boolean {
    return this.allTrips.some(t => t.placeIds?.includes(placeId));
  }

  getTripsContainingPlace(placeId: string): TripResponse[] {
    return this.allTrips.filter(t => t.placeIds?.includes(placeId));
  }

  isTripDisabledForPlace(tripId: string, placeId: string): boolean {
    const trip = this.allTrips.find(t => t.id === tripId);
    return trip?.placeIds?.includes(placeId) || false;
  }

  togglePlaceDropdown(placeId: string): void {
    this.placeDropdownId = this.placeDropdownId === placeId ? null : placeId;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.placeDropdownId = null;
  }

  openPlanTripModal(): void {
    // If existing trip found, go straight to it
    if (this.existingTrip) {
      this.router.navigate(['/trip-planner', this.existingTrip.id], {
        state: {
          user: this.authService.currentUser,
          destination: this.destination?.name || '',
          placeId: this.placeId,
          tripId: this.existingTrip.id,
          tripName: this.existingTrip.name,
          status: this.existingTrip.status,
          fromDate: this.existingTrip.startDate || null,
          toDate: this.existingTrip.endDate || null,
          travellers: this.existingTrip.travelersCount || 0
        }
      });
      return;
    }

    if (!this.authService.isLoggedIn) {
      const authRef = this.dialog.open(AuthGateModalComponent, {
        data: { destination: this.destination?.name || '' },
        panelClass: 'auth-gate-dialog',
        maxWidth: '420px',
        width: '400px'
      });
      authRef.afterClosed().subscribe(result => {
        if (result?.type === 'authenticated') {
          this.openTripPlanModal();
        }
      });
      return;
    }

    this.openTripPlanModal();
  }

  openTripPlanModalPublic(): void {
    this.openTripPlanModal();
  }

  private openTripPlanModal(): void {
    this.dialog.open(TripPlanModalComponent, {
      data: {
        destination: this.destination?.name || '',
        placeId: this.placeId,
        latitude: this.destination?.geometry?.latitude || null,
        longitude: this.destination?.geometry?.longitude || null,
        photoUrl: this.heroImages[0] || null
      },
      panelClass: 'auth-gate-dialog',
      maxWidth: '500px',
      width: '480px'
    });
  }

  getPriceLevel(level: number | null): string {
    if (!level) return '';
    return '$'.repeat(level);
  }

  getStayChips(types: string[], rating?: number | null, reviewCount?: number | null): string[] {
    // Type-based chips first (from Google)
    const chipMap: { [key: string]: string } = {
      'spa': 'Spa',
      'restaurant': 'Restaurant',
      'cafe': 'Café',
      'bar': 'Bar',
      'gym': 'Gym',
      'swimming_pool': 'Pool',
      'health': 'Wellness',
      'art_gallery': 'Art',
      'store': 'Shop'
    };
    const chips: string[] = types
      .filter(t => chipMap[t])
      .map(t => chipMap[t]);

    // Only add smart chips if we have less than 3 from Google
    if (chips.length < 3) {
      if (rating && rating >= 4.6) {
        chips.push('Highly Rated');
      }
    }
    if (chips.length < 3) {
      if (reviewCount && reviewCount >= 5000) {
        chips.push('Popular');
      }
    }

    return chips.slice(0, 3);
  }

  scrollToSection(sectionId: string): void {
    // With the tabbed layout, switch to the right tab and scroll to top of content
    if (sectionId === 'stays' || sectionId === 'food' || sectionId === 'attractions') {
      this.activeSection = sectionId;
    }
    // scroll to the tab bar so the content is visible
    setTimeout(() => {
      const el = document.querySelector('.section-tabs-bar');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
    this.waitForGoogleMapsAndInit();
  }

  // ===== MAP IMPLEMENTATION =====

  private waitForGoogleMapsAndInit(): void {
    if (typeof google !== 'undefined' && google.maps) {
      setTimeout(() => this.initDestMap(), 100);
    } else {
      const interval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          clearInterval(interval);
          this.initDestMap();
        }
      }, 200);
    }
  }

  private initDestMap(): void {
    if (typeof google === 'undefined' || !google.maps) return;
    if (!this.destMapContainer?.nativeElement) return;

    const el = this.destMapContainer.nativeElement;

    // If the container has no size yet (still in loading state), retry after a tick
    if (el.offsetWidth === 0 || el.offsetHeight === 0) {
      setTimeout(() => this.initDestMap(), 150);
      return;
    }

    const lat = this.destination?.geometry?.latitude || 48.8566;
    const lng = this.destination?.geometry?.longitude || 2.3522;

    this.destMap = new google.maps.Map(el, {
      center: { lat, lng },
      zoom: 13,
      mapTypeId: 'roadmap',
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        // Only hide noisy POI icons and transit lines — keep all natural colours
        { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
        { featureType: 'transit',             stylers: [{ visibility: 'off' }] },
        // Subtle road simplification — keep land/park/water at their natural Google colours
        { featureType: 'road',         elementType: 'geometry.stroke', stylers: [{ color: '#d6d6d6' }] },
        { featureType: 'road.highway', elementType: 'geometry',        stylers: [{ color: '#f5c542' }] },
        { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e0a800' }] },
        // Clean up label contrast slightly
        { elementType: 'labels.text.stroke',  stylers: [{ color: '#ffffff' }] },
        { elementType: 'labels.text.fill',    stylers: [{ color: '#555555' }] }
      ]
    });

    // Force tile re-render after first paint
    setTimeout(() => {
      google.maps.event.trigger(this.destMap, 'resize');
      this.destMap.setCenter({ lat, lng });
      this.destMapReady = true;
      this.injectCustomZoomControls(el);
      this.updateDestMarkers();
    }, 200);
  }

  /** Injects styled +/- zoom buttons into the map container */
  private injectCustomZoomControls(mapEl: HTMLElement): void {
    // Remove existing custom controls if re-initialised
    const existing = mapEl.querySelector('.dest-zoom-controls');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.className = 'dest-zoom-controls';
    wrap.innerHTML = `
      <button class="dest-zoom-btn" id="dest-zoom-in"  title="Zoom in">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <div class="dest-zoom-divider"></div>
      <button class="dest-zoom-btn" id="dest-zoom-out" title="Zoom out">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    `;

    // Inject styles once
    if (!document.getElementById('dest-zoom-style')) {
      const style = document.createElement('style');
      style.id = 'dest-zoom-style';
      style.textContent = `
        .dest-zoom-controls {
          position: absolute;
          bottom: 24px;
          right: 14px;
          display: flex;
          flex-direction: column;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.14);
          overflow: hidden;
          z-index: 10;
          border: 1px solid rgba(0,0,0,0.07);
        }
        .dest-zoom-btn {
          width: 36px;
          height: 36px;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
          transition: background 0.15s;
          padding: 0;
        }
        .dest-zoom-btn:hover { background: #f5f5f5; color: #e85d04; }
        .dest-zoom-divider {
          height: 1px;
          background: rgba(0,0,0,0.08);
          margin: 0 6px;
        }
      `;
      document.head.appendChild(style);
    }

    mapEl.style.position = 'relative';
    mapEl.appendChild(wrap);

    wrap.querySelector('#dest-zoom-in')!.addEventListener('click', () => {
      this.destMap.setZoom((this.destMap.getZoom() || 13) + 1);
    });
    wrap.querySelector('#dest-zoom-out')!.addEventListener('click', () => {
      this.destMap.setZoom((this.destMap.getZoom() || 13) - 1);
    });
  }

  updateDestMarkers(): void {
    if (!this.destMap || !this.destMapReady) return;

    // Clear existing markers
    this.destMarkers.forEach((m: any) => m.setMap(null));
    this.destMarkers = [];

    const places = this.activePlaces.filter(
      p => p.geometry?.latitude && p.geometry?.longitude
    );

    if (places.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    // Color + emoji per tab
    const tabConfig: Record<string, { color: string; darkColor: string; emoji: string }> = {
      stays:       { color: '#2563eb', darkColor: '#1d4ed8', emoji: '🏨' },
      food:        { color: '#e85d04', darkColor: '#c0392b', emoji: '🍽' },
      attractions: { color: '#16a34a', darkColor: '#15803d', emoji: '📍' }
    };
    const cfg = tabConfig[this.activeSection] || tabConfig['stays'];

    places.forEach((place, index) => {
      const position = {
        lat: place.geometry.latitude,
        lng: place.geometry.longitude
      };

      // Modern pill marker: colored background, white number, small tail
      const num = index + 1;
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
          <!-- Drop shadow -->
          <ellipse cx="18" cy="43" rx="7" ry="2.5" fill="rgba(0,0,0,0.18)"/>
          <!-- Pin body -->
          <path d="M18 0C10 0 4 6.3 4 14c0 10.5 14 28 14 28s14-17.5 14-28C32 6.3 26 0 18 0z"
                fill="${cfg.color}" stroke="${cfg.darkColor}" stroke-width="1"/>
          <!-- White circle -->
          <circle cx="18" cy="14" r="8" fill="white" opacity="0.95"/>
          <!-- Number -->
          <text x="18" y="18.5" text-anchor="middle"
                font-family="Poppins,Arial,sans-serif"
                font-size="9" font-weight="700"
                fill="${cfg.color}">${num}</text>
        </svg>`;

      const marker = new google.maps.Marker({
        position,
        map: this.destMap,
        title: place.name,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize: new google.maps.Size(36, 44),
          anchor: new google.maps.Point(18, 44)
        },
        zIndex: 100 - index   // first markers on top
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="font-family:Poppins,Arial,sans-serif;padding:4px 2px;min-width:140px;max-width:200px">
            <div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-bottom:2px;line-height:1.3">${place.name}</div>
            <div style="font-size:11px;color:#888;line-height:1.3">${place.vicinity || ''}</div>
            ${place.rating ? `<div style="font-size:11px;color:#555;margin-top:4px">⭐ <strong>${place.rating}</strong>${place.userRatingsTotal ? ` · <span style="color:#aaa">${place.userRatingsTotal} reviews</span>` : ''}</div>` : ''}
          </div>`
      });

      marker.addListener('click', () => {
        infoWindow.open(this.destMap, marker);
      });

      this.destMarkers.push(marker);
      bounds.extend(position);
    });

    // Fit map to markers
    if (this.destMarkers.length > 1) {
      this.destMap.fitBounds(bounds, { padding: 56 });
      google.maps.event.addListenerOnce(this.destMap, 'idle', () => {
        if (this.destMap.getZoom() > 15) this.destMap.setZoom(15);
      });
    } else if (this.destMarkers.length === 1) {
      this.destMap.setCenter(this.destMarkers[0].getPosition());
      this.destMap.setZoom(14);
    }
  }

  private initAnimations(): void {
    // Hero entrance
    gsap.from('.dest-hero-content h1', {
      y: 40,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      delay: 0.3,
    });

    gsap.from('.dest-hero-content .dest-address', {
      y: 20,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      delay: 0.6,
    });

    gsap.from('.dest-nav-tabs', {
      y: 20,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      delay: 0.8,
    });

    gsap.from('.dest-carousel', {
      y: 40,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      delay: 0.5,
    });

    // Sections fade in on scroll
    gsap.utils.toArray('.dest-section').forEach((section: any) => {
      gsap.from(section.querySelector('.section-header'), {
        scrollTrigger: {
          trigger: section,
          start: 'top 85%',
        },
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
      });

      gsap.from(section.querySelector('.chip-row'), {
        scrollTrigger: {
          trigger: section,
          start: 'top 80%',
        },
        y: 20,
        opacity: 0,
        duration: 0.5,
        delay: 0.2,
        ease: 'power2.out',
      });

      gsap.from(section.querySelectorAll('.place-card'), {
        scrollTrigger: {
          trigger: section,
          start: 'top 75%',
        },
        y: 50,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
      });
    });
  }

  ngOnDestroy(): void {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }
}
