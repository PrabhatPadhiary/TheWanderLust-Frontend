import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { TripService, TripResponse } from '../../services/trip.service';
import { AuthService } from '../../services/auth.service';
import { NavHistoryService } from '../../services/nav-history.service';

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

  constructor(
    private tripService: TripService,
    private authService: AuthService,
    private router: Router,
    private location: Location,
    private navHistory: NavHistoryService
  ) {}

  ngOnInit(): void {
    // Subscribe to the live cache so new trips appear instantly
    this.sub.add(
      this.tripService.trips$.subscribe(trips => {
        this.trips = trips;
      })
    );

    // Fetch from API (uses cache if already loaded)
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

  mapStatus(status: string): string {
    const map: Record<string, string> = {
      draft: 'Draft',
      planning: 'Planning',
      in_progress: 'In Progress',
      completed: 'Completed'
    };
    return map[status?.toLowerCase()] || status;
  }

  getStatusClass(status: string): string {
    return status?.toLowerCase().replace('_', '-') || '';
  }
}
