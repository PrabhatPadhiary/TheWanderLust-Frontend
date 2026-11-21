import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { TripService, InvitationPublicPreview } from '../../services/trip.service';
import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';
import { environment } from '../../../environments/environment';

/**
 * /join/<inviteId>: what an invite link opens when the app doesn't.
 *
 * Shows the trip first (public preview: name, where, when, who's going,
 * whose trip), then the way in:
 *  - Android: get the app (the download page) or open it if installed;
 *    "Continue on the web" is a small link.
 *  - iPhone: the app is coming soon; "Continue on the web" is a small link.
 *  - Computers: sign in (Google or email) and join right here.
 */
@Component({
  selector: 'app-join-trip',
  templateUrl: './join-trip.component.html',
  styleUrls: ['./join-trip.component.scss'],
  standalone: false
})
export class JoinTripComponent implements OnInit {
  status: 'loading' | 'ready' | 'joining' | 'success' | 'error' = 'loading';
  errorMessage = '';
  preview: InvitationPublicPreview | null = null;
  signedIn = false;
  photoFailed = false;

  readonly isAndroid = /Android/i.test(navigator.userAgent);
  readonly isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  /** Phones lead with the app; the web is behind a small link until chosen. */
  readonly isPhone = this.isAndroid || this.isIos;
  webChosen = false;
  /** Set when "Open in the app" fell back here because the app isn't installed. */
  appMissing = false;

  inviteId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private authService: AuthService,
    private tripService: TripService
  ) {}

  ngOnInit(): void {
    // Route is /join/:tripId, but the param is an invitation id.
    this.inviteId = this.route.snapshot.paramMap.get('tripId') || '';
    this.appMissing = this.route.snapshot.queryParamMap.get('noapp') === '1';

    if (!this.inviteId) {
      this.fail('This invite link is incomplete. Ask for the link again.');
      return;
    }

    this.tripService.getInvitationPublicPreview(this.inviteId).subscribe({
      next: (res) => {
        this.preview = res;
        this.authService.authReady.then(() => {
          this.signedIn = !!this.authService.currentUser;
          if (!this.signedIn) localStorage.setItem('pendingJoinTrip', this.inviteId);
          this.status = 'ready';
        });
      },
      error: (err) => this.fail(this.messageFor(err)),
    });
  }

  // ── What the page shows ──

  get showWeb(): boolean {
    return !this.isPhone || this.webChosen || this.signedIn;
  }

  get roleLabel(): string {
    return this.preview?.role === 'member' ? 'an editor' : 'a viewer';
  }

  get roleHint(): string {
    return this.preview?.role === 'member'
      ? 'You can add places, plan days and track the budget together.'
      : 'You can see the whole plan; only editors can change it.';
  }

  get coverUrl(): string | null {
    const id = this.preview?.trip.primaryPlaceId;
    if (!id || this.photoFailed) return null;
    return `${environment.apiUrl}/Destinations/place-photo?placeId=${encodeURIComponent(id)}&maxWidth=800`;
  }

  get whereLabel(): string {
    const stops = this.preview?.trip.stopNames || [];
    if (stops.length > 1) return stops.join(' → ');
    return stops[0] || this.preview?.trip.primaryDestination || '';
  }

  get dates(): string {
    const t = this.preview?.trip;
    if (!t?.startDate) return '';
    const fmt = (iso: string, withYear: boolean) => new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
    });
    if (!t.endDate || t.endDate.slice(0, 10) === t.startDate.slice(0, 10)) return fmt(t.startDate, true);
    const sameYear = t.startDate.slice(0, 4) === t.endDate.slice(0, 4);
    return `${fmt(t.startDate, !sameYear)} – ${fmt(t.endDate, true)}`;
  }

  get ownerInitial(): string {
    return (this.preview?.trip.ownerFirstName || '?').charAt(0).toUpperCase();
  }

  // ── Actions ──

  /** The download page (the Android app isn't on Google Play yet). */
  downloadApp(): void {
    this.router.navigate(['/download']);
  }

  /**
   * Opens the invite in the Android app (wayraa://join/<id>). If the app isn't
   * installed, Chrome follows the fallback URL back to this page with ?noapp=1.
   * Set via location.href because Angular's sanitizer blocks intent: links in [href].
   */
  openInApp(): void {
    const id = encodeURIComponent(this.inviteId);
    const fallback = encodeURIComponent(`${window.location.origin}/join/${id}?noapp=1`);
    window.location.href =
      `intent://join/${id}#Intent;scheme=wayraa;package=com.wayraa.mobile;S.browser_fallback_url=${fallback};end`;
  }

  signInWithGoogle(): void {
    this.authService.loginWithGoogle().subscribe({
      next: (result) => { if (result.success) this.signedIn = true; },
      error: () => {},
    });
  }

  /** Email sign-in / sign-up (and password reset): the site's sign-in window. */
  signInWithEmail(): void {
    const ref = this.dialog.open(AuthGateModalComponent, {
      data: { heading: `Sign in to join ${this.preview?.trip.name || 'this trip'}` },
      panelClass: 'auth-gate-dialog',
      maxWidth: '420px',
      width: '400px',
    });
    ref.afterClosed().subscribe(result => {
      if (result?.type === 'authenticated') this.signedIn = true;
    });
  }

  joinTrip(): void {
    this.status = 'joining';
    this.tripService.joinTrip(this.inviteId).subscribe({
      next: (res: any) => {
        this.status = 'success';
        localStorage.removeItem('pendingJoinTrip');
        setTimeout(() => this.router.navigate(['/trip-planner', res.id]), 1000);
      },
      error: (err) => {
        if (err?.status === 409 && this.preview?.trip.id) {
          // Already in this trip: just open it.
          this.router.navigate(['/trip-planner', this.preview.trip.id]);
          return;
        }
        this.fail(err?.status === 400 && typeof err?.error === 'string' && err.error.length < 200
          ? err.error
          : 'Something went wrong. Please try again.');
      }
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  private fail(message: string): void {
    this.errorMessage = message;
    this.status = 'error';
  }

  private messageFor(err: any): string {
    if (err?.status === 404) return 'This invitation doesn\'t exist or has been removed.';
    const text = typeof err?.error === 'string' ? err.error : '';
    if (text.includes('expired')) return 'This invite link has expired. Ask the trip owner for a new one.';
    if (text.includes('already been used')) return 'This invite link has already been used.';
    if (err?.status === 400 && text && text.length < 200) return text;
    return 'Couldn\'t load this invite. Check your connection and try again.';
  }
}
