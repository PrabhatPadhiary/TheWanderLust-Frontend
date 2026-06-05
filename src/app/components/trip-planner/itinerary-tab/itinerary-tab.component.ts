import { Component, Input } from '@angular/core';
import { TripPlaceDetailResponse } from '../../../services/trip.service';

export interface ItineraryDay {
  dayNumber: number;
  date: Date | null;
  items: TripPlaceDetailResponse[];
}

@Component({
  selector: 'app-itinerary-tab',
  templateUrl: './itinerary-tab.component.html',
  styleUrls: ['./itinerary-tab.component.scss'],
  standalone: false
})
export class ItineraryTabComponent {
  @Input() fromDate: string | null = null;
  @Input() toDate: string | null = null;
  @Input() places: TripPlaceDetailResponse[] = [];

  get days(): ItineraryDay[] {
    if (!this.fromDate || !this.toDate) {
      // No dates — show a single "Unscheduled" bucket with all places
      return [{ dayNumber: 1, date: null, items: [...this.places] }];
    }

    const start = new Date(this.fromDate);
    const end = new Date(this.toDate);
    const diffMs = end.getTime() - start.getTime();
    const totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);

    const result: ItineraryDay[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      result.push({ dayNumber: i + 1, date, items: [] });
    }

    // For now, put all places in Day 1 (until we have day assignment logic)
    if (result.length > 0) {
      result[0].items = [...this.places];
    }

    return result;
  }

  get unscheduledPlaces(): TripPlaceDetailResponse[] {
    // Places not assigned to any day — for future use
    return [];
  }

  getDayLabel(day: ItineraryDay): string {
    if (!day.date) return 'Unscheduled';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day.date.getDay()];
  }

  getCategoryIcon(category: string): string {
    if (category === 'stay') return '🏨';
    if (category === 'food') return '🍽️';
    return '🏛️';
  }

  getCategoryLabel(category: string): string {
    if (category === 'stay') return 'Stay';
    if (category === 'food') return 'Food';
    return 'Activity';
  }
}
