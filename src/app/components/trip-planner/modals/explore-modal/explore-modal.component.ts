import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { DestinationService } from '../../../../services/destination.service';
import { PlaceDto } from '../../../../models/destination.model';
import { TripService, CreateTripPlaceDto, TripPlaceDetailResponse } from '../../../../services/trip.service';
import { ToastrService } from 'ngx-toastr';

declare var google: any;

export interface ExploreModalData {
  tripId: string;
  destinationId: string;
  destinationName: string;
  googlePlaceId: string;
  activeTab: 'stays' | 'food' | 'activities';
  existingPlaceIds: string[];
  latitude?: number;
  longitude?: number;
}

export interface ExploreModalResult {
  addedPlaces: TripPlaceDetailResponse[];
}

@Component({
  selector: 'app-explore-modal',
  templateUrl: './explore-modal.component.html',
  styleUrls: ['./explore-modal.component.scss'],
  standalone: false
})
export class ExploreModalComponent implements OnInit {
  activeSection: 'stays' | 'food' | 'attractions' = 'stays';
  places: PlaceDto[] = [];
  loading = false;
  addingPlaceId: string | null = null;
  addedPlaceIds: string[] = [];
  addedPlaces: TripPlaceDetailResponse[] = [];
  addedCount = 0;

  // Search
  searchQuery = '';
  searchPredictions: any[] = [];
  showSearchDropdown = false;
  searchLoading = false;
  private searchSubject = new Subject<string>();

  // Chips
  staysChips = ['All', 'Hotels', 'Resorts', 'Boutique', 'Hostels', 'Villas'];
  foodChips = ['All', 'Fine Dining', 'Cafes', 'Street Food', 'Bars', 'Rooftop'];
  tourismChips = ['All', 'Temples', 'Museums', 'Beaches', 'Adventure', 'Nightlife'];
  activeChip = 'All';

  // Cache
  private categoryCache: Partial<Record<'stays' | 'food' | 'attractions', PlaceDto[]>> = {};

  get chips(): string[] {
    if (this.activeSection === 'stays') return this.staysChips;
    if (this.activeSection === 'food') return this.foodChips;
    return this.tourismChips;
  }

  get tabIcon(): string {
    if (this.activeSection === 'stays') return '🏨';
    if (this.activeSection === 'food') return '🍽️';
    return '🏛️';
  }

  constructor(
    public dialogRef: MatDialogRef<ExploreModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExploreModalData,
    private destinationService: DestinationService,
    private tripService: TripService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.addedPlaceIds = [...this.data.existingPlaceIds];

    // Map activeTab to section
    if (this.data.activeTab === 'stays') this.activeSection = 'stays';
    else if (this.data.activeTab === 'food') this.activeSection = 'food';
    else this.activeSection = 'attractions';

    this.loadCategory(this.activeSection);
    this.initSearch();
  }

  private initSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => v.length >= 2)
    ).subscribe(value => this.runSearch(value));
  }

  private runSearch(query: string): void {
    if (typeof google === 'undefined' || !google.maps?.places) return;
    this.searchLoading = true;
    const mapDiv = document.createElement('div');
    const service = new google.maps.places.PlacesService(mapDiv);
    const request: any = { query, type: this.getPlaceTypeForSection() };
    if (this.data.latitude && this.data.longitude) {
      request.location = new google.maps.LatLng(this.data.latitude, this.data.longitude);
      request.radius = 50000;
    }
    service.textSearch(request, (results: any[], status: string) => {
      this.searchLoading = false;
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        this.searchPredictions = results.slice(0, 8).map(r => ({
          placeId: r.place_id,
          name: r.name,
          vicinity: r.vicinity || r.formatted_address || '',
          rating: r.rating || null,
          userRatingsTotal: r.user_ratings_total || null,
          geometry: {
            latitude: r.geometry?.location?.lat() ?? null,
            longitude: r.geometry?.location?.lng() ?? null
          },
          photos: r.photos ? [{ url: r.photos[0]?.getUrl?.({ maxWidth: 400 }) || '' }] : [],
          types: r.types || [],
          priceLevel: r.price_level || null,
          _raw: r
        }));
        this.showSearchDropdown = this.searchPredictions.length > 0;
      } else {
        this.searchPredictions = [];
        this.showSearchDropdown = false;
      }
    });
  }

  private getPlaceTypeForSection(): string {
    if (this.activeSection === 'stays') return 'lodging';
    if (this.activeSection === 'food') return 'restaurant';
    return 'tourist_attraction';
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery = value;
    if (value.length < 2) {
      this.searchPredictions = [];
      this.showSearchDropdown = false;
      return;
    }
    this.searchSubject.next(value);
  }

  onSearchBlur(): void {
    setTimeout(() => { this.showSearchDropdown = false; }, 200);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchPredictions = [];
    this.showSearchDropdown = false;
  }

  setSection(section: 'stays' | 'food' | 'attractions'): void {
    this.activeSection = section;
    this.activeChip = 'All';
    this.clearSearch();
    this.loadCategory(section);
  }

  onChipClick(chip: string): void {
    this.activeChip = chip;
    if (chip === 'All') {
      this.places = this.categoryCache[this.activeSection] || [];
      return;
    }
    this.loading = true;
    this.destinationService.filter(this.data.googlePlaceId, chip.toLowerCase()).subscribe({
      next: (data) => { this.places = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  private loadCategory(section: 'stays' | 'food' | 'attractions'): void {
    if (this.categoryCache[section]) {
      this.places = this.categoryCache[section]!;
      return;
    }

    const categoryParam = section === 'stays' ? 'stays'
      : section === 'food' ? 'restaurants'
      : 'attractions';

    this.loading = true;
    this.destinationService.getPlacesByCategory(this.data.googlePlaceId, categoryParam as any).subscribe({
      next: (places) => {
        this.categoryCache[section] = places;
        this.places = places;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private getCategoryForDto(): string {
    if (this.activeSection === 'stays') return 'stay';
    if (this.activeSection === 'food') return 'food';
    return 'activity';
  }

  addPlace(place: PlaceDto): void {
    if (this.addingPlaceId || this.isAdded(place.placeId)) return;
    this.addingPlaceId = place.placeId;

    const photoUrl = place.photos?.length > 0 ? place.photos[0].url : null;

    const dto: CreateTripPlaceDto = {
      placeId: place.placeId,
      placeName: place.name,
      vicinity: place.vicinity || null,
      rating: place.rating,
      userRatingsTotal: place.userRatingsTotal,
      photoUrl,
      category: this.getCategoryForDto(),
      notes: null,
      latitude: place.geometry?.latitude || null,
      longitude: place.geometry?.longitude || null
    };

    this.tripService.addPlace(this.data.tripId, this.data.destinationId, dto).subscribe({
      next: (res) => {
        this.addingPlaceId = null;
        this.addedPlaceIds.push(place.placeId);
        this.addedCount++;
        const addedPlace: TripPlaceDetailResponse = {
          id: res.id,
          placeId: dto.placeId,
          placeName: dto.placeName,
          vicinity: dto.vicinity,
          rating: dto.rating,
          userRatingsTotal: dto.userRatingsTotal,
          photoUrl: dto.photoUrl,
          category: dto.category,
          notes: null,
          latitude: dto.latitude,
          longitude: dto.longitude
        };
        this.addedPlaces.push(addedPlace);
        this.toastr.success(`${place.name} added to trip`);
      },
      error: () => {
        this.addingPlaceId = null;
        this.toastr.error('Failed to add place');
      }
    });
  }

  addSearchResult(place: any): void {
    if (this.addingPlaceId || this.isAdded(place.placeId)) return;
    this.addingPlaceId = place.placeId;

    const photoUrl = place.photos?.length > 0 ? place.photos[0].url : null;

    const dto: CreateTripPlaceDto = {
      placeId: place.placeId,
      placeName: place.name,
      vicinity: place.vicinity || null,
      rating: place.rating,
      userRatingsTotal: place.userRatingsTotal,
      photoUrl,
      category: this.getCategoryForDto(),
      notes: null,
      latitude: place.geometry?.latitude || null,
      longitude: place.geometry?.longitude || null
    };

    this.tripService.addPlace(this.data.tripId, this.data.destinationId, dto).subscribe({
      next: (res) => {
        this.addingPlaceId = null;
        this.addedPlaceIds.push(place.placeId);
        this.addedCount++;
        const addedPlace: TripPlaceDetailResponse = {
          id: res.id,
          placeId: dto.placeId,
          placeName: dto.placeName,
          vicinity: dto.vicinity,
          rating: dto.rating,
          userRatingsTotal: dto.userRatingsTotal,
          photoUrl: dto.photoUrl,
          category: dto.category,
          notes: null,
          latitude: dto.latitude,
          longitude: dto.longitude
        };
        this.addedPlaces.push(addedPlace);
        this.toastr.success(`${place.name} added to trip`);
        this.showSearchDropdown = false;
        this.searchQuery = '';
      },
      error: () => {
        this.addingPlaceId = null;
        this.toastr.error('Failed to add place');
      }
    });
  }

  isAdded(placeId: string): boolean {
    return this.addedPlaceIds.includes(placeId);
  }

  close(): void {
    this.dialogRef.close({ addedPlaces: this.addedPlaces } as ExploreModalResult);
  }
}
