import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ChoiceOption {
  key: string;
  label: string;
  /** Red, for things like Delete or Block. */
  danger?: boolean;
}

export interface ChoiceDialogData {
  title: string;
  message?: string;
  options: ChoiceOption[];
  cancelLabel?: string;
  /** A small menu beside its button (set by StoryActionsService). */
  compact?: boolean;
}

/**
 * A small list of choices (a story's menu, report reasons) or a confirmation
 * (one option). Closes with the chosen option's key, or nothing on Cancel.
 */
@Component({
  selector: 'app-choice-dialog',
  templateUrl: './choice-dialog.component.html',
  styleUrls: ['./choice-dialog.component.scss'],
  standalone: false
})
export class ChoiceDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ChoiceDialogComponent, string>,
    @Inject(MAT_DIALOG_DATA) public data: ChoiceDialogData,
  ) {}

  choose(key: string): void { this.dialogRef.close(key); }
  cancel(): void { this.dialogRef.close(); }
}
