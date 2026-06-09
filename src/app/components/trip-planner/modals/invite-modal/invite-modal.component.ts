import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TripService } from '../../../../services/trip.service';

export interface InviteModalData {
  tripId: string;
  tripName: string;
}

@Component({
  selector: 'app-invite-modal',
  templateUrl: './invite-modal.component.html',
  styleUrls: ['./invite-modal.component.scss'],
  standalone: false
})
export class InviteModalComponent {
  selectedRole: 'member' | 'viewer' = 'member';
  inviteUrl: string = '';
  copied = false;
  generating = false;
  error = '';

  constructor(
    public dialogRef: MatDialogRef<InviteModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: InviteModalData,
    private tripService: TripService
  ) {}

  generateLink(): void {
    if (this.generating) return;
    this.generating = true;
    this.error = '';
    this.inviteUrl = '';
    this.copied = false;

    this.tripService.createInvitation(this.data.tripId, this.selectedRole).subscribe({
      next: (res) => {
        this.inviteUrl = `${window.location.origin}/join/${res.id}`;
        this.generating = false;
      },
      error: () => {
        this.error = 'Failed to generate link. Please try again.';
        this.generating = false;
      }
    });
  }

  copyLink(): void {
    if (!this.inviteUrl) return;
    navigator.clipboard.writeText(this.inviteUrl).then(() => {
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 2000);
    });
  }

  selectInput(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  get roleLabel(): string {
    return this.selectedRole === 'member' ? 'Editor' : 'Viewer';
  }

  close(): void {
    this.dialogRef.close();
  }
}
