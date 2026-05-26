import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TripService } from '../../services/trip.service';
import { ToastrService } from 'ngx-toastr';

export interface TripPlanModalData {
  destination: string;
  placeId: string;
  latitude?: number | null;
  longitude?: number | null;
  photoUrl?: string | null;
}

@Component({
  selector: 'app-trip-plan-modal',
  templateUrl: './trip-plan-modal.component.html',
  styleUrls: ['./trip-plan-modal.component.scss'],
  standalone: false
})
export class TripPlanModalComponent {
  fromDate: Date | null = null;
  toDate: Date | null = null;
  datesUndecided: boolean = false;
  travellers: number = 2;
  todayDate: Date = new Date();
  today: string = new Date().toISOString().split('T')[0];
  tripName: string = '';
  isLoading: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<TripPlanModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TripPlanModalData,
    private router: Router,
    private authService: AuthService,
    private tripService: TripService,
    private toastr: ToastrService
  ) {
    this.tripName = `A trip to ${data.destination}`;
  }

  toggleDatesUndecided(): void {
    this.datesUndecided = !this.datesUndecided;
    if (this.datesUndecided) {
      this.fromDate = null;
      this.toDate = null;
    }
  }

  increment(): void {
    if (this.travellers < 20) this.travellers++;
  }

  decrement(): void {
    if (this.travellers > 1) this.travellers--;
  }

  startPlanning(): void {
    if (this.isLoading) return;
    this.isLoading = true;

    const dto = {
      name: this.tripName || `A trip to ${this.data.destination}`,
      primaryDestination: this.data.destination,
      coverPhotoUrl: this.data.photoUrl || null,
      startDate: this.datesUndecided || !this.fromDate ? null : this.fromDate.toISOString().split('T')[0],
      endDate: this.datesUndecided || !this.toDate ? null : this.toDate.toISOString().split('T')[0],
      travelersCount: this.travellers,
      destination: {
        googlePlaceId: this.data.placeId,
        name: this.data.destination,
        latitude: this.data.latitude || 0,
        longitude: this.data.longitude || 0,
        photoUrl: this.data.photoUrl || null
      }
    };

    this.tripService.createTrip(dto).subscribe({
      next: (trip) => {
        this.isLoading = false;
        this.dialogRef.close();
        this.router.navigate(['/trip-planner'], {
          state: {
            user: this.authService.currentUser,
            destination: this.data.destination,
            placeId: this.data.placeId,
            tripId: trip.id,
            tripName: trip.name,
            fromDate: dto.startDate,
            toDate: dto.endDate,
            travellers: this.travellers
          }
        });
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error('Failed to create trip. Please try again.');
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
