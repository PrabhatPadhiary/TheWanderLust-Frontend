import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { PlaceDto } from '../../models/destination.model';
import { TripService, TripResponse } from '../../services/trip.service';

@Component({
  selector: 'app-add-to-trip-btn',
  templateUrl: './add-to-trip-btn.component.html',
  styleUrls: ['./add-to-trip-btn.component.scss'],
  standalone: false
})
export class AddToTripBtnComponent {
  @Input() place!: PlaceDto;
  @Output() addToTrip = new EventEmitter<PlaceDto>();

  dropdownOpen = false;

  constructor(private tripService: TripService) {}

  get allTrips(): TripResponse[] {
    return this.tripService.tripsCache;
  }

  get isAdded(): boolean {
    return this.allTrips.some(t => t.placeIds?.includes(this.place.placeId));
  }

  get tripsContaining(): TripResponse[] {
    return this.allTrips.filter(t => t.placeIds?.includes(this.place.placeId));
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.dropdownOpen = !this.dropdownOpen;
  }

  onAddClick(event: Event): void {
    event.stopPropagation();
    this.addToTrip.emit(this.place);
  }

  onAddToAnotherClick(event: Event): void {
    event.stopPropagation();
    this.dropdownOpen = false;
    this.addToTrip.emit(this.place);
  }

  @HostListener('document:click')
  closeDropdown(): void {
    this.dropdownOpen = false;
  }
}
