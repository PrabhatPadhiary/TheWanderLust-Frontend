import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TripService, TripResponse, CreateTripPlaceDto } from '../../services/trip.service';
import { PlaceDto } from '../../models/destination.model';

export interface AddToTripModalData {
  place: PlaceDto;
  category: string;
  destinationName: string;
}

export interface AddToTripModalResult {
  tripId: string;
  placeId: string;
}

@Component({
  selector: 'app-add-to-trip-modal',
  templateUrl: './add-to-trip-modal.component.html',
  styleUrls: ['./add-to-trip-modal.component.scss'],
  standalone: false
})
export class AddToTripModalComponent {
  allTrips: TripResponse[] = [];
  tripsLoading = true;
  selectedTripId = '';
  selectedDestinationIndex = 0;
  selectedTripDestinations: { id?: string; name: string }[] = [];
  addingToTrip = false;

  constructor(
    public dialogRef: MatDialogRef<AddToTripModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddToTripModalData,
    private tripService: TripService,
    private toastr: ToastrService
  ) {
    this.loadTrips();
  }

  private loadTrips(): void {
    this.tripsLoading = true;
    this.tripService.getAllTrips().subscribe({
      next: (trips) => {
        this.allTrips = trips.filter(t => t.status?.toLowerCase() !== 'completed');
        this.tripsLoading = false;
      },
      error: () => { this.tripsLoading = false; }
    });
  }

  isTripDisabled(tripId: string): boolean {
    const trip = this.allTrips.find(t => t.id === tripId);
    return trip?.placeIds?.includes(this.data.place.placeId) || false;
  }

  selectTrip(trip: TripResponse): void {
    if (this.isTripDisabled(trip.id)) return;
    this.selectedTripId = trip.id;
    this.selectedDestinationIndex = 0;

    const mapped = (trip.destinations || [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(d => ({ id: d.id, name: d.name }));

    if (mapped.length > 0 && mapped[0].id) {
      this.selectedTripDestinations = mapped;
    } else {
      this.selectedTripDestinations = mapped.length
        ? mapped
        : [{ name: trip.primaryDestination || trip.name }];

      this.tripService.getTrip(trip.id).subscribe({
        next: (full) => {
          const fullMapped = (full.destinations || [])
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map(d => ({ id: d.id, name: d.name }));
          this.selectedTripDestinations = fullMapped.length
            ? fullMapped
            : [{ name: full.primaryDestination || full.name }];
        }
      });
    }
  }

  getSelectedTrip(): TripResponse | undefined {
    return this.allTrips.find(t => t.id === this.selectedTripId);
  }

  confirm(): void {
    if (!this.selectedTripId || this.addingToTrip) return;
    const dest = this.selectedTripDestinations[this.selectedDestinationIndex];
    if (!dest?.id) return;

    const dto: CreateTripPlaceDto = {
      placeId: this.data.place.placeId,
      placeName: this.data.place.name,
      vicinity: this.data.place.vicinity,
      rating: this.data.place.rating,
      userRatingsTotal: this.data.place.userRatingsTotal,
      photoUrl: this.data.place.photos[0]?.url || null,
      category: this.data.category,
      notes: null,
      latitude: this.data.place.geometry?.latitude || null,
      longitude: this.data.place.geometry?.longitude || null
    };

    this.addingToTrip = true;
    this.tripService.addPlace(this.selectedTripId, dest.id, dto).subscribe({
      next: () => {
        this.addingToTrip = false;
        this.tripService.addPlaceIdToTrip(this.selectedTripId, this.data.place.placeId);
        const tripName = this.allTrips.find(t => t.id === this.selectedTripId)?.name || 'trip';
        this.toastr.success(`Added to ${tripName}`);
        this.dialogRef.close({ tripId: this.selectedTripId, placeId: this.data.place.placeId } as AddToTripModalResult);
      },
      error: () => {
        this.addingToTrip = false;
      }
    });
  }

  createNewTrip(): void {
    this.dialogRef.close('create-new');
  }

  get selectedDestination(): { id?: string; name: string } | undefined {
    return this.selectedTripDestinations[this.selectedDestinationIndex];
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
