import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

declare var google: any;

export interface AddDestinationDialogData {
  editMode: boolean;
  name?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  fromDate?: string | null;
  toDate?: string | null;
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
    this.addDestStart = data.startDate || null;
    this.addDestEnd = data.endDate || null;
    this.initAutocomplete();
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
}
