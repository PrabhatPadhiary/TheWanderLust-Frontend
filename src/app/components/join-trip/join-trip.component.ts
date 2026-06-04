import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TripService } from '../../services/trip.service';

@Component({
  selector: 'app-join-trip',
  templateUrl: './join-trip.component.html',
  styleUrls: ['./join-trip.component.scss'],
  standalone: false
})
export class JoinTripComponent implements OnInit {
  status: 'loading' | 'success' | 'error' | 'login-required' = 'loading';
  errorMessage = '';

  private tripId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private tripService: TripService
  ) {}

  ngOnInit(): void {
    this.tripId = this.route.snapshot.paramMap.get('tripId') || '';

    if (!this.tripId) {
      this.status = 'error';
      this.errorMessage = 'Invalid invite link.';
      return;
    }

    // Wait for auth state to resolve
    this.authService.authReady.then(() => {
      if (!this.authService.currentUser) {
        // Not logged in — store the join URL and prompt login
        this.status = 'login-required';
        localStorage.setItem('pendingJoinTrip', this.tripId);
      } else {
        this.joinTrip();
      }
    });
  }

  joinTrip(): void {
    this.status = 'loading';
    this.tripService.joinTrip(this.tripId).subscribe({
      next: () => {
        this.status = 'success';
        localStorage.removeItem('pendingJoinTrip');
        // Redirect to the trip planner after a brief moment
        setTimeout(() => {
          this.router.navigate(['/trip-planner', this.tripId]);
        }, 1000);
      },
      error: (err) => {
        this.status = 'error';
        if (err?.status === 409) {
          // Already a member — just redirect
          this.router.navigate(['/trip-planner', this.tripId]);
        } else if (err?.status === 404) {
          this.errorMessage = 'This trip doesn\'t exist or the link has expired.';
        } else {
          this.errorMessage = 'Something went wrong. Please try again.';
        }
      }
    });
  }

  login(): void {
    this.authService.loginWithGoogle().subscribe({
      next: (result) => {
        if (result.success) {
          this.joinTrip();
        } else {
          this.status = 'error';
          this.errorMessage = 'Login failed. Please try again.';
        }
      },
      error: () => {
        this.status = 'error';
        this.errorMessage = 'Login failed. Please try again.';
      }
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
