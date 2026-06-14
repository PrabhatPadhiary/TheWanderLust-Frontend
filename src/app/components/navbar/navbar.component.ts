import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';
import { TripResponse } from '../../services/trip.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

declare var google: any;

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: false
})
export class NavbarComponent implements OnInit {
  @Input() destinationName: string = '';
  @Input() tripName: string = '';
  @Input() existingTrip: TripResponse | null = null;
  @Input() isTripPlanner: boolean = false;
  @Input() primaryDestinationPlaceId: string = '';
  /** Landing mode: transparent navbar that frosts on scroll, shows section links */
  @Input() isLanding: boolean = false;
  /** Destination mode: logo-only brand, single search bar, left-aligned to match content */
  @Input() isDestination: boolean = false;
  @Output() localSearchInput = new EventEmitter<string>();

  predictions: any[] = [];
  showDropdown = false;
  showUserMenu = false;
  searchActive = false;
  showTripTooltip = false;
  scrolled = false;
  landingSection = 'explore';
  private searchSubject = new Subject<string>();
  private autocompleteService: any;
  private blurTimeout: any;
  private initialized = false;

  constructor(
    public authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {}

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrolled = window.scrollY > 50;
  }

  private initAutocomplete(): void {
    if (this.initialized) return;
    if (typeof google !== 'undefined' && google.maps?.places) {
      this.autocompleteService = new google.maps.places.AutocompleteService();
      this.initialized = true;

      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(value => value.length >= 2)
      ).subscribe(value => {
        this.autocompleteService.getPlacePredictions(
          { input: value },
          (predictions: any[], status: string) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              const allowedTypes = ['locality', 'administrative_area_level_1', 'country'];
              this.predictions = predictions
                .filter((pred: any) => pred.types?.some((type: string) => allowedTypes.includes(type)))
                .sort((a: any, b: any) => {
                  const priority = (types: string[]) => {
                    if (types.includes('locality')) return 1;
                    if (types.includes('administrative_area_level_1')) return 2;
                    if (types.includes('country')) return 3;
                    return 4;
                  };
                  return priority(a.types) - priority(b.types);
                });
              this.showDropdown = this.predictions.length > 0;
            } else {
              this.predictions = [];
              this.showDropdown = false;
            }
          }
        );
      });
    }
  }

  onSearchInput(event: Event): void {
    this.initAutocomplete();
    const value = (event.target as HTMLInputElement).value;
    if (value.length < 2) {
      this.predictions = [];
      this.showDropdown = false;
      return;
    }
    this.searchSubject.next(value);
  }

  onLocalSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.localSearchInput.emit(value);
  }

  selectPlace(prediction: any): void {
    this.predictions = [];
    this.showDropdown = false;
    this.searchActive = false;
    this.router.navigate(['/destination', prediction.place_id], {
      state: { destinationName: prediction.structured_formatting?.main_text || prediction.description }
    });
  }

  onBlur(): void {
    this.blurTimeout = setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  onFavouritesClick(): void {
    this.router.navigate(['/favourites']);
  }

  onTripsClick(): void {
    if (!this.authService.isLoggedIn) {
      this.openAuthModal();
      return;
    }
    this.router.navigate(['/my-trips']);
  }

  onSignIn(): void {
    if (this.authService.isLoggedIn) {
      this.router.navigate(['/my-trips']);
    } else {
      this.openAuthModal();
    }
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu(): void {
    setTimeout(() => {
      this.showUserMenu = false;
    }, 150);
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      this.toastr.info('Signed out successfully');
    } finally {
      this.showUserMenu = false;
    }
  }

  getTripCapsuleLabel(): string {
    if (!this.existingTrip) return '';
    const name = this.existingTrip.name || `${this.destinationName} Trip`;
    if (this.existingTrip.startDate && this.existingTrip.endDate) {
      const start = new Date(this.existingTrip.startDate);
      const end = new Date(this.existingTrip.endDate);
      const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (nights > 0) return `${name} · ${nights} night${nights !== 1 ? 's' : ''}`;
    }
    return name;
  }

  navigateToTrip(): void {
    if (!this.existingTrip) return;
    this.router.navigate(['/trip-planner', this.existingTrip.id], {
      state: {
        destination: this.destinationName,
        tripId: this.existingTrip.id,
        tripName: this.existingTrip.name,
        status: this.existingTrip.status,
        fromDate: this.existingTrip.startDate || null,
        toDate: this.existingTrip.endDate || null,
        travellers: this.existingTrip.travelersCount || 0
      }
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  scrollToSection(section: string): void {
    this.landingSection = section;
    const el = document.getElementById(section);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  backToDestination(): void {
    if (this.primaryDestinationPlaceId) {
      this.router.navigate(['/destination', this.primaryDestinationPlaceId]);
    } else {
      this.router.navigate(['/']);
    }
  }

  getUserInitial(): string {
    const name = this.authService.currentUser?.name;
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  private openAuthModal(): void {
    const dialogRef = this.dialog.open(AuthGateModalComponent, {
      data: { destination: this.destinationName },
      panelClass: 'auth-gate-dialog',
      maxWidth: '500px',
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.type === 'authenticated') {
        // User is now logged in, UI updates reactively
      }
    });
  }
}
