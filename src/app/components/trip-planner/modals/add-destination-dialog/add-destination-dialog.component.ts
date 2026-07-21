import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatCalendarCellClassFunction } from '@angular/material/datepicker';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

declare var google: any;

export interface AddDestinationDialogData {
  editMode: boolean;
  lockDestination?: boolean; // If true, don't allow changing the destination itself
  name?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  fromDate?: string | null;
  toDate?: string | null;
  lastDestEndDate?: string | null;
  existingDestinations?: { name: string; startDate: string | null; endDate: string | null }[];
}

export interface AddDestinationDialogResult {
  prediction: any;
  startDate: Date | null;
  endDate: Date | null;
}

@Component({
  selector: 'app-add-destination-dialog',
  templateUrl: './add-destination-dialog.component.html',
  styleUrls: ['./add-destination-dialog.component.scss'],
  standalone: false
})
export class AddDestinationDialogComponent {
  destSearchQuery = '';
  destSearchPredictions: any[] = [];
  destSearchShowDropdown = false;
  selectedDestPrediction: any = null;
  addDestStart: Date | null = null;
  addDestEnd: Date | null = null;

  private destSearchSubject = new Subject<string>();
  private autocompleteService: any;
  private initialized = false;

  get fromDateObj(): Date | null {
    return this.data.fromDate ? new Date(this.data.fromDate) : null;
  }
  get toDateObj(): Date | null {
    return this.data.toDate ? new Date(this.data.toDate) : null;
  }

  constructor(
    public dialogRef: MatDialogRef<AddDestinationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddDestinationDialogData
  ) {
    if (data.editMode && data.name) {
      this.destSearchQuery = data.name;
      this.selectedDestPrediction = { structured_formatting: { main_text: data.name, secondary_text: '' } };
    }
    // Pre-fill start date: if lastDestEndDate provided, use next day
    if (!data.editMode && data.lastDestEndDate) {
      const nextDay = new Date(data.lastDestEndDate);
      nextDay.setDate(nextDay.getDate() + 1);
      this.addDestStart = nextDay;
    } else {
      this.addDestStart = data.startDate || null;
    }
    this.addDestEnd = data.endDate || null;
    this.initAutocomplete();
  }

  get minStartDate(): Date | null {
    // For adding new destinations: min = last destination's end date + 1 day
    // For editing: no min constraint (allow any date)
    if (this.data.editMode) return null;
    if (this.data.lastDestEndDate) {
      const nextDay = new Date(this.data.lastDestEndDate);
      nextDay.setDate(nextDay.getDate() + 1);
      return nextDay;
    }
    return null;
  }

  private initAutocomplete(): void {
    if (this.initialized) return;
    if (typeof google !== 'undefined' && google.maps?.places) {
      this.autocompleteService = new google.maps.places.AutocompleteService();
      this.initialized = true;

      this.destSearchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(v => v.length >= 2)
      ).subscribe(value => {
        this.autocompleteService.getPlacePredictions(
          { input: value },
          (predictions: any[], status: string) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              const allowed = ['locality', 'administrative_area_level_1', 'country'];
              this.destSearchPredictions = predictions.filter((p: any) =>
                p.types?.some((t: string) => allowed.includes(t))
              );
              this.destSearchShowDropdown = this.destSearchPredictions.length > 0;
            } else {
              this.destSearchPredictions = [];
              this.destSearchShowDropdown = false;
            }
          }
        );
      });
    }
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.destSearchQuery = value;
    this.selectedDestPrediction = null;
    if (value.length < 2) {
      this.destSearchPredictions = [];
      this.destSearchShowDropdown = false;
      return;
    }
    this.destSearchSubject.next(value);
  }

  selectPrediction(prediction: any): void {
    this.selectedDestPrediction = prediction;
    this.destSearchQuery = prediction.structured_formatting.main_text;
    this.destSearchPredictions = [];
    this.destSearchShowDropdown = false;

    // Fetch place details for lat/lng
    if (typeof google !== 'undefined' && google.maps?.places) {
      const mapDiv = document.createElement('div');
      const placesService = new google.maps.places.PlacesService(mapDiv);
      placesService.getDetails(
        { placeId: prediction.place_id, fields: ['geometry', 'photos'] },
        (place: any, status: string) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            this.selectedDestPrediction = {
              ...prediction,
              latitude: place.geometry?.location?.lat() ?? null,
              longitude: place.geometry?.location?.lng() ?? null,
              photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 800 }) ?? null
            };
          }
        }
      );
    }
  }

  onBlur(): void {
    setTimeout(() => { this.destSearchShowDropdown = false; }, 200);
  }

  confirm(): void {
    if (!this.selectedDestPrediction) return;
    this.dialogRef.close({
      prediction: this.selectedDestPrediction,
      startDate: this.addDestStart,
      endDate: this.addDestEnd
    } as AddDestinationDialogResult);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  // Highlight existing destination date ranges in the calendar
  dateClassFn: MatCalendarCellClassFunction<Date> = (cellDate, view) => {
    if (view !== 'month') return '';
    if (!this.data.existingDestinations?.length) return '';

    const time = cellDate.getTime();
    const classes: string[] = [];

    for (let i = 0; i < this.data.existingDestinations.length; i++) {
      const dest = this.data.existingDestinations[i];
      if (!dest.startDate || !dest.endDate) continue;

      const start = new Date(dest.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dest.endDate);
      end.setHours(0, 0, 0, 0);

      const cellDay = new Date(cellDate);
      cellDay.setHours(0, 0, 0, 0);
      const cellTime = cellDay.getTime();

      if (cellTime >= start.getTime() && cellTime <= end.getTime()) {
        const colorIdx = i % 5;
        classes.push(`dest-range-${colorIdx}`);

        if (cellTime === start.getTime()) {
          classes.push('dest-range-start');
        } else if (cellTime === end.getTime()) {
          classes.push('dest-range-end');
        } else {
          classes.push('dest-range-mid');
        }
      }
    }

    return classes.join(' ');
  };
}
