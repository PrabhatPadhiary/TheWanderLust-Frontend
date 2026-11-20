import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

declare var google: any;

/**
 * "Where do you want to go?": a city / state / country search with Google's
 * suggestions; picking one opens that destination. Used beside the navbar's
 * links on the home page, as the floating search on phones, and at the end of
 * the home page. (The hero has its own, wired into its animation.)
 */
@Component({
  selector: 'app-place-search',
  templateUrl: './place-search.component.html',
  styleUrls: ['./place-search.component.scss'],
  standalone: false,
})
export class PlaceSearchComponent implements AfterViewInit, OnDestroy {
  @Input() placeholder = 'Where do you want to go?';
  /** Suggestions open upwards (for a search at the bottom of the screen). */
  @Input() dropUp = false;
  /** Show the orange Explore button. */
  @Input() showButton = true;
  /** Focus the field as soon as it appears. */
  @Input() autofocus = false;
  /** Emitted once a place is chosen (the page then navigates). */
  @Output() picked = new EventEmitter<void>();

  @ViewChild('field') field?: ElementRef<HTMLInputElement>;

  predictions: any[] = [];
  open = false;
  active = -1;   // keyboard-highlighted suggestion

  private service: any = null;
  private input$ = new Subject<string>();
  private sub: Subscription;
  private blurTimer: any;

  constructor(private router: Router, private zone: NgZone) {
    this.sub = this.input$.pipe(debounceTime(250), distinctUntilChanged()).subscribe(v => this.lookup(v));
  }

  ngAfterViewInit(): void {
    if (this.autofocus) setTimeout(() => this.field?.nativeElement.focus(), 0);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    clearTimeout(this.blurTimer);
  }

  onInput(value: string): void {
    this.active = -1;
    if (value.trim().length < 2) {
      this.predictions = [];
      this.open = false;
      return;
    }
    this.input$.next(value.trim());
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' && this.predictions.length) {
      e.preventDefault();
      this.active = (this.active + 1) % this.predictions.length;
      this.open = true;
    } else if (e.key === 'ArrowUp' && this.predictions.length) {
      e.preventDefault();
      this.active = (this.active - 1 + this.predictions.length) % this.predictions.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.explore();
    } else if (e.key === 'Escape') {
      this.open = false;
    }
  }

  onFocus(): void {
    clearTimeout(this.blurTimer);
    this.open = this.predictions.length > 0;
  }

  onBlur(): void {
    this.blurTimer = setTimeout(() => { this.open = false; }, 180);
  }

  /** The highlighted suggestion, else the first; with nothing typed, just focus the field. */
  explore(): void {
    const p = this.predictions[this.active] || this.predictions[0];
    if (p) this.select(p);
    else this.field?.nativeElement.focus();
  }

  select(p: any): void {
    this.predictions = [];
    this.open = false;
    this.picked.emit();
    this.router.navigate(['/destination', p.place_id], {
      state: { destinationName: p.structured_formatting?.main_text || p.description },
    });
  }

  label(p: any): string {
    if (p.types?.includes('locality')) return 'City';
    if (p.types?.includes('administrative_area_level_1')) return 'State';
    if (p.types?.includes('country')) return 'Country';
    return '';
  }

  /** Cities first, then states, then countries (the same as the hero search). */
  private lookup(value: string): void {
    if (!this.service) {
      if (typeof google === 'undefined' || !google.maps?.places) return;
      this.service = new google.maps.places.AutocompleteService();
    }
    this.service.getPlacePredictions({ input: value }, (results: any[], status: string) => {
      this.zone.run(() => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          this.predictions = [];
          this.open = false;
          return;
        }
        const allowed = ['locality', 'administrative_area_level_1', 'country'];
        const rank = (t: string[]) => t.includes('locality') ? 1 : t.includes('administrative_area_level_1') ? 2 : t.includes('country') ? 3 : 4;
        this.predictions = results
          .filter(r => r.types?.some((t: string) => allowed.includes(t)))
          .sort((a, b) => rank(a.types) - rank(b.types));
        this.open = this.predictions.length > 0 && document.activeElement === this.field?.nativeElement;
      });
    });
  }
}
