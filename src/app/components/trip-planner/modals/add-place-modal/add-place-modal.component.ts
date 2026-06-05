import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { TripService, CreateTripPlaceDto, TripPlaceDetailResponse } from '../../../../services/trip.service';

declare var google: any;

export interface AddPlaceModalData {
  tripId: string;
  destinationId: string;
  destinationName: string;
  activeTab: 'stays' | 'food' | 'activities';
  latitude?: number;
  longitude?: number;
}

export interface AddPlaceModalResult {
  place: TripPlaceDetailResponse;
}

@Component({
  selector: 'app-add-place-modal',
  templateUrl: './add-place-modal.component.html',
  styleUrls: ['./add-place-modal.component.scss'],
  standalone: false
})
export class AddPlaceModalComponent {
  addPlaceSearch = '';
  addPlacePredictions: any[] = [];
  addPlaceShowDropdown = false;
  addingPlaceId: string | null = null;

  private addPlaceSubject = new Subject<string>();
  private initialized = false;

  constructor(
    public dialogRef: MatDialogRef<AddPlaceModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddPlaceModalData,
    private tripService: TripService
  ) {
    this.initAutocomplete();
  }

  private initAutocomplete(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.addPlaceSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => v.length >= 2)
    ).subscribe(value => this.runSearch(value));
  }

  private getCategoryForTab(): string {
    if (this.data.activeTab === 'stays') return 'stay';
    if (this.data.activeTab === 'food') return 'food';
    return 'activity';
  }

  private getPlaceTypeForTab(): string {
    if (this.data.activeTab === 'stays') return 'lodging';
    if (this.data.activeTab === 'food') return 'restaurant';
    return 'tourist_attraction';
  }

  private runSearch(query: string): void {
    if (typeof google === 'undefined' || !google.maps?.places) return;
    const mapDiv = document.createElement('div');
    const service = new google.maps.places.PlacesService(mapDiv);
    const request: any = { query, type: this.getPlaceTypeForTab() };
    if (this.data.latitude && this.data.longitude) {
      request.location = new google.maps.LatLng(this.data.latitude, this.data.longitude);
      request.radius = 50000;
    }
    service.textSearch(request, (results: any[], status: string) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        this.addPlacePredictions = results.slice(0, 5).map(r => ({
          place_id: r.place_id,
          name: r.name,
          rating: r.rating,
          user_ratings_total: r.user_ratings_total,
          vicinity: r.vicinity || r.formatted_address || '',
          photos: r.photos,
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

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.addPlaceSearch = value;
    if (value.length < 2) {
      this.addPlacePredictions = [];
      this.addPlaceShowDropdown = false;
      return;
    }
    this.addPlaceSubject.next(value);
  }

  onBlur(): void {
    setTimeout(() => { this.addPlaceShowDropdown = false; }, 200);
  }

  addPlace(prediction: any): void {
    if (this.addingPlaceId) return;
    this.addingPlaceId = prediction.place_id;

    const photoUrl = prediction.photos?.[0]?.getUrl?.({ maxWidth: 400 }) || null;

    const dto: CreateTripPlaceDto = {
      placeId: prediction.place_id,
      placeName: prediction.name,
      vicinity: prediction.vicinity || prediction.structured_formatting.secondary_text || null,
      rating: prediction.rating || null,
      userRatingsTotal: prediction.user_ratings_total || null,
      photoUrl,
      category: this.getCategoryForTab(),
      notes: null
    };

    this.tripService.addPlace(this.data.tripId, this.data.destinationId, dto).subscribe({
      next: (res) => {
        this.addingPlaceId = null;
        // Return the added place so the parent can update the list
        const addedPlace: TripPlaceDetailResponse = {
          id: res.id,
          placeId: dto.placeId,
          placeName: dto.placeName,
          vicinity: dto.vicinity,
          rating: dto.rating,
          userRatingsTotal: dto.userRatingsTotal,
          photoUrl: dto.photoUrl,
          category: dto.category,
          notes: null
        };
        this.dialogRef.close({ place: addedPlace } as AddPlaceModalResult);
      },
      error: () => {
        this.addingPlaceId = null;
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
