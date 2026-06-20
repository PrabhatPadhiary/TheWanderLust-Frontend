import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { TripService, TripResponse, TripDestinationResponse } from '../../../services/trip.service';
import { JournalService, CreateJournalDto } from '../../../services/journal.service';
import { JournalUploadStateService } from '../../../services/journal-upload-state.service';
import { ToastrService } from 'ngx-toastr';

declare var google: any;

interface PlaceTag {
  name: string;
  category: string;
  selected: boolean;
  googlePlaceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
  placePredictions: any[] = [];
  showPlaceDropdown = false;
  private placeSearchSubject = new Subject<string>();
  private placeSearchInitialized = false;

  // Section 4: Extras
  visibility: 'public' | 'private' = 'public';
  vibeOptions = ['Adventure', 'Relaxing', 'Foodie', 'Cultural', 'Budget', 'Luxury', 'Solo', 'Group', 'Road Trip', 'Nature'];
  selectedVibes: string[] = [];
  proTips = '';

  isSubmitting = false;
  isEditMode = false;
  editJournalId: string | null = null;
  loadingJournal = false;

  constructor(
    public authService: AuthService,
    private tripService: TripService,
    private journalService: JournalService,
    private uploadState: JournalUploadStateService,
    public router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/community']);
      return;
    }
    this.loadTrips();

    // Check if editing an existing journal
    this.route.queryParams.subscribe(params => {
      if (params['edit']) {
        this.editJournalId = params['edit'];
        this.isEditMode = true;
        this.loadJournalForEdit(this.editJournalId!);
      }
    });
  }

  private loadTrips(): void {
    this.tripService.getAllTrips().subscribe({
      next: (trips) => { this.userTrips = trips; },
      error: () => {}
    });
  }

  private loadJournalForEdit(journalId: string): void {
    this.loadingJournal = true;
    this.journalService.getById(journalId).subscribe({
      next: (journal) => {
        // Check if current user is the author
        const currentUserId = this.authService.currentUser?.id;
        if (journal.author.id !== currentUserId) {
          this.toastr.error('You can only edit your own journals');
          this.router.navigate(['/community']);
          return;
        }

        // Prefill all fields
        this.journalTitle = journal.title;
        this.journalBody = journal.body;
        this.destination = journal.destination;
        this.startDate = this.formatDateForInput(journal.startDate);
        this.endDate = this.formatDateForInput(journal.endDate);
        this.travelersCount = journal.travelersCount || 1;
        this.budget = journal.budget || null;
        this.currency = journal.currency || 'INR';
        this.visibility = (journal.visibility as 'public' | 'private') || 'public';
        this.proTips = journal.proTips || '';
        this.selectedVibes = journal.vibes || [];

        // Places
        this.places = (journal.places || []).map(p => ({
          name: p.placeName,
          category: p.category,
          selected: true,
          googlePlaceId: p.googlePlaceId || null,
          latitude: p.latitude || null,
          longitude: p.longitude || null
        }));

        this.loadingJournal = false;
      },
      error: () => {
        this.toastr.error('Failed to load journal');
        this.router.navigate(['/community']);
      }
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
              selected: true,
              googlePlaceId: place.placeId || null,
              latitude: place.latitude || null,
              longitude: place.longitude || null
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
    this.places.push({
      name: this.manualPlaceInput.trim(),
      category: 'other',
      selected: true,
      googlePlaceId: null,
      latitude: null,
      longitude: null
    });
    this.manualPlaceInput = '';
    this.placePredictions = [];
    this.showPlaceDropdown = false;
  }

  onPlaceSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.manualPlaceInput = value;
    if (value.length < 2) {
      this.placePredictions = [];
      this.showPlaceDropdown = false;
      return;
    }
    this.initPlaceSearch();
    this.placeSearchSubject.next(value);
  }

  onPlaceSearchBlur(): void {
    setTimeout(() => { this.showPlaceDropdown = false; }, 200);
  }

  selectPlacePrediction(prediction: any): void {
    this.places.push({
      name: prediction.name,
      category: this.inferCategory(prediction.types),
      selected: true,
      googlePlaceId: prediction.place_id,
      latitude: prediction.latitude,
      longitude: prediction.longitude
    });
    this.manualPlaceInput = '';
    this.placePredictions = [];
    this.showPlaceDropdown = false;
  }

  private initPlaceSearch(): void {
    if (this.placeSearchInitialized) return;
    this.placeSearchInitialized = true;

    this.placeSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => v.length >= 2)
    ).subscribe(value => this.runPlaceSearch(value));
  }

  private runPlaceSearch(query: string): void {
    if (typeof google === 'undefined' || !google.maps?.places) return;
    const mapDiv = document.createElement('div');
    const service = new google.maps.places.PlacesService(mapDiv);
    service.textSearch({ query }, (results: any[], status: string) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        this.placePredictions = results.slice(0, 5).map(r => ({
          place_id: r.place_id,
          name: r.name,
          vicinity: r.vicinity || r.formatted_address || '',
          latitude: r.geometry?.location?.lat() ?? null,
          longitude: r.geometry?.location?.lng() ?? null,
          types: r.types || []
        }));
        this.showPlaceDropdown = this.placePredictions.length > 0;
      } else {
        this.placePredictions = [];
        this.showPlaceDropdown = false;
      }
    });
  }

  private inferCategory(types: string[]): string {
    if (!types) return 'other';
    if (types.includes('restaurant') || types.includes('cafe') || types.includes('food') || types.includes('bakery')) return 'food';
    if (types.includes('lodging') || types.includes('hotel')) return 'stay';
    if (types.includes('tourist_attraction') || types.includes('museum') || types.includes('park')) return 'attraction';
    return 'other';
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
          googlePlaceId: p.googlePlaceId || null,
          latitude: p.latitude || null,
          longitude: p.longitude || null
        }))
    };

    const apiCall = this.isEditMode
      ? this.journalService.updateJournal(this.editJournalId!, dto)
      : this.journalService.createJournal(dto);

    apiCall.subscribe({
      next: (res) => {
        const journalId = res.id || this.editJournalId;

        if (this.storyPhotos.length > 0 && journalId) {
          // Signal uploading state → navigate → upload in background
          this.uploadState.setUploading(journalId, this.journalTitle.trim());
          this.router.navigate(['/community']);

          const files = this.storyPhotos.map(p => p.file);
          this.journalService.uploadPhotos(journalId, files).subscribe({
            next: () => this.uploadState.setDone(),
            error: () => {
              this.uploadState.setError();
              this.toastr.warning('Journal saved but some photos failed to upload');
            }
          });
        } else {
          // No photos — navigate immediately
          if (this.isEditMode) {
            this.toastr.success('Journal updated!');
          } else {
            this.uploadState.setUploading(journalId || '', this.journalTitle.trim());
            this.uploadState.setDone();
          }
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
