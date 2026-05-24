import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

declare var google: any;

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: false
})
export class NavbarComponent {
  @Input() destinationName: string = '';
  @Output() localSearchInput = new EventEmitter<string>();

  predictions: any[] = [];
  showDropdown = false;
  showUserMenu = false;
  searchActive = false;
  isScrolled = false;

  private searchSubject = new Subject<string>();
  private autocompleteService: any;
  private blurTimeout: any;
  private initialized = false;

  constructor(
    public authService: AuthService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > window.innerHeight * 0.7;
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
    this.router.navigate(['/destination', prediction.place_id]);
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
    this.router.navigate(['/trip-planner'], {
      state: { user: this.authService.currentUser }
    });
  }

  onSignIn(): void {
    this.openAuthModal();
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu(): void {
    setTimeout(() => {
      this.showUserMenu = false;
    }, 150);
  }

  logout(): void {
    this.authService.logout();
    this.showUserMenu = false;
    this.router.navigate(['/']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  getUserInitial(): string {
    const name = this.authService.currentUser?.name;
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  private openAuthModal(): void {
    const dialogRef = this.dialog.open(AuthGateModalComponent, {
      data: { destination: this.destinationName },
      panelClass: 'auth-gate-dialog',
      maxWidth: '600px',
      width: '550px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.type === 'authenticated') {
        // User is now logged in, UI updates reactively
      }
    });
  }
}
