import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { DestinationService } from '../../services/destination.service';
import { PlaceCategoriesResponse, PlaceDto } from '../../models/destination.model';
import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';
import { TripPlanModalComponent } from '../trip-plan-modal/trip-plan-modal.component';
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

  // Section loading
  foodLoading = false;
  staysLoading = false;
  tourismLoading = false;

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
        this.destination = null;
        this.heroImages = [];
        this.currentSlide = 0;
        this.loading = true;
        this.existingTrip = null;
        this.loadDestination();
        this.loadHeroImage();
      }
    });
  }

  loadDestination(): void {
    this.loading = true;
    this.error = null;
    this.loaderService.show('Discovering this destination...');

    this.destinationService.search(this.placeId).subscribe({
      next: (data) => {
        this.destination = data;
        this.authService.authReady.then(() => {
          if (!this.authService.isLoggedIn) { this.loading = false; this.loaderService.hide(); return; }
          return this.authService.getFirebaseToken().then(token => {
            if (!token) { this.loading = false; this.loaderService.hide(); return; }
            this.tripService.getTripByDestination(this.placeId).subscribe({
              next: (trip) => { this.existingTrip = trip; this.loading = false; this.loaderService.hide(); },
              error: () => { this.existingTrip = null; this.loading = false; this.loaderService.hide(); }
            });
          });
        });
        setTimeout(() => {
          this.initAnimations();
          this.initDestSearch();
        }, 50);
      },
      error: (err) => {
        this.error = 'Failed to load destination details. Please try again.';
        this.loading = false;
        this.loaderService.hide();
        console.error(err);
      }
    });
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

  onFoodChipClick(chip: string): void {
    this.activeFoodChip = chip;
    if (chip === 'All') {
      this.loadDestination();
      return;
    }
    this.foodLoading = true;
    this.destinationService.filter(this.placeId, chip.toLowerCase()).subscribe({
      next: (data) => {
        if (this.destination) {
          this.destination.restaurants = data;
        }
        this.foodLoading = false;
      },
      error: () => {
        this.foodLoading = false;
      }
    });
  }

  onStaysChipClick(chip: string): void {
    this.activeStaysChip = chip;
    if (chip === 'All') {
      this.loadDestination();
      return;
    }
    this.staysLoading = true;
    this.destinationService.filter(this.placeId, chip.toLowerCase()).subscribe({
      next: (data) => {
        if (this.destination) {
          this.destination.lodging = data;
        }
        this.staysLoading = false;
      },
      error: () => {
        this.staysLoading = false;
      }
    });
  }

  onTourismChipClick(chip: string): void {
    this.activeTourismChip = chip;
    if (chip === 'All') {
      this.loadDestination();
      return;
    }
    this.tourismLoading = true;
    this.destinationService.filter(this.placeId, chip.toLowerCase()).subscribe({
      next: (data) => {
        if (this.destination) {
          this.destination.touristAttractions = data;
        }
        this.tourismLoading = false;
      },
      error: () => {
        this.tourismLoading = false;
      }
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
    this.router.navigate(['/destination', prediction.place_id]);
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
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
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
