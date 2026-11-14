import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AccountService, BlockedPerson } from '../../services/account.service';
import { AuthService } from '../../services/auth.service';

/**
 * Settings — the app's settings, apart from your profile: account (email,
 * how you sign in, change password), privacy and safety (people you've
 * blocked, with Unblock), about (privacy policy, terms), log out and delete
 * account (type DELETE to confirm).
 */
@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false,
})
export class SettingsComponent implements OnInit {
  blocked: BlockedPerson[] = [];
  blockedLoading = true;
  unblocking: string | null = null;
  methods = { google: false, password: false };

  deleteOpen = false;
  deleteText = '';
  deleting = false;
  deleteError = '';

  constructor(
    public auth: AuthService,
    private account: AccountService,
    private router: Router,
    private toastr: ToastrService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.auth.authReady;
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/']);
      return;
    }
    this.methods = this.auth.signInMethods();
    this.account.getBlocked().subscribe({
      next: (list) => { this.blocked = list || []; this.blockedLoading = false; },
      error: () => { this.blockedLoading = false; },
    });
  }

  get signInLabel(): string {
    const { google, password } = this.methods;
    return google && password ? 'Google and email' : google ? 'Google' : password ? 'Email and password' : '—';
  }

  async changePassword(): Promise<void> {
    try {
      const to = await this.auth.sendPasswordReset();
      this.toastr.success(`A link to set a new password is on its way to ${to}.`);
    } catch (e: any) {
      this.toastr.error(e?.message || 'Could not send the link.');
    }
  }

  unblock(p: BlockedPerson): void {
    if (this.unblocking) return;
    this.unblocking = p.id;
    this.account.unblock(p.id).subscribe({
      next: () => {
        this.blocked = this.blocked.filter(b => b.id !== p.id);
        this.unblocking = null;
        this.toastr.success(`${p.name || 'They'} can be seen again.`);
      },
      error: () => { this.unblocking = null; this.toastr.error('Couldn\'t unblock. Please try again.'); },
    });
  }

  initials(name: string | null): string {
    return (name || 'T').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  async logOut(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/']);
  }

  openDelete(): void { this.deleteText = ''; this.deleteError = ''; this.deleteOpen = true; }
  get canDelete(): boolean { return this.deleteText.trim().toUpperCase() === 'DELETE' && !this.deleting; }

  confirmDelete(): void {
    if (!this.canDelete) return;
    this.deleting = true;
    this.deleteError = '';
    this.account.deleteAccount().subscribe({
      next: () => {
        this.deleteOpen = false;
        this.toastr.success('Your account and data have been removed. Safe travels!');
        this.router.navigate(['/']);
      },
      error: () => {
        this.deleting = false;
        this.deleteError = 'Could not delete your account. Please try again.';
      },
    });
  }

  back(): void { this.router.navigate(['/profile']); }
}
