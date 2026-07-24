import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface RescheduleWarningData {
  destinationName: string;
}

@Component({
  selector: 'app-reschedule-warning-modal',
  templateUrl: './reschedule-warning-modal.component.html',
  styleUrls: ['./reschedule-warning-modal.component.scss'],
  standalone: false
})
export class RescheduleWarningModalComponent {
  constructor(
    public dialogRef: MatDialogRef<RescheduleWarningModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RescheduleWarningData
  ) {}

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
