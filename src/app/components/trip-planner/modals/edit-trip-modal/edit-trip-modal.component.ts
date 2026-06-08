import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TripService } from '../../../../services/trip.service';

export interface EditTripModalData {
  tripId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  travelersCount: number;
  status: string;
}

export interface EditTripModalResult {
  name: string;
  startDate: string | null;
  endDate: string | null;
  travelersCount: number;
  status: string;
}

@Component({
  selector: 'app-edit-trip-modal',
  templateUrl: './edit-trip-modal.component.html',
  styleUrls: ['./edit-trip-modal.component.scss'],
  standalone: false
})
export class EditTripModalComponent {
  tripName: string;
  startDate: Date | null;
  endDate: Date | null;
  travellers: number;
  status: string;
  saving = false;
  todayDate = new Date();

  statuses = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Planning', label: 'Planning' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Completed', label: 'Completed' }
  ];

  constructor(
    public dialogRef: MatDialogRef<EditTripModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditTripModalData,
    private tripService: TripService
  ) {
    this.tripName = data.name;
    this.startDate = data.startDate ? new Date(data.startDate) : null;
    this.endDate = data.endDate ? new Date(data.endDate) : null;
    this.travellers = data.travelersCount || 1;
    this.status = data.status || 'Planning';
  }

  increment(): void {
    if (this.travellers < 20) this.travellers++;
  }

  decrement(): void {
    if (this.travellers > 1) this.travellers--;
  }

  save(): void {
    if (this.saving || !this.tripName.trim()) return;
    this.saving = true;

    const fmt = (d: Date | null) => d ? d.toISOString() : null;

    const dto = {
      name: this.tripName.trim(),
      startDate: fmt(this.startDate),
      endDate: fmt(this.endDate),
      travelersCount: this.travellers
    };

    this.tripService.updateTrip(this.data.tripId, dto).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close({
          name: this.tripName.trim(),
          startDate: fmt(this.startDate),
          endDate: fmt(this.endDate),
          travelersCount: this.travellers,
          status: this.status
        } as EditTripModalResult);
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
