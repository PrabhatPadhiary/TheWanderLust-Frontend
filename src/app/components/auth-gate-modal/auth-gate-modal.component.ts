import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-gate-modal',
  templateUrl: './auth-gate-modal.component.html',
  styleUrls: ['./auth-gate-modal.component.scss'],
  standalone: false
})
export class AuthGateModalComponent {
  isLoading = false;

  constructor(
    private dialogRef: MatDialogRef<AuthGateModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { destination: string },
    private toastr: ToastrService,
    private authService: AuthService
  ) {}

  loginWithGoogle(): void {
    if (this.isLoading) return;
    this.isLoading = true;

    this.authService.loginWithGoogle().subscribe({
      next: (result) => {
        if (result.success) {
          this.toastr.success('Login successful');
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

  continueAsGuest(): void {
    this.dialogRef.close({ type: 'guest' });
  }

  closeModal(): void {
    this.dialogRef.close();
  }
}
