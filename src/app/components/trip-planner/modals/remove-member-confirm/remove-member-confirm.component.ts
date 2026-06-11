import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface RemoveMemberConfirmData {
  memberName: string;
}

@Component({
  selector: 'app-remove-member-confirm',
  templateUrl: './remove-member-confirm.component.html',
  styleUrls: ['./remove-member-confirm.component.scss'],
  standalone: false
})
export class RemoveMemberConfirmComponent {
  removing = false;

  constructor(
    public dialogRef: MatDialogRef<RemoveMemberConfirmComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RemoveMemberConfirmData
  ) {}

  confirm(): void {
    this.removing = true;
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
