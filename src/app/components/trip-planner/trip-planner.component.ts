import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { DestinationService } from '../../services/destination.service';
import { PlaceCategoriesResponse, PlaceDto } from '../../models/destination.model';
import { FavouritesService, FavouriteItem } from '../../services/favourites.service';
import { TripService } from '../../services/trip.service';

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

  // Destination data
  destinationData: PlaceCategoriesResponse | null = null;
  loading = true;

  // Itinerary
  itinerary: PlaceDto[] = [];

  // Active tab
  activeTab: 'overview' | 'itinerary' | 'budget' | 'checklist' | 'travellers' | 'favourites' = 'overview';
  expandedFavId: string | null = null;
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
    private tripService: TripService
  ) {}

  ngOnInit(): void {
    const state = history.state;
    const routeTripId = this.route.snapshot.paramMap.get('tripId');

    this.user = state?.user || this.authService.currentUser;
    this.destination = state?.destination || '';
    this.placeId = state?.placeId || '';
    this.isGuest = state?.isGuest || false;
    this.greeting = this.getGreeting();

    // If tripId in URL, load from API (handles back navigation / bookmarks)
    const tripId = routeTripId || state?.tripId;
    if (tripId) {
      this.tripId = tripId;
      // If we have state data use it, otherwise fetch from API
      if (state?.tripName) {
        this.tripName = state.tripName;
        this.tripStatus = this.mapStatus(state.status || '');
        this.fromDate = state.fromDate || null;
        this.toDate = state.toDate || null;
        this.travellers = state.travellers || 0;
        // Update URL to include tripId without triggering re-navigation
        window.history.replaceState(state, '', `/trip-planner/${tripId}`);
      } else {
        this.tripService.getTrip(tripId).subscribe({
          next: (trip) => {
            this.tripName = trip.name;
            this.tripStatus = this.mapStatus(trip.status);
            this.fromDate = trip.startDate || null;
            this.toDate = trip.endDate || null;
            this.travellers = trip.travelersCount || 0;
            this.destination = this.destination || trip.primaryDestination || '';
          }
        });
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

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
