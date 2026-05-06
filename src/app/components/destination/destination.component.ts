import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DestinationService } from '../../services/destination.service';
import { PlaceCategoriesResponse, NearbyPlace } from '../../models/destination.model';

@Component({
  selector: 'app-destination',
  templateUrl: './destination.component.html',
  styleUrls: ['./destination.component.scss'],
  standalone: false
})
export class DestinationComponent implements OnInit {
  destination: PlaceCategoriesResponse | null = null;
  loading = true;
  error: string | null = null;
  placeId: string = '';

  constructor(
    private route: ActivatedRoute,
    private destinationService: DestinationService
  ) {}

  ngOnInit(): void {
    this.placeId = this.route.snapshot.paramMap.get('placeId') || '';
    if (this.placeId) {
      this.loadDestination();
    }
  }

  loadDestination(): void {
    this.loading = true;
    this.error = null;

    this.destinationService.search(this.placeId).subscribe({
      next: (data) => {
        this.destination = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load destination details. Please try again.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  getRatingStars(rating: number | null): string {
    if (!rating) return '—';
    return '⭐'.repeat(Math.round(rating));
  }
}
