import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface DeleteTripConfirmData {
  tripName: string;
}

@Component({
  selector: 'app-delete-trip-confirm',
  templateUrl: './delete-trip-confirm.component.html',
  styleUrls: ['./delete-trip-confirm.component.scss'],
  standalone: false
})
export class DeleteTripConfirmComponent {
  deleting = false;

  constructor(
    public dialogRef: MatDialogRef<DeleteTripConfirmComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteTripConfirmData
  ) {}

  confirm(): void {
    this.deleting = true;
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
