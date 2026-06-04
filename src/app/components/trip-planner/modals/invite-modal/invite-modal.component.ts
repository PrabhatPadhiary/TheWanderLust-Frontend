import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

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
  copied = false;

  get inviteUrl(): string {
    return `${window.location.origin}/join/${this.data.tripId}`;
  }

  constructor(
    public dialogRef: MatDialogRef<InviteModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: InviteModalData
  ) {}

  copyLink(): void {
    navigator.clipboard.writeText(this.inviteUrl).then(() => {
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 2000);
    });
  }

  selectInput(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  close(): void {
    this.dialogRef.close();
  }
}
