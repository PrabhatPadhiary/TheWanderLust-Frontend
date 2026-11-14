import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import { FavouritesService } from '../../services/favourites.service';

@Component({
  selector: 'app-auth-gate-modal',
  templateUrl: './auth-gate-modal.component.html',
  styleUrls: ['./auth-gate-modal.component.scss'],
  standalone: false
})
export class AuthGateModalComponent {
  isLoading = false;

  // Email sign-in / sign-up (accounts work on the app and here).
  mode: 'signin' | 'signup' = 'signin';
  name = '';
  email = '';
  password = '';
  emailError = '';
  resetSent = '';

  constructor(
    private dialogRef: MatDialogRef<AuthGateModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { destination?: string } | null,
    private toastr: ToastrService,
    private authService: AuthService,
    private favouritesService: FavouritesService
  ) {}

  loginWithGoogle(): void {
    if (this.isLoading) return;
    this.isLoading = true;

    this.authService.loginWithGoogle().subscribe({
      next: (result) => {
        if (result.success) {
          // Merge any guest favourites to backend on login
          this.favouritesService.mergeOnLogin();
          this.toastr.success('Signed in successfully');
          this.dialogRef.close({ type: 'authenticated', user: result.user });
        } else {
          this.isLoading = false;
          if (result.error !== 'Login cancelled') {
            this.toastr.error(result.error || 'Google login failed');
          }
        }
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error('Google login failed. Please try again.');
      }
    });
  }

  setMode(mode: 'signin' | 'signup'): void {
    this.mode = mode;
    this.emailError = '';
    this.resetSent = '';
  }

  submitEmail(): void {
    if (this.isLoading) return;
    this.emailError = '';
    this.resetSent = '';
    if (!this.email.trim() || !this.password) {
      this.emailError = 'Enter your email and password.';
      return;
    }
    if (this.mode === 'signup' && !this.name.trim()) {
      this.emailError = 'Enter your name.';
      return;
    }
    this.isLoading = true;
    const call = this.mode === 'signup'
      ? this.authService.signUpWithEmail(this.name, this.email, this.password)
      : this.authService.loginWithEmail(this.email, this.password);
    call.subscribe(result => {
      if (result.success) {
        this.favouritesService.mergeOnLogin();
        this.toastr.success(this.mode === 'signup' ? 'Welcome to Wayraa!' : 'Signed in successfully');
        this.dialogRef.close({ type: 'authenticated', user: result.user });
      } else {
        this.isLoading = false;
        this.emailError = result.error || 'Something went wrong. Please try again.';
      }
    });
  }

  async forgotPassword(): Promise<void> {
    this.emailError = '';
    this.resetSent = '';
    try {
      const to = await this.authService.sendPasswordReset(this.email);
      this.resetSent = `We've emailed a reset link to ${to}.`;
    } catch (e: any) {
      this.emailError = e?.message || 'Could not send the link.';
    }
  }

  closeModal(): void {
    this.dialogRef.close();
  }
}
