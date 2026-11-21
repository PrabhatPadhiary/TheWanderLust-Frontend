import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { TripService, TripResponse, CreateTripPlaceDto } from '../../services/trip.service';
import { DestinationService, RegionResult } from '../../services/destination.service';
import { PlaceDto } from '../../models/destination.model';
import {
  FAR_FROM_TRIP_KM, LatLng, nearestStop, formatFarKm, isRegionResult, cityFromAddress,
} from '../../utils/trip-distance';

export interface AddToTripModalData {
  place: PlaceDto;
  category: string;
  destinationName: string;
  /**
   * The city the place is in, when the page already knows it (the destination
   * page you're browsing). Otherwise it's looked up from the place's address.
   */
  city?: { placeId: string; name: string } | null;
}

export interface AddToTripModalResult {
  tripId: string;
  placeId: string;
}

interface StopOption {
  id?: string;
  name: string;
  googlePlaceId?: string;
  order?: number;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * The place is far from every stop on the chosen trip. `city` is undefined
 * while it's looked up, null when it couldn't be found.
 */
interface FarInfo {
  km: number;
  nearName: string;
  city: { placeId: string; name: string } | null | undefined;
}

type FarChoice = 'stop' | 'new' | 'anyway';

/**
 * "Add to a trip": choose a trip, then the stop. When the place is more than
 * FAR_FROM_TRIP_KM from every stop (a Dubai place on a Bengaluru trip) it asks
 * what to do: add the place's city as a new stop (the default), start a new
 * trip, or add it anyway. Trips with a stop near the place are listed first.
 */
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
  selectedTripDestinations: StopOption[] = [];
  destsLoading = false;
  addingToTrip = false;

  far: FarInfo | null = null;
  farChoice: FarChoice | null = null;
  readonly formatFarKm = formatFarKm;

  private nearbyIds = new Set<string>();
  // A stop made by "Add <city> as a new stop", reused if saving the place fails and you retry.
  private createdStop: { tripId: string; cityId: string; stop: StopOption } | null = null;

  constructor(
    public dialogRef: MatDialogRef<AddToTripModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddToTripModalData,
    private tripService: TripService,
    private destinationService: DestinationService,
    private toastr: ToastrService
  ) {
    this.loadTrips();
  }

  private get point(): LatLng | null {
    const g = this.data.place.geometry;
    return g && Number.isFinite(g.latitude) && Number.isFinite(g.longitude) ? g : null;
  }

  private loadTrips(): void {
    this.tripsLoading = true;
    this.tripService.getAllTrips().subscribe({
      next: (trips) => {
        const active = trips.filter(t => t.status?.toLowerCase() !== 'completed');
        // Trips with a stop near the place first; the rest keep their order.
        const point = this.point;
        this.nearbyIds = new Set(active
          .filter(t => { const n = nearestStop(t.stops, point); return !!n && n.km <= FAR_FROM_TRIP_KM; })
          .map(t => t.id));
        this.allTrips = [
          ...active.filter(t => this.nearbyIds.has(t.id)),
          ...active.filter(t => !this.nearbyIds.has(t.id)),
        ];
        this.tripsLoading = false;
      },
      error: () => { this.tripsLoading = false; }
    });
  }

  isNearby(tripId: string): boolean {
    return this.nearbyIds.has(tripId);
  }

  isTripDisabled(tripId: string): boolean {
    const trip = this.allTrips.find(t => t.id === tripId);
    return trip?.placeIds?.includes(this.data.place.placeId) || false;
  }

  selectTrip(trip: TripResponse): void {
    if (this.isTripDisabled(trip.id)) return;
    this.selectedTripId = trip.id;
    this.selectedDestinationIndex = 0;
    this.selectedTripDestinations = [];
    this.far = null;
    this.farChoice = null;
    this.destsLoading = true;

    // The list has no stop details; load the trip for its stops.
    this.tripService.getTrip(trip.id).subscribe({
      next: (full) => {
        if (this.selectedTripId !== trip.id) return;
        this.destsLoading = false;
        this.applyTrip(full);
      },
      error: () => {
        if (this.selectedTripId !== trip.id) return;
        this.destsLoading = false;
        this.toastr.error('Could not load this trip. Try again.');
      }
    });
  }

  private applyTrip(full: TripResponse): void {
    const stops: StopOption[] = (full.destinations || [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(d => ({
        id: d.id, name: d.name, googlePlaceId: d.googlePlaceId, order: d.order ?? 0,
        latitude: d.latitude, longitude: d.longitude,
      }));
    this.selectedTripDestinations = stops.length ? stops : [{ name: full.primaryDestination || full.name }];

    // Default to the stop nearest the place.
    const nearest = nearestStop(stops, this.point);
    this.selectedDestinationIndex = nearest ? Math.max(0, stops.indexOf(nearest.stop)) : 0;
    if (!nearest || nearest.km <= FAR_FROM_TRIP_KM) return;

    this.far = { km: nearest.km, nearName: nearest.stop.name, city: undefined };
    const tripId = full.id;
    this.findCity().then(city => {
      if (this.selectedTripId !== tripId || !this.far) return;
      // The city is already a stop (one without coordinates): just use it.
      const existing = city ? stops.findIndex(s => s.googlePlaceId === city.placeId) : -1;
      if (existing >= 0) {
        this.far = null;
        this.selectedDestinationIndex = existing;
        return;
      }
      this.far = { ...this.far, city };
      if (city && !this.farChoice) this.farChoice = 'stop';
    });
  }

  /** The place's city: given by the page, else looked up near the place from its address. */
  private async findCity(): Promise<{ placeId: string; name: string } | null> {
    if (this.data.city?.placeId) return this.data.city;
    const point = this.point;
    const tried = new Set<string>();
    for (const name of cityFromAddress(this.data.place.vicinity)) {
      const key = name.toLowerCase();
      if (tried.has(key)) continue;
      tried.add(key);
      try {
        const found: RegionResult[] = await firstValueFrom(this.destinationService.searchRegions(
          name,
          point ? { lat: point.latitude as number, lng: point.longitude as number, radius: 60000 } : undefined
        ));
        const city = (found || []).find(r => isRegionResult(r) && r.name?.toLowerCase() !== this.data.place.name?.toLowerCase());
        if (city) return { placeId: city.placeId, name: city.name };
      } catch { /* try the next name */ }
    }
    return null;
  }

  getSelectedTrip(): TripResponse | undefined {
    return this.allTrips.find(t => t.id === this.selectedTripId);
  }

  get selectedDestination(): StopOption | undefined {
    return this.selectedTripDestinations[this.selectedDestinationIndex];
  }

  get farCity(): { placeId: string; name: string } | null {
    return this.far?.city || null;
  }

  /** Stop picker: shown unless a far place is going somewhere else. */
  get showStopPicker(): boolean {
    return !this.far || this.farChoice === 'anyway';
  }

  get anywayName(): string {
    return this.selectedTripDestinations.length > 1
      ? (this.getSelectedTrip()?.name || 'this trip')
      : (this.selectedDestination?.name || this.getSelectedTrip()?.name || 'this trip');
  }

  get canConfirm(): boolean {
    if (!this.selectedTripId || this.destsLoading || this.addingToTrip) return false;
    if (this.far) {
      if (this.farChoice === 'new') return true;
      if (this.farChoice === 'stop') return !!this.farCity;
      if (this.farChoice !== 'anyway') return false;
    }
    return !!this.selectedDestination?.id;
  }

  get confirmLabel(): string {
    if (this.addingToTrip) return 'Adding...';
    if (this.far && this.farChoice === 'stop' && this.farCity) return `Add ${this.farCity.name} as a stop`;
    if (this.far && this.farChoice === 'new') return 'Start a new trip';
    return 'Add to ' + (this.selectedDestination?.name || 'Trip');
  }

  async confirm(): Promise<void> {
    if (!this.canConfirm) return;
    if (this.far && this.farChoice === 'new') {
      this.createNewTrip();
      return;
    }

    const tripId = this.selectedTripId;
    this.addingToTrip = true;
    try {
      const dest = this.far && this.farChoice === 'stop'
        ? await this.addCityStop(tripId)
        : this.selectedDestination!;

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
      await firstValueFrom(this.tripService.addPlace(tripId, dest.id!, dto));

      this.addingToTrip = false;
      this.tripService.addPlaceIdToTrip(tripId, this.data.place.placeId);
      const tripName = this.allTrips.find(t => t.id === tripId)?.name || 'trip';
      this.toastr.success(this.createdStop?.stop.id === dest.id
        ? `Added ${dest.name} to ${tripName}`
        : `Added to ${tripName}`);
      this.dialogRef.close({ tripId, placeId: this.data.place.placeId } as AddToTripModalResult);
    } catch {
      this.addingToTrip = false;
      this.toastr.error('That place could not be added. Try again.');
    }
  }

  /** The place's city as a new stop at the end of the trip. */
  private async addCityStop(tripId: string): Promise<StopOption> {
    const city = this.farCity!;
    const made = this.createdStop;
    if (made && made.tripId === tripId && made.cityId === city.placeId) return made.stop;

    const details = await firstValueFrom(this.destinationService.getDetails(city.placeId)).catch(() => null);
    const nextOrder = this.selectedTripDestinations.reduce((max, d) => Math.max(max, d.order ?? 0), -1) + 1;
    const created = await firstValueFrom(this.tripService.addDestination(tripId, {
      googlePlaceId: city.placeId,
      name: city.name || details?.name || '',
      latitude: details?.geometry?.latitude,
      longitude: details?.geometry?.longitude,
      photoUrl: details?.photos?.[0]?.url || null,
      order: nextOrder,
    }));
    const stop: StopOption = { id: created.id, name: created.name || city.name };
    this.createdStop = { tripId, cityId: city.placeId, stop };
    return stop;
  }

  createNewTrip(): void {
    this.dialogRef.close('create-new');
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
