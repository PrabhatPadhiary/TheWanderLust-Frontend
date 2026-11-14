import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AccountService, MyProfile } from '../../services/account.service';
import { AuthService } from '../../services/auth.service';
import { TripService, TripResponse } from '../../services/trip.service';

// Traveller titles, earned by the number of trips (as in the app).
const LEVELS = [
  { title: 'Wanderer', from: 0 },
  { title: 'Explorer', from: 2 },
  { title: 'Voyager', from: 6 },
  { title: 'Globetrotter', from: 11 },
];

/**
 * Profile — about you, like the app's: a "travel passport" card (the drawn
 * countryside with your traveller title between its layers and the windmill
 * turning in front of it), your photo and name, your stats, your next trip,
 * and links to your trips, stories and favourites. Account security,
 * privacy and the rest are in Settings.
 */
@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: false,
})
export class ProfileComponent implements OnInit {
  me: MyProfile | null = null;
  nextTrip: TripResponse | null = null;
  loading = true;
  error = '';
  photoBusy = false;
  editingName = false;
  nameDraft = '';
  savingName = false;
  showLevels = false;
  readonly levels = LEVELS;

  constructor(
    private account: AccountService,
    public auth: AuthService,
    private trips: TripService,
    private router: Router,
    private toastr: ToastrService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.auth.authReady;
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/']);
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.account.getMe().subscribe({
      next: (me) => { this.me = me; this.loading = false; },
      error: () => { this.error = 'Couldn\'t load your profile. Please try again.'; this.loading = false; },
    });
    this.trips.getAllTrips(true).subscribe({
      next: (list) => { this.nextTrip = this.pickNext(list || []); },
      error: () => { this.nextTrip = null; },
    });
  }

  /** The trip happening now, else the soonest upcoming one. */
  private pickNext(list: TripResponse[]): TripResponse | null {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const live = list.filter(t => (t.status || '').toLowerCase() !== 'completed' && t.startDate);
    const ongoing = live.find(t => new Date(t.startDate!) <= today && (!t.endDate || new Date(t.endDate) >= today));
    if (ongoing) return ongoing;
    return live
      .filter(t => new Date(t.startDate!) > today)
      .sort((a, b) => +new Date(a.startDate!) - +new Date(b.startDate!))[0] || null;
  }

  get name(): string { return this.me?.name || this.auth.currentUser?.name || 'Traveller'; }
  get initials(): string {
    return this.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'T';
  }
  get photo(): string | null { return this.me?.photoUrl || this.auth.currentUser?.photoUrl || null; }
  get since(): string {
    return this.me?.createdAt
      ? new Date(this.me.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : '';
  }

  get level() {
    const n = this.me?.stats.trips || 0;
    let i = 0;
    LEVELS.forEach((l, idx) => { if (n >= l.from) i = idx; });
    return { ...LEVELS[i], next: LEVELS[i + 1] || null, toNext: LEVELS[i + 1] ? LEVELS[i + 1].from - n : 0 };
  }
  levelRange(i: number): string {
    const next = LEVELS[i + 1];
    return next ? `${LEVELS[i].from}–${next.from - 1} trips` : `${LEVELS[i].from}+ trips`;
  }

  get nextLabel(): string {
    const t = this.nextTrip;
    if (!t?.startDate) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((+new Date(t.startDate) - +today) / 86400000);
    if (days <= 0) return 'Happening now';
    return days === 1 ? 'Tomorrow' : `In ${days} days`;
  }
  get nextDates(): string {
    const t = this.nextTrip;
    if (!t?.startDate) return '';
    const f = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return t.endDate ? `${f(t.startDate)} – ${f(t.endDate)}` : f(t.startDate);
  }

  // ── Photo ──
  onPhotoPicked(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.toastr.error('Please choose an image.'); return; }
    if (file.size > 8 * 1024 * 1024) { this.toastr.error('That photo is too big (8 MB max).'); return; }
    this.photoBusy = true;
    this.account.uploadPhoto(file).subscribe({
      next: (r) => { if (this.me) this.me.photoUrl = r.photoUrl; this.photoBusy = false; },
      error: (err) => { this.photoBusy = false; this.toastr.error(err?.error || 'Couldn\'t update your photo.'); },
    });
  }
  removePhoto(): void {
    this.photoBusy = true;
    this.account.removePhoto().subscribe({
      next: () => { if (this.me) this.me.photoUrl = null; this.photoBusy = false; },
      error: () => { this.photoBusy = false; this.toastr.error('Couldn\'t remove your photo.'); },
    });
  }

  // ── Name ──
  startEditName(): void { this.nameDraft = this.name === 'Traveller' ? '' : this.name; this.editingName = true; }
  saveName(): void {
    const name = this.nameDraft.trim();
    if (!name || this.savingName) return;
    this.savingName = true;
    this.account.updateName(name).subscribe({
      next: (u) => { if (this.me) this.me.name = u.name; this.editingName = false; this.savingName = false; },
      error: (err) => { this.savingName = false; this.toastr.error(err?.error || 'Couldn\'t save your name.'); },
    });
  }

  go(path: string): void { this.router.navigate([path]); }
  openTrip(): void { if (this.nextTrip) this.router.navigate(['/trip-planner', this.nextTrip.id]); }
}
