import { Component, OnInit, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService, UserResponse } from '../../services/auth.service';
import { DestinationService } from '../../services/destination.service';
import { PlaceCategoriesResponse, PlaceDto } from '../../models/destination.model';
import { FavouritesService, FavouriteItem } from '../../services/favourites.service';
import { TripService, CreateTripDestinationDto, TripMemberResponse, TripPlaceDetailResponse } from '../../services/trip.service';
import { LoaderService } from '../../services/loader.service';
import { AddPlaceModalComponent, AddPlaceModalData } from './modals/add-place-modal/add-place-modal.component';
import { AddDestinationDialogComponent, AddDestinationDialogData, AddDestinationDialogResult } from './modals/add-destination-dialog/add-destination-dialog.component';
import { DeleteTripConfirmComponent, DeleteTripConfirmData } from './modals/delete-trip-confirm/delete-trip-confirm.component';
import { DeleteDestinationConfirmComponent, DeleteDestinationConfirmData } from './modals/delete-destination-confirm/delete-destination-confirm.component';
import { InviteModalComponent, InviteModalData } from './modals/invite-modal/invite-modal.component';

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
  destinations: { id?: string; name: string; startDate: string | null; endDate: string | null; latitude?: number; longitude?: number; places?: TripPlaceDetailResponse[] }[] = [];
  primaryPlaceId: string = ''; // for back-to-destination nav

  // Trip members
  members: TripMemberResponse[] = [];
  showMembersDropdown = false;

  // Destination data
  destinationData: PlaceCategoriesResponse | null = null;
  loading = true;
  tripLoading = true;
  deletingDestId: string | null = null;

  // Itinerary
  itinerary: PlaceDto[] = [];

  // Trip menu
  showTripMenu = false;

  // Active destination for the detail panel
  activeDestIndex: number = 0;
  activeDestTab: 'stays' | 'food' | 'activities' = 'stays';
  managingDestinations = false;
  // Sidebar tab
  activeTab: 'overview' | 'itinerary' | 'budget' | 'checklist' | 'travellers' = 'overview';
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
    private dialog: MatDialog,
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
            this.members = trip.members || [];
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
                  endDate: d.endDate || (i === 0 ? (trip.endDate || null) : null),
                  places: d.places || []
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

  getMemberInitial(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
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

  setActiveTab(tab: 'overview' | 'itinerary' | 'budget' | 'checklist' | 'travellers'): void {
    this.activeTab = tab;
  }

  selectDest(index: number): void {
    this.activeDestIndex = index;
    this.activeDestTab = 'stays';
  }

  getDestTabIndex(): number {
    return ['stays', 'food', 'activities'].indexOf(this.activeDestTab);
  }

  getPlacesForActiveTab(): TripPlaceDetailResponse[] {
    const dest = this.destinations[this.activeDestIndex];
    if (!dest?.places) return [];
    const categoryMap: Record<string, string> = { stays: 'stay', food: 'food', activities: 'activity' };
    const cat = categoryMap[this.activeDestTab];
    return dest.places.filter(p => p.category === cat);
  }

  getAllPlaces(): TripPlaceDetailResponse[] {
    return this.destinations.reduce((acc, dest) => {
      if (dest.places) acc.push(...dest.places);
      return acc;
    }, [] as TripPlaceDetailResponse[]);
  }

  openAddPlaceModal(): void {
    const dest = this.destinations[this.activeDestIndex];
    if (!dest?.id || !this.tripId) return;

    const dialogRef = this.dialog.open(AddPlaceModalComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        tripId: this.tripId,
        destinationId: dest.id,
        destinationName: dest.name || '',
        activeTab: this.activeDestTab,
        latitude: dest.latitude,
        longitude: dest.longitude
      } as AddPlaceModalData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.place) {
        // Add the new place to the local destinations list so it appears immediately
        if (!dest.places) dest.places = [];
        dest.places.push(result.place);
      }
    });
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
    const dialogRef = this.dialog.open(AddDestinationDialogComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        editMode: false,
        fromDate: this.fromDate,
        toDate: this.toDate
      } as AddDestinationDialogData
    });

    dialogRef.afterClosed().subscribe((result: AddDestinationDialogResult | null) => {
      if (result) {
        this.handleAddDest(result);
      }
    });
  }

  openEditDestDialog(index: number): void {
    const dest = this.destinations[index];
    const dialogRef = this.dialog.open(AddDestinationDialogComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        editMode: true,
        name: dest.name,
        startDate: dest.startDate ? new Date(dest.startDate) : null,
        endDate: dest.endDate ? new Date(dest.endDate) : null,
        fromDate: this.fromDate,
        toDate: this.toDate
      } as AddDestinationDialogData
    });

    dialogRef.afterClosed().subscribe((result: AddDestinationDialogResult | null) => {
      if (result) {
        this.handleEditDest(index, result);
      }
    });
  }

  private handleAddDest(result: AddDestinationDialogResult): void {
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const entry = {
      name: result.prediction.structured_formatting.main_text,
      startDate: result.startDate ? fmt(result.startDate) : null,
      endDate: result.endDate ? fmt(result.endDate) : null
    };

    this.loaderService.show('Adding destination...');
    const dto: CreateTripDestinationDto = {
      googlePlaceId: result.prediction.place_id,
      name: entry.name,
      latitude: result.prediction.latitude ?? undefined,
      longitude: result.prediction.longitude ?? undefined,
      photoUrl: result.prediction.photoUrl ?? null,
      order: this.destinations.length,
      startDate: entry.startDate,
      endDate: entry.endDate
    };
    this.tripService.addDestination(this.tripId, dto).subscribe({
      next: (res) => {
        this.destinations.push({ id: res.id, ...entry, latitude: res.latitude, longitude: res.longitude });
        this.loaderService.hide();
      },
      error: () => {
        this.destinations.push(entry);
        this.loaderService.hide();
      }
    });
  }

  private handleEditDest(index: number, result: AddDestinationDialogResult): void {
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    this.destinations[index] = {
      ...this.destinations[index],
      name: result.prediction.structured_formatting.main_text,
      startDate: result.startDate ? fmt(result.startDate) : null,
      endDate: result.endDate ? fmt(result.endDate) : null
    };
  }

  openDeleteDestConfirm(index: number): void {
    const dest = this.destinations[index];
    const dialogRef = this.dialog.open(DeleteDestinationConfirmComponent, {
      panelClass: 'custom-dialog-container',
      data: { destinationName: dest.name } as DeleteDestinationConfirmData
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.performDeleteDest(index);
      }
    });
  }

  private performDeleteDest(index: number): void {
    const dest = this.destinations[index];
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
    if (this.showMembersDropdown) this.showMembersDropdown = false;
  }

  openDeleteTripConfirm(): void {
    const dialogRef = this.dialog.open(DeleteTripConfirmComponent, {
      panelClass: 'custom-dialog-container',
      data: { tripName: this.tripName } as DeleteTripConfirmData
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.performDeleteTrip();
      }
    });
  }

  openInviteModal(): void {
    this.dialog.open(InviteModalComponent, {
      panelClass: 'custom-dialog-container',
      data: { tripId: this.tripId, tripName: this.tripName || this.destination } as InviteModalData
    });
  }

  private performDeleteTrip(): void {
    if (!this.tripId) return;
    this.loaderService.show('Deleting trip...');
    this.tripService.deleteTrip(this.tripId).subscribe({
      next: () => {
        this.loaderService.hide();
        if (this.primaryPlaceId) {
          this.router.navigate(['/destination', this.primaryPlaceId]);
        } else {
          this.router.navigate(['/my-trips']);
        }
      },
      error: () => {
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
