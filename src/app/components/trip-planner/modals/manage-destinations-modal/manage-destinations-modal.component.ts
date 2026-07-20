import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { TripService, CreateTripDestinationDto } from '../../../../services/trip.service';
import { ToastrService } from 'ngx-toastr';
import { AddDestinationDialogComponent, AddDestinationDialogData, AddDestinationDialogResult } from '../add-destination-dialog/add-destination-dialog.component';
import { DeleteDestinationConfirmComponent, DeleteDestinationConfirmData } from '../delete-destination-confirm/delete-destination-confirm.component';

export interface ManageDestinationsModalData {
  tripId: string;
  fromDate: string | null;
  toDate: string | null;
  destinations: { id?: string; googlePlaceId?: string; name: string; startDate: string | null; endDate: string | null; latitude?: number; longitude?: number; photoUrl?: string | null }[];
}

@Component({
  selector: 'app-manage-destinations-modal',
  templateUrl: './manage-destinations-modal.component.html',
  styleUrls: ['./manage-destinations-modal.component.scss'],
  standalone: false
})
export class ManageDestinationsModalComponent {
  destinations: { id?: string; googlePlaceId?: string; name: string; startDate: string | null; endDate: string | null; latitude?: number; longitude?: number; photoUrl?: string | null }[];
  colors = ['#4ade80', '#f97316', '#818cf8', '#f472b6', '#facc15', '#22d3ee'];

  constructor(
    public dialogRef: MatDialogRef<ManageDestinationsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ManageDestinationsModalData,
    private dialog: MatDialog,
    private tripService: TripService,
    private toastr: ToastrService
  ) {
    this.destinations = [...data.destinations.map(d => ({ ...d }))];
  }

  get tripDateRange(): string {
    if (!this.tripFromDate || !this.tripToDate) return 'Dates not set';
    const from = new Date(this.tripFromDate);
    const to = new Date(this.tripToDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `Trip runs ${months[from.getMonth()]} ${from.getDate()} – ${months[to.getMonth()]} ${to.getDate()}, ${to.getFullYear()} · ${diffDays} days`;
  }

  get tripFromDate(): string | null {
    let min: string | null = null;
    for (const d of this.destinations) {
      if (d.startDate && (!min || d.startDate < min)) min = d.startDate;
    }
    return min || this.data.fromDate;
  }

  get tripToDate(): string | null {
    let max: string | null = null;
    for (const d of this.destinations) {
      if (d.endDate && (!max || d.endDate > max)) max = d.endDate;
    }
    return max || this.data.toDate;
  }

  get totalDays(): number {
    if (!this.tripFromDate || !this.tripToDate) return 0;
    const from = new Date(this.tripFromDate);
    const to = new Date(this.tripToDate);
    return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  getColor(index: number): string {
    return this.colors[index % this.colors.length];
  }

  getBarWidth(dest: { startDate: string | null; endDate: string | null }): number {
    if (!dest.startDate || !dest.endDate || this.totalDays === 0) return 0;
    const start = new Date(dest.startDate);
    const end = new Date(dest.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return (days / this.totalDays) * 100;
  }

  getNightsLabel(dest: { startDate: string | null; endDate: string | null }): string {
    if (!dest.startDate || !dest.endDate) return 'dates not set';
    const start = new Date(dest.startDate);
    const end = new Date(dest.endDate);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (nights === 0) return 'last day';
    return `${nights} night${nights !== 1 ? 's' : ''}`;
  }

  getDateLabel(dateStr: string | null): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  private fmt(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  editDest(index: number): void {
    const dest = this.destinations[index];
    const dialogRef = this.dialog.open(AddDestinationDialogComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        editMode: true,
        lockDestination: true,
        name: dest.name,
        startDate: dest.startDate ? new Date(dest.startDate) : null,
        endDate: dest.endDate ? new Date(dest.endDate) : null,
        fromDate: this.tripFromDate,
        toDate: this.tripToDate,
        existingDestinations: this.destinations
          .filter((_, i) => i !== index)
          .map(d => ({ name: d.name, startDate: d.startDate, endDate: d.endDate }))
      } as AddDestinationDialogData
    });

    dialogRef.afterClosed().subscribe((result: AddDestinationDialogResult | null) => {
      if (result) {
        const newStart = result.startDate ? this.fmt(result.startDate) : null;
        const newEnd = result.endDate ? this.fmt(result.endDate) : null;

        // Update locally
        this.destinations[index] = { ...this.destinations[index], startDate: newStart, endDate: newEnd };
        this.destinations = [...this.destinations];

        // Call API immediately to update dates
        if (dest.id) {
          this.tripService.updateDestinationDates(this.data.tripId, [{
            destinationId: dest.id,
            startDate: newStart,
            endDate: newEnd
          }]).subscribe({
            next: () => this.toastr.success(`${dest.name} dates updated`),
            error: () => this.toastr.error('Failed to update dates')
          });
        }
      }
    });
  }

  deleteDest(index: number): void {
    if (index === 0) return;
    const dest = this.destinations[index];
    const dialogRef = this.dialog.open(DeleteDestinationConfirmComponent, {
      panelClass: 'custom-dialog-container',
      data: { destinationName: dest.name } as DeleteDestinationConfirmData
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        // Call API immediately
        if (dest.id) {
          this.tripService.deleteDestination(this.data.tripId, dest.id).subscribe({
            next: () => {
              this.destinations.splice(index, 1);
              this.destinations = [...this.destinations];
              this.toastr.success(`${dest.name} removed`);
            },
            error: () => this.toastr.error('Failed to remove destination')
          });
        } else {
          this.destinations.splice(index, 1);
          this.destinations = [...this.destinations];
        }
      }
    });
  }

  addDest(): void {
    const lastDest = this.destinations[this.destinations.length - 1];
    const dialogRef = this.dialog.open(AddDestinationDialogComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        editMode: false,
        fromDate: this.tripFromDate,
        toDate: this.tripToDate,
        lastDestEndDate: lastDest?.endDate || null,
        existingDestinations: this.destinations.map(d => ({
          name: d.name, startDate: d.startDate, endDate: d.endDate
        }))
      } as AddDestinationDialogData
    });

    dialogRef.afterClosed().subscribe((result: AddDestinationDialogResult | null) => {
      if (result) {
        const newStart = result.startDate ? this.fmt(result.startDate) : null;
        const newEnd = result.endDate ? this.fmt(result.endDate) : null;

        // Call API immediately to create
        const dto: CreateTripDestinationDto = {
          googlePlaceId: result.prediction.place_id || '',
          name: result.prediction.structured_formatting.main_text,
          latitude: result.prediction.latitude ?? undefined,
          longitude: result.prediction.longitude ?? undefined,
          photoUrl: result.prediction.photoUrl ?? null,
          order: this.destinations.length,
          startDate: newStart,
          endDate: newEnd
        };

        this.tripService.addDestination(this.data.tripId, dto).subscribe({
          next: (res) => {
            this.destinations.push({
              id: res.id,
              googlePlaceId: res.googlePlaceId,
              name: res.name,
              startDate: newStart,
              endDate: newEnd,
              latitude: res.latitude,
              longitude: res.longitude
            });
            this.destinations = [...this.destinations];
            this.toastr.success(`${res.name} added`);
          },
          error: () => this.toastr.error('Failed to add destination')
        });
      }
    });
  }

  close(): void {
    // Return current state so parent can sync
    this.dialogRef.close({
      destinations: this.destinations,
      tripFromDate: this.tripFromDate,
      tripToDate: this.tripToDate
    });
  }
}
