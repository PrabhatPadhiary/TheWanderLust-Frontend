import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TripService, TripMemberResponse, CreateChecklistItemDto, UpdateChecklistItemDto, ChecklistItemResponse } from '../../../../services/trip.service';

export interface AddChecklistItemModalData {
  tripId: string;
  members: TripMemberResponse[];
  fromDate: string | null;
  item?: ChecklistItemResponse; // present when editing
}

@Component({
  selector: 'app-add-checklist-item-modal',
  templateUrl: './add-checklist-item-modal.component.html',
  styleUrls: ['./add-checklist-item-modal.component.scss'],
  standalone: false
})
export class AddChecklistItemModalComponent {
  title: string = '';
  category: string = 'other';
  dueDate: Date | null = null;
  assignedToUserId: string = '';
  saving = false;
  modalAssignDropdown = false;

  readonly categories = ['packing', 'bookings', 'documents', 'money', 'safety', 'other'];
  readonly categoryLabels: Record<string, string> = {
    packing: 'Packing', bookings: 'Bookings', documents: 'Documents',
    money: 'Money', safety: 'Safety', other: 'Other'
  };
  readonly categoryColors: Record<string, string> = {
    packing: '#2563eb', bookings: '#7c3aed', documents: '#0891b2',
    money: '#d97706', safety: '#dc2626', other: '#6b7280'
  };

  constructor(
    public dialogRef: MatDialogRef<AddChecklistItemModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddChecklistItemModalData,
    private tripService: TripService
  ) {
    if (data.item) {
      // Edit mode
      this.title = data.item.title;
      this.category = data.item.category;
      this.dueDate = data.item.dueDate ? new Date(data.item.dueDate) : null;
      this.assignedToUserId = data.item.assignedToUserId || '';
    } else if (data.fromDate) {
      this.dueDate = new Date(data.fromDate);
    }
  }

  get isEditing(): boolean { return !!this.data.item; }

  get isValid(): boolean {
    return !!this.title.trim();
  }

  save(): void {
    if (!this.isValid || this.saving) return;
    this.saving = true;

    const fmt = (d: Date | null): string | null => {
      if (!d) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (this.isEditing) {
      const dto: UpdateChecklistItemDto = {
        title: this.title.trim(),
        category: this.category,
        dueDate: fmt(this.dueDate),
        assignedToUserId: this.assignedToUserId || null
      };
      this.tripService.updateChecklistItem(this.data.tripId, this.data.item!.id, dto).subscribe({
        next: (res) => {
          this.saving = false;
          this.dialogRef.close(res);
        },
        error: () => { this.saving = false; }
      });
    } else {
      const dto: CreateChecklistItemDto = {
        title: this.title.trim(),
        category: this.category,
        dueDate: fmt(this.dueDate),
        assignedToUserId: this.assignedToUserId || null
      };
      this.tripService.addChecklistItem(this.data.tripId, dto).subscribe({
        next: (res) => {
          this.saving = false;
          this.dialogRef.close(res);
        },
        error: () => { this.saving = false; }
      });
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }

  getMemberInitial(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
}
