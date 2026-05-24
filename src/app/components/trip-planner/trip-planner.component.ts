import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { DestinationService } from '../../services/destination.service';
import { PlaceCategoriesResponse, PlaceDto } from '../../models/destination.model';

@Component({
  selector: 'app-trip-planner',
  templateUrl: './trip-planner.component.html',
  styleUrls: ['./trip-planner.component.scss'],
  standalone: false
})
export class TripPlannerComponent implements OnInit {
  user: UserResponse | null = null;
  destination: string = '';
  placeId: string = '';
  isGuest = false;
  greeting = '';

  // Destination data
  destinationData: PlaceCategoriesResponse | null = null;
  loading = true;

  // Itinerary
  itinerary: PlaceDto[] = [];

  // Active tab
  activeTab: 'overview' | 'itinerary' | 'discover' = 'overview';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private destinationService: DestinationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const state = history.state;
    this.user = state?.user || this.authService.currentUser;
    this.destination = state?.destination || '';
    this.placeId = state?.placeId || '';
    this.isGuest = state?.isGuest || false;
    this.greeting = this.getGreeting();

    if (this.placeId) {
      this.loadDestinationData();
    } else {
      this.loading = false;
    }
  }

  private getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  private loadDestinationData(): void {
    this.loading = true;
    this.destinationService.search(this.placeId).subscribe({
      next: (data) => {
        this.destinationData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getUserName(): string {
    if (this.user?.name) return this.user.name.split(' ')[0];
    return 'Traveller';
  }

  getUserInitial(): string {
    return this.getUserName().charAt(0).toUpperCase();
  }

  addToItinerary(place: PlaceDto): void {
    if (!this.itinerary.find(p => p.placeId === place.placeId)) {
      this.itinerary.push(place);
    }
  }

  removeFromItinerary(placeId: string): void {
    this.itinerary = this.itinerary.filter(p => p.placeId !== placeId);
  }

  isInItinerary(placeId: string): boolean {
    return this.itinerary.some(p => p.placeId === placeId);
  }

  getRatingStars(rating: number | null): string {
    if (!rating) return '—';
    return '⭐'.repeat(Math.round(rating));
  }

  setActiveTab(tab: 'overview' | 'itinerary' | 'discover'): void {
    this.activeTab = tab;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
