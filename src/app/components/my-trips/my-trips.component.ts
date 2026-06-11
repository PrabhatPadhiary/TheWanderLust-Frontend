import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { TripService, TripResponse } from '../../services/trip.service';
import { AuthService } from '../../services/auth.service';
import { NavHistoryService } from '../../services/nav-history.service';
import { LoaderService } from '../../services/loader.service';
import { AddDestinationDialogComponent, AddDestinationDialogData, AddDestinationDialogResult } from '../trip-planner/modals/add-destination-dialog/add-destination-dialog.component';
import { TripPlanModalComponent, TripPlanModalData } from '../trip-planner/modals/trip-plan-modal/trip-plan-modal.component';

@Component({
  selector: 'app-my-trips',
  templateUrl: './my-trips.component.html',
  styleUrls: ['./my-trips.component.scss'],
  standalone: false
})
export class MyTripsComponent implements OnInit, OnDestroy {
  trips: TripResponse[] = [];
  loading = true;
  private sub = new Subscription();

  openMenuTripId: string | null = null;
  menuPosition = { top: 0, right: 0 };
  tripToDelete: TripResponse | null = null;
  deletingTrip = false;

  constructor(
    private tripService: TripService,
    private authService: AuthService,
    private router: Router,
    private location: Location,
    private navHistory: NavHistoryService,
    private loaderService: LoaderService,
    private dialog: MatDialog
  ) {}

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.openMenuTripId) this.openMenuTripId = null;
  }

  ngOnInit(): void {
    this.sub.add(
      this.tripService.trips$.subscribe(trips => { this.trips = trips; })
    );
    this.tripService.getAllTrips().subscribe({
      next: () => { this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  goBack(): void {
    this.navHistory.goBack();
  }

  openTrip(trip: TripResponse): void {
    this.router.navigate(['/trip-planner', trip.id], {
      state: {
        user: this.authService.currentUser,
        destination: trip.primaryDestination || '',
        tripId: trip.id,
        tripName: trip.name,
        status: trip.status,
        fromDate: trip.startDate || null,
        toDate: trip.endDate || null,
        travellers: trip.travelersCount || 0
      }
    });
  }

  getOpenTrip(): TripResponse | undefined {
    return this.trips.find(t => t.id === this.openMenuTripId);
  }

  toggleMenu(trip: TripResponse, event: Event): void {
    event.stopPropagation();
    if (this.openMenuTripId === trip.id) {
      this.openMenuTripId = null;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.menuPosition = {
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right
    };
    this.openMenuTripId = trip.id;
  }

  openDeleteConfirm(trip: TripResponse, event: Event): void {
    event.stopPropagation();
    this.openMenuTripId = null;
    this.tripToDelete = trip;
  }

  cancelDelete(): void {
    this.tripToDelete = null;
  }

  confirmDelete(): void {
    if (!this.tripToDelete || this.deletingTrip) return;
    this.deletingTrip = true;
    this.loaderService.show('Deleting trip...');
    this.tripService.deleteTrip(this.tripToDelete.id).subscribe({
      next: () => {
        this.deletingTrip = false;
        this.tripToDelete = null;
        this.loaderService.hide();
      },
      error: () => {
        this.deletingTrip = false;
        this.loaderService.hide();
      }
    });
  }

  mapStatus(status: string): string {
    const map: Record<string, string> = {
      draft: 'Draft', planning: 'Planning',
      in_progress: 'In Progress', completed: 'Completed'
    };
    return map[status?.toLowerCase()] || status;
  }

  getStatusClass(status: string): string {
    return status?.toLowerCase().replace('_', '-') || '';
  }

  openNewTrip(): void {
    const dialogRef = this.dialog.open(AddDestinationDialogComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        editMode: false,
        fromDate: null,
        toDate: null
      } as AddDestinationDialogData
    });

    dialogRef.afterClosed().subscribe((result: AddDestinationDialogResult | null) => {
      if (!result) return;
      const destName = result.prediction.structured_formatting.main_text;
      this.dialog.open(TripPlanModalComponent, {
        panelClass: 'custom-dialog-container',
        data: {
          destination: destName,
          placeId: result.prediction.place_id,
          latitude: result.prediction.latitude ?? null,
          longitude: result.prediction.longitude ?? null,
          photoUrl: result.prediction.photoUrl ?? null
        } as TripPlanModalData
      });
    });
  }
}
