import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

declare var google: any;

@Component({
  selector: 'app-landing-page-v2',
  templateUrl: './landing-page-v2.component.html',
  styleUrls: ['./landing-page-v2.component.scss'],
  standalone: false
})
export class LandingPageV2Component implements OnInit {
  navScrolled = false;
  activeSection = 'explore';

  // Search
  predictions: any[] = [];
  showDropdown = false;
  selectedPlace: any = null;
  private searchSubject = new Subject<string>();
  private autocompleteService: any;
  private blurTimeout: any;

  constructor(
    public authService: AuthService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initPlacesAutocomplete();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.navScrolled = window.scrollY > 50;
  }

  scrollTo(section: string): void {
    this.activeSection = section;
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onSignIn(): void {
    if (this.authService.isLoggedIn) {
      this.router.navigate(['/my-trips']);
    } else {
      this.dialog.open(AuthGateModalComponent, {
        panelClass: 'auth-gate-dialog',
        maxWidth: '500px',
        width: '500px'
      });
    }
  }

  // ===== Search =====
  private initPlacesAutocomplete(): void {
    if (typeof google !== 'undefined' && google.maps?.places) {
      this.autocompleteService = new google.maps.places.AutocompleteService();

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
                .filter(pred => pred.types?.some((type: string) => allowedTypes.includes(type)))
                .sort((a, b) => {
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
    const value = (event.target as HTMLInputElement).value;
    if (value.length < 2) {
      this.predictions = [];
      this.showDropdown = false;
      return;
    }
    this.searchSubject.next(value);
  }

  selectPlace(prediction: any): void {
    this.selectedPlace = prediction;
    this.predictions = [];
    this.showDropdown = false;
    this.router.navigate(['/destination', prediction.place_id]);
  }

  onExplore(): void {
    if (this.selectedPlace) {
      this.router.navigate(['/destination', this.selectedPlace.place_id]);
    }
  }

  onBlur(): void {
    this.blurTimeout = setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  getPlaceLabel(prediction: any): string {
    if (prediction.types?.includes('locality')) return 'City';
    if (prediction.types?.includes('administrative_area_level_1')) return 'State';
    if (prediction.types?.includes('country')) return 'Country';
    return '';
  }
}
