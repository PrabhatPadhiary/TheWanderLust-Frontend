import { Component, Inject, HostListener } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TripService, ItineraryItemResponse } from '../../../../services/trip.service';
import { ToastrService } from 'ngx-toastr';

export interface ItineraryItemDetailData {
  item: ItineraryItemResponse;
  destinationName: string;
}

export interface ItineraryItemDetailResult {
  action: 'updated' | 'deleted';
  item?: ItineraryItemResponse;
}

@Component({
  selector: 'app-itinerary-item-detail',
  templateUrl: './itinerary-item-detail.component.html',
  styleUrls: ['./itinerary-item-detail.component.scss'],
  standalone: false
})
export class ItineraryItemDetailComponent {
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  notes: string;
  saving = false;
  deleting = false;
  startDropdownOpen = false;
  endDropdownOpen = false;

  @HostListener('document:click')
  closeDropdowns(): void { this.startDropdownOpen = false; this.endDropdownOpen = false; }

  // Whether title/category are editable (only for manually added items)
  get isManualItem(): boolean { return !this.data.item.tripPlaceId; }

  readonly categories = ['activity', 'food', 'stay', 'transport', 'other'];
  readonly categoryLabels: Record<string, string> = {
    activity: 'Activity', food: 'Food', stay: 'Stay', transport: 'Transport', other: 'Other'
  };

  // Time options for dropdowns (every 15 minutes)
  readonly timeOptions: string[] = [];

  constructor(
    public dialogRef: MatDialogRef<ItineraryItemDetailComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ItineraryItemDetailData,
    private tripService: TripService,
    private toastr: ToastrService
  ) {
    this.title = data.item.title;
    this.category = data.item.category;
    this.startTime = data.item.startTime || '09:00';
    this.endTime = data.item.endTime || '10:00';
    this.notes = data.item.notes || '';

    // Generate time options: 00:00 to 23:45 in 15-min increments
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        this.timeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
  }

  formatTimeLabel(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  getDuration(): string {
    const [sh, sm] = this.startTime.split(':').map(Number);
    const [eh, em] = this.endTime.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    if (hours === 0) return `${remaining}m`;
    if (remaining === 0) return `${hours}h`;
    return `${hours}h ${remaining}m`;
  }

  getCategoryColor(cat: string): string {
    if (cat === 'activity') return '#60a5fa';
    if (cat === 'food') return '#fbbf24';
    if (cat === 'stay') return '#4ade80';
    if (cat === 'transport') return '#a78bfa';
    return '#94a3b8';
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;

    const dto: any = {
      startTime: this.startTime,
      endTime: this.endTime,
      notes: this.notes || null
    };

    // Only include title/category if manual item
    if (this.isManualItem) {
      dto.title = this.title.trim();
      dto.category = this.category;
    }

    this.tripService.updateItineraryItem(this.data.item.tripId, this.data.item.id, dto).subscribe({
      next: () => {
        this.saving = false;
        const updated: ItineraryItemResponse = {
          ...this.data.item,
          startTime: this.startTime,
          endTime: this.endTime,
          notes: this.notes || null,
          ...(this.isManualItem ? { title: this.title.trim(), category: this.category } : {})
        };
        this.toastr.success('Item updated');
        this.dialogRef.close({ action: 'updated', item: updated } as ItineraryItemDetailResult);
      },
      error: () => { this.saving = false; this.toastr.error('Failed to update'); }
    });
  }

  delete(): void {
    if (this.deleting) return;
    this.deleting = true;
    this.tripService.deleteItineraryItem(this.data.item.tripId, this.data.item.id).subscribe({
      next: () => {
        this.toastr.success(`${this.data.item.title} removed`);
        this.dialogRef.close({ action: 'deleted', item: this.data.item } as ItineraryItemDetailResult);
      },
      error: () => { this.deleting = false; this.toastr.error('Failed to delete'); }
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
