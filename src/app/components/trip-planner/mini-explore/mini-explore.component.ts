import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { TripService, CreateTripPlaceDto, TripPlaceDetailResponse } from '../../../services/trip.service';
import { DestinationService } from '../../../services/destination.service';
import { PlaceDto } from '../../../models/destination.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-mini-explore',
  templateUrl: './mini-explore.component.html',
  styleUrls: ['./mini-explore.component.scss'],
  standalone: false
})
export class MiniExploreComponent implements OnChanges {
  @Input() tripId: string = '';
  @Input() destinationId: string = '';
  @Input() destinationName: string = '';
  @Input() googlePlaceId: string = '';
  @Input() activeTab: 'stays' | 'food' | 'activities' = 'stays';
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() existingPlaceIds: string[] = [];

  @Output() placeAdded = new EventEmitter<TripPlaceDetailResponse>();

  suggestions: PlaceDto[] = [];
  loading = false;
  addingPlaceId: string | null = null;
  showAll = false;

  private lastSearchKey = '';

  get visibleSuggestions(): PlaceDto[] {
    return this.showAll ? this.suggestions : this.suggestions.slice(0, 6);
  }

  get hasMore(): boolean {
    return !this.showAll && this.suggestions.length > 6;
  }

  get tabIcon(): string {
    if (this.activeTab === 'stays') return '🏨';
    if (this.activeTab === 'food') return '🍽️';
    return '🏛️';
  }

  constructor(
    private tripService: TripService,
    private destinationService: DestinationService,
    private toastr: ToastrService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    const key = `${this.googlePlaceId}_${this.activeTab}`;
    if (key !== this.lastSearchKey && this.googlePlaceId) {
      this.lastSearchKey = key;
      this.showAll = false;
      this.fetchSuggestions();
    }
  }

  private getCategoryParam(): 'restaurants' | 'stays' | 'attractions' {
    if (this.activeTab === 'stays') return 'stays';
    if (this.activeTab === 'food') return 'restaurants';
    return 'attractions';
  }

  private getCategoryForDto(): string {
    if (this.activeTab === 'stays') return 'stay';
    if (this.activeTab === 'food') return 'food';
    return 'activity';
  }

  private fetchSuggestions(): void {
    if (!this.googlePlaceId) {
      this.suggestions = [];
      return;
    }

    this.loading = true;
    this.suggestions = [];

    this.destinationService.getPlacesByCategory(this.googlePlaceId, this.getCategoryParam()).subscribe({
      next: (places) => {
        this.suggestions = places;
        this.loading = false;
      },
      error: () => {
        this.suggestions = [];
        this.loading = false;
      }
    });
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

    this.tripService.addPlace(this.tripId, this.destinationId, dto).subscribe({
      next: (res) => {
        this.addingPlaceId = null;
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
        this.placeAdded.emit(addedPlace);
        this.toastr.success(`${place.name} added to trip`);
      },
      error: () => {
        this.addingPlaceId = null;
        this.toastr.error('Failed to add place');
      }
    });
  }

  isAdded(placeId: string): boolean {
    return this.existingPlaceIds.includes(placeId);
  }
}
