import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { JournalService, JournalFeedItem } from '../../services/journal.service';
import { PlaceDto, PlaceDetailsResponse } from '../../models/destination.model';
import { DestinationService } from '../../services/destination.service';

@Component({
  selector: 'app-place-detail-panel',
  templateUrl: './place-detail-panel.component.html',
  styleUrls: ['./place-detail-panel.component.scss'],
  standalone: false
})
export class PlaceDetailPanelComponent implements OnChanges {
  @Input() place: PlaceDto | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() addToItinerary = new EventEmitter<PlaceDto>();
  @Output() toggleFav = new EventEmitter<string>();
  /** The place's full details once loaded (for pages that only had its id and name). */
  @Output() detailsLoaded = new EventEmitter<PlaceDetailsResponse>();
  /** Leave this story out of "Stories from Wayraa travellers" (when opened from it). */
  @Input() excludeStoryId: string | null = null;

  /** Public stories that tagged this place (hidden when there are none). */
  stories: JournalFeedItem[] = [];

  details: PlaceDetailsResponse | null = null;
  loading = false;
  currentPhoto = 0;
  showHours = false;

  constructor(
    private destinationService: DestinationService,
    private journalService: JournalService,
    private router: Router,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.place) {
      this.loadDetails();
    }
  }

  private loadDetails(): void {
    if (!this.place) return;
    this.loading = true;
    this.details = null;
    this.currentPhoto = 0;

    const placeId = this.place.placeId;
    this.stories = [];
    this.journalService.getForPlace(placeId, 6).subscribe({
      next: (items) => {
        if (this.place?.placeId !== placeId) return;
        this.stories = (items || []).filter(j => j.id !== this.excludeStoryId);
      },
      error: () => { this.stories = []; },
    });

    this.destinationService.getDetails(placeId).subscribe({
      next: (data) => {
        this.details = data;
        this.loading = false;
        this.detailsLoaded.emit(data);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onClose(): void {
    this.close.emit();
    this.details = null;
    this.showHours = false;
  }

  onAddToItinerary(): void {
    if (this.place) {
      this.addToItinerary.emit(this.place);
    }
  }

  onToggleFav(): void {
    if (this.place) {
      this.toggleFav.emit(this.place.placeId);
    }
  }

  openStory(id: string): void {
    this.onClose();
    this.router.navigate(['/community/story', id]);
  }

  nextPhoto(): void {
    if (this.details && this.details.photos.length > 0) {
      this.currentPhoto = (this.currentPhoto + 1) % this.details.photos.length;
    }
  }

  prevPhoto(): void {
    if (this.details && this.details.photos.length > 0) {
      this.currentPhoto = (this.currentPhoto - 1 + this.details.photos.length) % this.details.photos.length;
    }
  }

  getDirectionsUrl(): string {
    if (!this.details) return '';
    return `https://www.google.com/maps/dir/?api=1&destination=${this.details.geometry.latitude},${this.details.geometry.longitude}`;
  }

  getMapsEmbedUrl(): string {
    if (!this.details) return '';
    return `https://www.google.com/maps?q=${this.details.geometry.latitude},${this.details.geometry.longitude}&output=embed`;
  }

  getPriceLevel(): string {
    if (!this.details?.priceLevel) return '';
    return '$'.repeat(this.details.priceLevel);
  }

  onImgError(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }
}
