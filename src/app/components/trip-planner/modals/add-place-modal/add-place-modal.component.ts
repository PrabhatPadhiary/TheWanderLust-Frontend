import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

declare var google: any;

export interface AddPlaceModalData {
  destinationName: string;
  activeTab: 'stays' | 'food' | 'activities';
  latitude?: number;
  longitude?: number;
}

export interface AddPlaceModalResult {
  prediction?: any;
  customName?: string;
  notes?: string;
}

@Component({
  selector: 'app-add-place-modal',
  templateUrl: './add-place-modal.component.html',
  styleUrls: ['./add-place-modal.component.scss'],
  standalone: false
})
export class AddPlaceModalComponent {
  addPlaceSearch = '';
  addPlacePredictions: any[] = [];
  addPlaceShowDropdown = false;
  addPlaceCustomName = '';
  addPlaceNotes = '';

  private addPlaceSubject = new Subject<string>();
  private initialized = false;

  constructor(
    public dialogRef: MatDialogRef<AddPlaceModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddPlaceModalData
  ) {
    this.initAutocomplete();
  }

  private initAutocomplete(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.addPlaceSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => v.length >= 2)
    ).subscribe(value => this.runSearch(value));
  }

  private getPlaceTypeForTab(): string {
    if (this.data.activeTab === 'stays') return 'lodging';
    if (this.data.activeTab === 'food') return 'restaurant';
    return 'tourist_attraction';
  }

  private runSearch(query: string): void {
    if (typeof google === 'undefined' || !google.maps?.places) return;
    const mapDiv = document.createElement('div');
    const service = new google.maps.places.PlacesService(mapDiv);
    const request: any = { query, type: this.getPlaceTypeForTab() };
    if (this.data.latitude && this.data.longitude) {
      request.location = new google.maps.LatLng(this.data.latitude, this.data.longitude);
      request.radius = 50000;
    }
    service.textSearch(request, (results: any[], status: string) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        this.addPlacePredictions = results.slice(0, 5).map(r => ({
          place_id: r.place_id,
          name: r.name,
          rating: r.rating,
          types: r.types,
          structured_formatting: {
            main_text: r.name,
            secondary_text: r.vicinity || r.formatted_address || ''
          }
        }));
        this.addPlaceShowDropdown = this.addPlacePredictions.length > 0;
      } else {
        this.addPlacePredictions = [];
        this.addPlaceShowDropdown = false;
      }
    });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.addPlaceSearch = value;
    if (value.length < 2) {
      this.addPlacePredictions = [];
      this.addPlaceShowDropdown = false;
      return;
    }
    this.addPlaceSubject.next(value);
  }

  onBlur(): void {
    setTimeout(() => { this.addPlaceShowDropdown = false; }, 200);
  }

  selectPrediction(prediction: any): void {
    this.addPlacePredictions = [];
    this.addPlaceShowDropdown = false;
    this.addPlaceSearch = prediction.structured_formatting.main_text;
    this.dialogRef.close({ prediction } as AddPlaceModalResult);
  }

  confirm(): void {
    this.dialogRef.close({
      customName: this.addPlaceCustomName,
      notes: this.addPlaceNotes
    } as AddPlaceModalResult);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
