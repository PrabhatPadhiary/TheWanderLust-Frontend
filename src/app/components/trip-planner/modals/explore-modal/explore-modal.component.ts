import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DestinationService } from '../../../../services/destination.service';
import { PlaceDto } from '../../../../models/destination.model';
import { TripService, CreateTripPlaceDto, TripPlaceDetailResponse } from '../../../../services/trip.service';
import { ToastrService } from 'ngx-toastr';
import { tripCategoryFromTypes } from '../../../../utils/place-category';

export interface ExploreModalData {
  tripId: string;
  destinationId: string;
  destinationName: string;
  googlePlaceId: string;
  activeTab: 'stays' | 'food' | 'activities';
  existingPlaceIds: string[];
  latitude?: number;
  longitude?: number;
}

export interface ExploreModalResult {
  addedPlaces: TripPlaceDetailResponse[];
}

@Component({
  selector: 'app-explore-modal',
  templateUrl: './explore-modal.component.html',
  styleUrls: ['./explore-modal.component.scss'],
  standalone: false
})
/**
 * "Browse & Add Places" for one trip stop: Stay / Food / Activities lists
 * with filter chips, or a search for anything in the destination ("ramen",
 * "bookstores"). Both go through our backend (cached, kept inside the
 * destination) and grow with "Show more", up to Google's 60 results.
 */
export class ExploreModalComponent implements OnInit, OnDestroy {
  activeSection: 'stays' | 'food' | 'attractions' = 'stays';
  places: PlaceDto[] = [];
  loading = false;
  addingPlaceId: string | null = null;
  addedPlaceIds: string[] = [];
  addedPlaces: TripPlaceDetailResponse[] = [];
  addedCount = 0;

  // Search: `searchQuery` is the box; `activeQuery` is what the grid shows
  // results for ('' = the Stay / Food / Activities lists).
  searchQuery = '';
  activeQuery = '';
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // "Show more": the next page of the paged search for what the grid shows.
  // `gen` changes whenever the grid is replaced, so late pages are dropped.
  more = { page: 0, hasMore: true, loading: false, gen: 0 };

  // Chips
  staysChips = ['All', 'Hotels', 'Resorts', 'Boutique', 'Hostels', 'Villas'];
  foodChips = ['All', 'Fine Dining', 'Cafes', 'Street Food', 'Bars', 'Rooftop'];
  tourismChips = ['All', 'Temples', 'Museums', 'Beaches', 'Adventure', 'Nightlife'];
  activeChip = 'All';

  // Cache
  private categoryCache: Partial<Record<'stays' | 'food' | 'attractions', PlaceDto[]>> = {};

  get chips(): string[] {
    if (this.activeSection === 'stays') return this.staysChips;
    if (this.activeSection === 'food') return this.foodChips;
    return this.tourismChips;
  }

  get tabIcon(): string {
    if (this.activeSection === 'stays') return '🏨';
    if (this.activeSection === 'food') return '🍽️';
    return '🏛️';
  }

  constructor(
    public dialogRef: MatDialogRef<ExploreModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExploreModalData,
    private destinationService: DestinationService,
    private tripService: TripService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.addedPlaceIds = [...this.data.existingPlaceIds];

    // Map activeTab to section
    if (this.data.activeTab === 'stays') this.activeSection = 'stays';
    else if (this.data.activeTab === 'food') this.activeSection = 'food';
    else this.activeSection = 'attractions';

    this.loadCategory(this.activeSection);
    this.initSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initSearch(): void {
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(value => this.runSearch(value));
  }

  /** Show search results for `query` in the grid (or the lists again when it's cleared). */
  private runSearch(query: string): void {
    const q = query.trim();
    if (q === this.activeQuery) return;
    if (q.length < 2) {
      if (this.activeQuery) this.exitSearch();
      return;
    }
    this.activeQuery = q;
    this.places = [];
    this.loading = true;
    const gen = this.resetMore();
    this.destinationService.searchInDestination(this.data.googlePlaceId, { query: q, page: 0 }).subscribe({
      next: (res) => {
        if (this.more.gen !== gen) return;
        this.places = res?.places || [];
        this.more = { page: 1, hasMore: !!res?.hasMore, loading: false, gen };
        this.loading = false;
      },
      error: () => {
        if (this.more.gen !== gen) return;
        this.loading = false;
        this.toastr.error('Search failed. Try again.');
      }
    });
  }

  private exitSearch(): void {
    this.activeQuery = '';
    this.activeChip = 'All';
    this.loadCategory(this.activeSection);
  }

  private resetMore(): number {
    this.more = { page: 0, hasMore: true, loading: false, gen: this.more.gen + 1 };
    return this.more.gen;
  }

  /** Append the next page for what the grid shows, skipping places already in it. */
  showMore(): void {
    const state = this.more;
    if (state.loading || !state.hasMore || this.loading) return;
    const category = this.activeSection === 'stays' ? 'stays'
      : this.activeSection === 'food' ? 'restaurants' : 'attractions';
    const opts = this.activeQuery
      ? { query: this.activeQuery, page: state.page }
      : this.activeChip === 'All'
        ? { category, page: state.page }
        : { filter: this.activeChip.toLowerCase(), page: state.page };
    const gen = state.gen;
    state.loading = true;
    this.destinationService.searchInDestination(this.data.googlePlaceId, opts).subscribe({
      next: (res) => {
        if (this.more.gen !== gen) return;
        const seen = new Set(this.places.map(p => p.placeId));
        const fresh = (res?.places || []).filter(p => !seen.has(p.placeId));
        this.places = [...this.places, ...fresh];
        this.more = { page: state.page + 1, hasMore: !!res?.hasMore, loading: false, gen };
        // A page of only places already shown: go straight on to the next.
        if (!fresh.length && res?.hasMore) this.showMore();
      },
      error: () => {
        if (this.more.gen !== gen) return;
        this.more = { ...this.more, loading: false };
        this.toastr.error('Could not load more places. Try again.');
      }
    });
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.searchSubject.next(this.searchQuery);
  }

  /** Enter: search now, without waiting for the pause. */
  submitSearch(): void {
    this.runSearch(this.searchQuery);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchSubject.next('');
    if (this.activeQuery) this.exitSearch();
  }

  setSection(section: 'stays' | 'food' | 'attractions'): void {
    this.activeSection = section;
    this.activeChip = 'All';
    this.searchQuery = '';
    this.searchSubject.next('');
    this.activeQuery = '';
    this.loadCategory(section);
  }

  onChipClick(chip: string): void {
    this.activeChip = chip;
    const gen = this.resetMore();
    if (chip === 'All') {
      this.places = this.categoryCache[this.activeSection] || [];
      return;
    }
    this.loading = true;
    this.destinationService.filter(this.data.googlePlaceId, chip.toLowerCase()).subscribe({
      next: (data) => { if (this.more.gen === gen) { this.places = data; this.loading = false; } },
      error: () => { if (this.more.gen === gen) this.loading = false; }
    });
  }

  private loadCategory(section: 'stays' | 'food' | 'attractions'): void {
    const gen = this.resetMore();
    if (this.categoryCache[section]) {
      this.places = this.categoryCache[section]!;
      this.loading = false;
      return;
    }

    const categoryParam = section === 'stays' ? 'stays'
      : section === 'food' ? 'restaurants'
      : 'attractions';

    this.loading = true;
    this.destinationService.getPlacesByCategory(this.data.googlePlaceId, categoryParam as any).subscribe({
      next: (places) => {
        this.categoryCache[section] = places;
        if (this.more.gen !== gen) return;
        this.places = places;
        this.loading = false;
      },
      error: () => { if (this.more.gen === gen) this.loading = false; }
    });
  }

  private getCategoryForDto(place?: PlaceDto): string {
    // A searched place can be anything: go by what Google says it is.
    if (this.activeQuery && place) return tripCategoryFromTypes(place.types);
    if (this.activeSection === 'stays') return 'stay';
    if (this.activeSection === 'food') return 'food';
    return 'activity';
  }

  addPlace(place: PlaceDto): void {
    if (this.addingPlaceId || this.isAdded(place.placeId)) return;
    this.addingPlaceId = place.placeId;

    const photoUrl = place.photos?.length > 0 ? place.photos[0].url : null;

    const dto: CreateTripPlaceDto = {
      placeId: place.placeId,
      placeName: place.name,
      vicinity: place.vicinity || null,
      rating: place.rating,
      userRatingsTotal: place.userRatingsTotal,
      photoUrl,
      category: this.getCategoryForDto(place),
      notes: null,
      latitude: place.geometry?.latitude || null,
      longitude: place.geometry?.longitude || null
    };

    this.tripService.addPlace(this.data.tripId, this.data.destinationId, dto).subscribe({
      next: (res) => {
        this.addingPlaceId = null;
        this.addedPlaceIds.push(place.placeId);
        this.addedCount++;
        const addedPlace: TripPlaceDetailResponse = {
          id: res.id,
          placeId: dto.placeId,
          placeName: dto.placeName,
          vicinity: dto.vicinity,
          rating: dto.rating,
          userRatingsTotal: dto.userRatingsTotal,
          photoUrl: dto.photoUrl,
          category: dto.category,
          notes: null,
          latitude: dto.latitude,
          longitude: dto.longitude
        };
        this.addedPlaces.push(addedPlace);
        this.toastr.success(`${place.name} added to trip`);
      },
      error: () => {
        this.addingPlaceId = null;
        this.toastr.error('Failed to add place');
      }
    });
  }

  isAdded(placeId: string): boolean {
    return this.addedPlaceIds.includes(placeId);
  }

  close(): void {
    this.dialogRef.close({ addedPlaces: this.addedPlaces } as ExploreModalResult);
  }
}
