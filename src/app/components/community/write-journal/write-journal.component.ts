import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { TripService, TripResponse, TripDestinationResponse } from '../../../services/trip.service';
import { JournalService, CreateJournalDto } from '../../../services/journal.service';
import { JournalUploadStateService } from '../../../services/journal-upload-state.service';
import { ToastrService } from 'ngx-toastr';

interface PlaceTag {
  name: string;
  category: string;
  selected: boolean;
}

@Component({
  selector: 'app-write-journal',
  templateUrl: './write-journal.component.html',
  styleUrls: ['./write-journal.component.scss'],
  standalone: false
})
export class WriteJournalComponent implements OnInit {

  // Trip selection
  userTrips: TripResponse[] = [];
  selectedTrip: TripResponse | null = null;
  tripLinked = false;
  tripDropdownOpen = false;

  // Section 1: Trip Details
  destination = '';
  startDate = '';
  endDate = '';
  travelersCount = 1;
  budget: number | null = null;
  currency = 'INR';
  coverPhotoPreview: string | null = null;
  coverPhotoFile: File | null = null;

  // Section 2: Your Story
  journalTitle = '';
  journalBody = '';
  storyPhotos: { file: File; preview: string }[] = [];

  // Image validation
  readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  readonly MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
  imageErrors: string[] = [];

  get hasImageError(): boolean {
    return this.imageErrors.length > 0;
  }

  // Section 3: Tag Places
  places: PlaceTag[] = [];
  manualPlaceInput = '';

  // Section 4: Extras
  visibility: 'public' | 'private' = 'public';
  vibeOptions = ['Adventure', 'Relaxing', 'Foodie', 'Cultural', 'Budget', 'Luxury', 'Solo', 'Group', 'Road Trip', 'Nature'];
  selectedVibes: string[] = [];
  proTips = '';

  isSubmitting = false;

  constructor(
    public authService: AuthService,
    private tripService: TripService,
    private journalService: JournalService,
    private uploadState: JournalUploadStateService,
    public router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/community']);
      return;
    }
    this.loadTrips();
  }

  private loadTrips(): void {
    this.tripService.getAllTrips().subscribe({
      next: (trips) => { this.userTrips = trips; },
      error: () => {}
    });
  }

  onTripSelect(tripId: string): void {
    if (!tripId) {
      this.selectedTrip = null;
      this.tripLinked = false;
      this.places = [];
      return;
    }

    // Fetch full trip details
    this.tripService.getTrip(tripId).subscribe({
      next: (trip) => {
        this.selectedTrip = trip;
        this.tripLinked = true;
        this.prefillFromTrip(trip);
      },
      error: () => {
        this.toastr.error('Failed to load trip details');
      }
    });
  }

  private prefillFromTrip(trip: TripResponse): void {
    this.destination = trip.primaryDestination || trip.destinations?.[0]?.name || '';
    this.startDate = this.formatDateForInput(trip.startDate);
    this.endDate = this.formatDateForInput(trip.endDate);
    this.travelersCount = trip.travelersCount || 1;
    this.budget = trip.totalBudget || null;
    this.currency = trip.currency || 'INR';

    // Extract places from all destinations
    this.places = [];
    if (trip.destinations) {
      trip.destinations.forEach((dest: TripDestinationResponse) => {
        if (dest.places) {
          dest.places.forEach(place => {
            this.places.push({
              name: place.placeName,
              category: place.category,
              selected: true
            });
          });
        }
      });
    }
  }

  // Cover photo
  onCoverPhotoSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const error = this.validateImageFile(file);
    if (error) {
      this.toastr.error(error, 'Cover photo rejected');
      input.value = '';
      return;
    }

    this.coverPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.coverPhotoPreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeCoverPhoto(): void {
    this.coverPhotoPreview = null;
    this.coverPhotoFile = null;
  }

  // Story photos
  onStoryPhotoSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    Array.from(input.files).forEach(file => {
      const error = this.validateImageFile(file);
      if (error) {
        this.addImageError(`${file.name}: ${error}`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        this.storyPhotos.push({ file, preview: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    });

    // Reset so the same file can trigger change again if user removes and re-adds
    input.value = '';
  }

  private validateImageFile(file: File): string | null {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const blockedExtensions = ['heic', 'heif', 'bmp', 'tiff', 'tif', 'gif', 'svg'];

    if (blockedExtensions.includes(ext)) {
      return `${ext.toUpperCase()} format is not supported. Convert to JPG, PNG, or WebP first.`;
    }
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return `Invalid format. Use JPG, PNG, or WebP.`;
    }
    if (file.size > this.MAX_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return `File is ${sizeMb} MB — maximum allowed is 5 MB.`;
    }
    return null;
  }

  private addImageError(msg: string): void {
    this.imageErrors.push(msg);
    this.toastr.error(msg, 'Photo rejected');
  }

  clearImageErrors(): void {
    this.imageErrors = [];
  }

  removeStoryPhoto(index: number): void {
    this.storyPhotos.splice(index, 1);
  }

  // Places
  togglePlace(index: number): void {
    this.places[index].selected = !this.places[index].selected;
  }

  addManualPlace(): void {
    if (!this.manualPlaceInput.trim()) return;
    this.places.push({ name: this.manualPlaceInput.trim(), category: 'other', selected: true });
    this.manualPlaceInput = '';
  }

  removePlace(index: number): void {
    this.places.splice(index, 1);
  }

  // Vibes
  toggleVibe(vibe: string): void {
    const idx = this.selectedVibes.indexOf(vibe);
    if (idx > -1) {
      this.selectedVibes.splice(idx, 1);
    } else {
      this.selectedVibes.push(vibe);
    }
  }

  // Publish / Draft
  onPublish(): void {
    if (!this.journalTitle.trim()) {
      this.toastr.error('Please add a title for your journal');
      return;
    }
    if (!this.journalBody.trim()) {
      this.toastr.error('Please write your story');
      return;
    }
    if (!this.destination.trim()) {
      this.toastr.error('Please add a destination');
      return;
    }
    if (this.hasImageError) {
      this.toastr.error('Fix photo errors before publishing');
      return;
    }
    this.submitJournal('published');
  }

  onSaveDraft(): void {
    if (!this.journalTitle.trim()) {
      this.toastr.error('Please add at least a title to save a draft');
      return;
    }
    this.submitJournal('draft');
  }

  private submitJournal(status: 'published' | 'draft'): void {
    this.isSubmitting = true;
    const dto: CreateJournalDto = {
      title: this.journalTitle.trim(),
      body: this.journalBody.trim(),
      tripId: this.selectedTrip?.id || null,
      destination: this.destination.trim(),
      startDate: this.startDate || null,
      endDate: this.endDate || null,
      travelersCount: this.travelersCount || null,
      budget: this.budget || null,
      currency: this.currency || null,
      visibility: this.visibility,
      vibes: this.selectedVibes.length > 0 ? this.selectedVibes : undefined,
      proTips: this.proTips.trim() || null,
      status: status,
      places: this.places
        .filter(p => p.selected)
        .map(p => ({
          placeName: p.name,
          category: p.category,
          googlePlaceId: null
        }))
    };

    this.journalService.createJournal(dto).subscribe({
      next: (res) => {
        if (this.storyPhotos.length > 0) {
          // Signal uploading state → navigate → upload in background
          this.uploadState.setUploading(res.id, this.journalTitle.trim());
          this.router.navigate(['/community']);

          const files = this.storyPhotos.map(p => p.file);
          this.journalService.uploadPhotos(res.id, files).subscribe({
            next: () => this.uploadState.setDone(),
            error: () => {
              this.uploadState.setError();
              this.toastr.warning('Journal saved but some photos failed to upload');
            }
          });
        } else {
          // No photos — navigate immediately, show quick success
          this.uploadState.setUploading(res.id, this.journalTitle.trim());
          this.uploadState.setDone();
          this.router.navigate(['/community']);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        const message = err?.error || err?.message || 'Something went wrong';
        this.toastr.error(typeof message === 'string' ? message : 'Failed to save journal');
      }
    });
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'food': return 'food';
      case 'stay': return 'stay';
      case 'attraction': return 'attraction';
      default: return 'other';
    }
  }

  formatDateForInput(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    // Handle ISO date strings — extract YYYY-MM-DD for input[type=date]
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }
}
