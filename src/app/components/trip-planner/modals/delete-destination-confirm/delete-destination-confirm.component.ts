import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface DeleteDestinationConfirmData {
  destinationName: string;
}

@Component({
  selector: 'app-delete-destination-confirm',
  templateUrl: './delete-destination-confirm.component.html',
  styleUrls: ['./delete-destination-confirm.component.scss'],
  standalone: false
})
export class DeleteDestinationConfirmComponent {
  constructor(
    public dialogRef: MatDialogRef<DeleteDestinationConfirmComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteDestinationConfirmData
  ) {}

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
