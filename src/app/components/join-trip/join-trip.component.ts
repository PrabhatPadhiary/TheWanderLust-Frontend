import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TripService, InvitationPreviewResponse } from '../../services/trip.service';

@Component({
  selector: 'app-join-trip',
  templateUrl: './join-trip.component.html',
  styleUrls: ['./join-trip.component.scss'],
  standalone: false
})
export class JoinTripComponent implements OnInit {
  status: 'loading' | 'preview' | 'joining' | 'success' | 'error' | 'login-required' = 'loading';
  errorMessage = '';
  invitation: InvitationPreviewResponse | null = null;

  private inviteId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private tripService: TripService
  ) {}

  ngOnInit(): void {
    // Route is /join/:tripId but the param is now an invitation ID
    this.inviteId = this.route.snapshot.paramMap.get('tripId') || '';

    if (!this.inviteId) {
      this.status = 'error';
      this.errorMessage = 'Invalid invite link.';
      return;
    }

    this.authService.authReady.then(() => {
      if (!this.authService.currentUser) {
        this.status = 'login-required';
        localStorage.setItem('pendingJoinTrip', this.inviteId);
      } else {
        this.loadPreview();
      }
    });
  }

  loadPreview(): void {
    this.status = 'loading';
    this.tripService.getInvitation(this.inviteId).subscribe({
      next: (res) => {
        this.invitation = res;
        this.status = 'preview';
      },
      error: (err) => {
        this.status = 'error';
        if (err?.status === 404) {
          this.errorMessage = 'This invitation doesn\'t exist or has been removed.';
        } else if (err?.error?.includes?.('expired')) {
          this.errorMessage = 'This invite link has expired. Ask the trip owner for a new one.';
        } else if (err?.error?.includes?.('already been used')) {
          this.errorMessage = 'This invite link has already been used.';
        } else {
          this.errorMessage = 'Something went wrong. Please try again.';
        }
      }
    });
  }

  joinTrip(): void {
    this.status = 'joining';
    this.tripService.joinTrip(this.inviteId).subscribe({
      next: (res: any) => {
        this.status = 'success';
        localStorage.removeItem('pendingJoinTrip');
        setTimeout(() => {
          this.router.navigate(['/trip-planner', res.id]);
        }, 1000);
      },
      error: (err) => {
        if (err?.status === 409) {
          // Already a member — redirect to trip
          const tripId = this.invitation?.trip?.id;
          if (tripId) {
            this.router.navigate(['/trip-planner', tripId]);
          } else {
            this.status = 'error';
            this.errorMessage = 'You are already a member of this trip.';
          }
        } else if (err?.status === 400) {
          this.status = 'error';
          this.errorMessage = err?.error || 'This invite link has expired or already been used.';
        } else {
          this.status = 'error';
          this.errorMessage = 'Something went wrong. Please try again.';
        }
      }
    });
  }

  get roleLabel(): string {
    if (!this.invitation) return '';
    return this.invitation.role === 'member' ? 'Editor' : 'Viewer';
  }

  login(): void {
    this.authService.loginWithGoogle().subscribe({
      next: (result) => {
        if (result.success) {
          this.loadPreview();
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
