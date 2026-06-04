import { Component, OnInit, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { DestinationService } from '../../services/destination.service';
import { PlaceCategoriesResponse, PlaceDto } from '../../models/destination.model';
import { FavouritesService, FavouriteItem } from '../../services/favourites.service';
import { TripService, CreateTripDestinationDto } from '../../services/trip.service';
import { LoaderService } from '../../services/loader.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

declare var google: any;

@Component({
  selector: 'app-trip-planner',
  templateUrl: './trip-planner.component.html',
  styleUrls: ['./trip-planner.component.scss'],
  standalone: false
})
export class TripPlannerComponent implements OnInit {
  user: UserResponse | null = null;
  destination: string = '';
  placeId: string = '';
  isGuest = false;
  greeting = '';

  // Trip data from API
  tripId: string = '';
  tripName: string = '';
  tripStatus: string = '';
  fromDate: string | null = null;
  toDate: string | null = null;
  travellers: number = 0;

  // Destinations list (primary + added)
  destinations: { id?: string; name: string; startDate: string | null; endDate: string | null; latitude?: number; longitude?: number }[] = [];
  primaryPlaceId: string = ''; // for back-to-destination nav

  // Add destination dialog
  showAddDestDialog = false;
  addDestStart: Date | null = null;
  addDestEnd: Date | null = null;
  editDestIndex: number | null = null;

  // Delete confirm
  showDeleteDestConfirm = false;
  deleteDestIndex: number | null = null;
  deleteDestName = '';

  // Destination search in dialog
  destSearchQuery = '';
  destSearchPredictions: any[] = [];
  destSearchShowDropdown = false;
  selectedDestPrediction: any = null;
  private destSearchSubject = new Subject<string>();
  private autocompleteService: any;
  private autocompleteInitialized = false;

  get fromDateObj(): Date | null {
    return this.fromDate ? new Date(this.fromDate) : null;
  }
  get toDateObj(): Date | null {
    return this.toDate ? new Date(this.toDate) : null;
  }

  // Destination data
  destinationData: PlaceCategoriesResponse | null = null;
  loading = true;
  tripLoading = true;
  deletingDestId: string | null = null;

  // Itinerary
  itinerary: PlaceDto[] = [];

  // Trip menu
  showTripMenu = false;
  showDeleteTripConfirm = false;
  deletingTrip = false;

  // Active destination for the detail panel
  activeDestIndex: number = 0;
  activeDestTab: 'stays' | 'food' | 'activities' = 'stays';
  // Sidebar tab
  activeTab: 'overview' | 'itinerary' | 'budget' | 'checklist' | 'travellers' | 'favourites' = 'overview';
  expandedFavId: string | null = null;

  // Add place modal
  showAddPlaceModal = false;
  addPlaceSearch = '';
  addPlacePredictions: any[] = [];
  addPlaceShowDropdown = false;
  addPlaceCustomName = '';
  addPlaceNotes = '';
  private addPlaceSubject = new Subject<string>();
  private addPlaceAutocompleteInit = false;
  favStackIndex: number = 0;
  isFavAnimating: boolean = false;

  advanceFavStack(): void {
    const total = this.favouritesService.favourites.length;
    if (total === 0 || this.isFavAnimating) return;
    this.isFavAnimating = true;
    setTimeout(() => {
      this.favStackIndex = (this.favStackIndex + 1) % total;
      this.isFavAnimating = false;
    }, 350);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private destinationService: DestinationService,
    private authService: AuthService,
    public favouritesService: FavouritesService,
    private tripService: TripService,
    private loaderService: LoaderService
  ) {}

  ngOnInit(): void {
    const state = history.state;
    const routeTripId = this.route.snapshot.paramMap.get('tripId');

    this.user = state?.user || this.authService.currentUser;
    this.destination = state?.destination || '';
    this.placeId = state?.placeId || '';
    this.primaryPlaceId = this.placeId;
    this.isGuest = state?.isGuest || false;
    this.greeting = this.getGreeting();

    // If tripId in URL, load from API (handles back navigation / bookmarks)
    const tripId = routeTripId || state?.tripId;
    if (tripId) {
      this.tripId = tripId;

      // Always load from API — handles fresh nav, back nav, refresh, and My Trips
      const load = () => {
        this.loaderService.show('Loading your trip...');
        this.tripService.getTrip(tripId).subscribe({
          next: (trip) => {
            this.tripName = trip.name;
            this.tripStatus = this.mapStatus(trip.status);
            this.fromDate = trip.startDate || null;
            this.toDate = trip.endDate || null;
            this.travellers = trip.travelersCount || 0;
            this.destination = this.destination || trip.primaryDestination || '';

            if (trip.destinations && trip.destinations.length > 0) {
              this.destinations = trip.destinations
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((d, i) => ({
                  id: d.id,
                  name: d.name,
                  latitude: d.latitude,
                  longitude: d.longitude,
                  startDate: d.startDate || (i === 0 ? (trip.startDate || null) : null),
                  endDate: d.endDate || (i === 0 ? (trip.endDate || null) : null)
                }));
              // Capture primary destination placeId for back navigation
              if (!this.primaryPlaceId && trip.destinations[0]?.googlePlaceId) {
                this.primaryPlaceId = trip.destinations[0].googlePlaceId;
              }
            } else {
              this.destinations = [{ name: this.destination, startDate: this.fromDate, endDate: this.toDate }];
            }
            this.tripLoading = false;
            this.loaderService.hide();
          },
          error: () => {
            if (!this.destinations.length && this.destination) {
              this.destinations = [{ name: this.destination, startDate: this.fromDate, endDate: this.toDate }];
            }
            this.tripLoading = false;
            this.loaderService.hide();
          }
        });
      };

      // If state has tripName, we can paint the header immediately from state
      // while the full API call runs in the background
      if (state?.tripName) {
        this.tripName = state.tripName;
        this.tripStatus = this.mapStatus(state.status || '');
        this.fromDate = state.fromDate || null;
        this.toDate = state.toDate || null;
        this.travellers = state.travellers || 0;
        this.tripLoading = false; // header data available from state immediately
        window.history.replaceState(state, '', `/trip-planner/${tripId}`);
        load(); // still fetch full destinations in background
      } else {
        load();
      }
    }

    if (this.placeId) {
      this.loadDestinationData();
    } else {
      this.loading = false;
    }
  }

  mapStatus(status: string): string {
    const map: Record<string, string> = {
      draft: 'Draft',
      planning: 'Planning',
      in_progress: 'In Progress',
      completed: 'Completed'
    };
    return map[status?.toLowerCase()] || 'Planning';
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(' ', '-');
  }

  private getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  private loadDestinationData(): void {
    this.loading = true;
    this.destinationService.search(this.placeId).subscribe({
      next: (data) => {
        this.destinationData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getUserName(): string {
    if (this.user?.name) return this.user.name.split(' ')[0];
    return 'Traveller';
  }

  getUserInitial(): string {
    return this.getUserName().charAt(0).toUpperCase();
  }

  addToItinerary(place: PlaceDto): void {
    if (!this.itinerary.find(p => p.placeId === place.placeId)) {
      this.itinerary.push(place);
    }
  }

  removeFromItinerary(placeId: string): void {
    this.itinerary = this.itinerary.filter(p => p.placeId !== placeId);
  }

  isInItinerary(placeId: string): boolean {
    return this.itinerary.some(p => p.placeId === placeId);
  }

  getRatingStars(rating: number | null): string {
    if (!rating) return '—';
    return '⭐'.repeat(Math.round(rating));
  }

  setActiveTab(tab: 'overview' | 'itinerary' | 'budget' | 'checklist' | 'travellers' | 'favourites'): void {
    this.activeTab = tab;
  }

  selectDest(index: number): void {
    this.activeDestIndex = index;
    this.activeDestTab = 'stays';
  }

  getDestTabIndex(): number {
    return ['stays', 'food', 'activities'].indexOf(this.activeDestTab);
  }

  openAddPlaceModal(): void {
    this.addPlaceSearch = '';
    this.addPlacePredictions = [];
    this.addPlaceShowDropdown = false;
    this.addPlaceCustomName = '';
    this.addPlaceNotes = '';
    this.showAddPlaceModal = true;
  }

  closeAddPlaceModal(): void {
    this.showAddPlaceModal = false;
  }

  private getPlaceTypeForTab(): string {
    if (this.activeDestTab === 'stays') return 'lodging';
    if (this.activeDestTab === 'food') return 'restaurant';
    return 'tourist_attraction';
  }

  private initAddPlaceAutocomplete(): void {
    if (this.addPlaceAutocompleteInit) return;
    this.addPlaceAutocompleteInit = true;
    this.addPlaceSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => v.length >= 2)
    ).subscribe(value => this.runAddPlaceSearch(value));
  }

  private runAddPlaceSearch(query: string): void {
    if (typeof google === 'undefined' || !google.maps?.places) return;
    const dest = this.destinations[this.activeDestIndex];
    const mapDiv = document.createElement('div');
    const service = new google.maps.places.PlacesService(mapDiv);
    const request: any = {
      query,
      type: this.getPlaceTypeForTab()
    };
    if (dest?.latitude && dest?.longitude) {
      request.location = new google.maps.LatLng(dest.latitude, dest.longitude);
      request.radius = 50000;
    }
    service.textSearch(request, (results: any[], status: string) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        this.addPlacePredictions = results.slice(0, 5).map(r => ({
          place_id: r.place_id,
          name: r.name,
          rating: r.rating,
          types: r.types,
          structured_formatting: {
            main_text: r.name,
            secondary_text: r.vicinity || r.formatted_address || ''
          }
        }));
        this.addPlaceShowDropdown = this.addPlacePredictions.length > 0;
      } else {
        this.addPlacePredictions = [];
        this.addPlaceShowDropdown = false;
      }
    });
  }

  onAddPlaceSearchInput(event: Event): void {
    this.initAddPlaceAutocomplete();
    const value = (event.target as HTMLInputElement).value;
    this.addPlaceSearch = value;
    if (value.length < 2) {
      this.addPlacePredictions = [];
      this.addPlaceShowDropdown = false;
      return;
    }
    this.addPlaceSubject.next(value);
  }

  onAddPlaceBlur(): void {
    setTimeout(() => { this.addPlaceShowDropdown = false; }, 200);
  }

  addPlaceFromPrediction(prediction: any): void {
    // For now just close — real implementation would save to trip
    this.addPlacePredictions = [];
    this.addPlaceShowDropdown = false;
    this.addPlaceSearch = prediction.structured_formatting.main_text;
  }

  confirmAddPlace(): void {
    // Placeholder — wire to API when ready
    this.closeAddPlaceModal();
  }

  toggleFavExpand(placeId: string): void {
    this.expandedFavId = this.expandedFavId === placeId ? null : placeId;
  }

  addFavToItinerary(item: FavouriteItem): void {
    const place: PlaceDto = {
      placeId: item.placeId,
      name: item.placeName,
      vicinity: item.vicinity,
      rating: item.rating,
      userRatingsTotal: item.userRatingsTotal,
      photos: item.photoUrl ? [{ url: item.photoUrl }] : [],
      types: [item.category],
      priceLevel: null,
      geometry: { latitude: 0, longitude: 0 }
    };
    this.addToItinerary(place);
  }

  openAddDestDialog(): void {
    this.addDestStart = null;
    this.addDestEnd = null;
    this.destSearchQuery = '';
    this.destSearchPredictions = [];
    this.destSearchShowDropdown = false;
    this.selectedDestPrediction = null;
    this.editDestIndex = null;
    this.showAddDestDialog = true;
  }

  openEditDestDialog(index: number): void {
    const dest = this.destinations[index];
    this.editDestIndex = index;
    this.destSearchQuery = dest.name;
    this.selectedDestPrediction = { structured_formatting: { main_text: dest.name, secondary_text: '' } };
    this.addDestStart = dest.startDate ? new Date(dest.startDate) : null;
    this.addDestEnd = dest.endDate ? new Date(dest.endDate) : null;
    this.destSearchPredictions = [];
    this.destSearchShowDropdown = false;
    this.showAddDestDialog = true;
  }

  closeAddDestDialog(): void {
    this.showAddDestDialog = false;
    this.editDestIndex = null;
  }

  openDeleteDestConfirm(index: number): void {
    this.deleteDestIndex = index;
    this.deleteDestName = this.destinations[index].name;
    this.showDeleteDestConfirm = true;
  }

  cancelDeleteDest(): void {
    this.showDeleteDestConfirm = false;
    this.deleteDestIndex = null;
    this.deleteDestName = '';
  }

  confirmDeleteDest(): void {
    if (this.deleteDestIndex === null) return;
    const dest = this.destinations[this.deleteDestIndex];
    const index = this.deleteDestIndex;
    this.cancelDeleteDest();

    if (dest.id && this.tripId) {
      this.deletingDestId = dest.id;
      this.loaderService.show('Removing destination...');
      this.tripService.deleteDestination(this.tripId, dest.id).subscribe({
        next: () => {
          this.destinations.splice(index, 1);
          this.deletingDestId = null;
          this.loaderService.hide();
        },
        error: () => {
          this.destinations.splice(index, 1);
          this.deletingDestId = null;
          this.loaderService.hide();
        }
      });
    } else {
      this.destinations.splice(index, 1);
    }
  }

  private initDestAutocomplete(): void {
    if (this.autocompleteInitialized) return;
    if (typeof google !== 'undefined' && google.maps?.places) {
      this.autocompleteService = new google.maps.places.AutocompleteService();
      this.autocompleteInitialized = true;

      this.destSearchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(v => v.length >= 2)
      ).subscribe(value => {
        this.autocompleteService.getPlacePredictions(
          { input: value },
          (predictions: any[], status: string) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              const allowed = ['locality', 'administrative_area_level_1', 'country'];
              this.destSearchPredictions = predictions.filter((p: any) =>
                p.types?.some((t: string) => allowed.includes(t))
              );
              this.destSearchShowDropdown = this.destSearchPredictions.length > 0;
            } else {
              this.destSearchPredictions = [];
              this.destSearchShowDropdown = false;
            }
          }
        );
      });
    }
  }

  onDestSearchInput(event: Event): void {
    this.initDestAutocomplete();
    const value = (event.target as HTMLInputElement).value;
    this.destSearchQuery = value;
    this.selectedDestPrediction = null;
    if (value.length < 2) {
      this.destSearchPredictions = [];
      this.destSearchShowDropdown = false;
      return;
    }
    this.destSearchSubject.next(value);
  }

  selectDestPrediction(prediction: any): void {
    this.selectedDestPrediction = prediction;
    this.destSearchQuery = prediction.structured_formatting.main_text;
    this.destSearchPredictions = [];
    this.destSearchShowDropdown = false;

    // Fetch place details to get lat/lng and photo
    if (typeof google !== 'undefined' && google.maps?.places) {
      const mapDiv = document.createElement('div');
      const placesService = new google.maps.places.PlacesService(mapDiv);
      placesService.getDetails(
        { placeId: prediction.place_id, fields: ['geometry', 'photos'] },
        (place: any, status: string) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            this.selectedDestPrediction = {
              ...prediction,
              latitude: place.geometry?.location?.lat() ?? null,
              longitude: place.geometry?.location?.lng() ?? null,
              photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 800 }) ?? null
            };
          }
        }
      );
    }
  }

  onDestSearchBlur(): void {
    setTimeout(() => { this.destSearchShowDropdown = false; }, 200);
  }

  confirmAddDest(): void {
    if (!this.selectedDestPrediction) return;
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const entry = {
      name: this.selectedDestPrediction.structured_formatting.main_text,
      startDate: this.addDestStart ? fmt(this.addDestStart) : null,
      endDate: this.addDestEnd ? fmt(this.addDestEnd) : null
    };

    if (this.editDestIndex !== null) {
      // Edit: update locally only
      this.destinations[this.editDestIndex] = entry;
      this.showAddDestDialog = false;
      this.editDestIndex = null;
    } else {
      // Add: call API then update locally
      this.showAddDestDialog = false;
      this.loaderService.show('Adding destination...');
      const dto: CreateTripDestinationDto = {
        googlePlaceId: this.selectedDestPrediction.place_id,
        name: entry.name,
        latitude: this.selectedDestPrediction.latitude ?? undefined,
        longitude: this.selectedDestPrediction.longitude ?? undefined,
        photoUrl: this.selectedDestPrediction.photoUrl ?? null,
        order: this.destinations.length,
        startDate: entry.startDate,
        endDate: entry.endDate
      };
      this.tripService.addDestination(this.tripId, dto).subscribe({
        next: (res) => {
          this.destinations.push({ id: res.id, ...entry, latitude: res.latitude, longitude: res.longitude });
          this.showAddDestDialog = false;
          this.loaderService.hide();
        },
        error: () => {
          this.destinations.push(entry);
          this.showAddDestDialog = false;
          this.loaderService.hide();
        }
      });
    }
  }

  getTripDuration(): string {
    if (!this.fromDate || !this.toDate) return '';
    const start = new Date(this.fromDate);
    const end = new Date(this.toDate);
    const diffMs = end.getTime() - start.getTime();
    const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (nights <= 0) return '';
    const days = nights + 1;
    return `${nights} night${nights !== 1 ? 's' : ''} · ${days} day${days !== 1 ? 's' : ''}`;
  }

  getDaysLeft(): number | null {
    if (!this.fromDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(this.fromDate);
    start.setHours(0, 0, 0, 0);
    const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showTripMenu) this.showTripMenu = false;
  }

  confirmDeleteTrip(): void {
    if (!this.tripId || this.deletingTrip) return;
    this.deletingTrip = true;
    this.loaderService.show('Deleting trip...');
    this.tripService.deleteTrip(this.tripId).subscribe({
      next: () => {
        this.deletingTrip = false;
        this.showDeleteTripConfirm = false;
        this.loaderService.hide();
        if (this.primaryPlaceId) {
          this.router.navigate(['/destination', this.primaryPlaceId]);
        } else {
          this.router.navigate(['/my-trips']);
        }
      },
      error: () => {
        this.deletingTrip = false;
        this.loaderService.hide();
      }
    });
  }

  goBackToDestination(): void {
    if (this.primaryPlaceId) {
      this.router.navigate(['/destination', this.primaryPlaceId]);
    } else {
      this.router.navigate(['/']);
    }
  }
}
