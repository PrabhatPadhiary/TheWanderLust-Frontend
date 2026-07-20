import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { TripService, TripPlaceDetailResponse, ItineraryItemResponse, CreateItineraryItemDto } from '../../../services/trip.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-itinerary-tab',
  templateUrl: './itinerary-tab.component.html',
  styleUrls: ['./itinerary-tab.component.scss'],
  standalone: false
})
export class ItineraryTabComponent implements OnInit, OnChanges {
  @Input() tripId: string = '';
  @Input() fromDate: string | null = null;
  @Input() toDate: string | null = null;
  @Input() places: TripPlaceDetailResponse[] = [];
  @Input() destinations: { id?: string; name: string; startDate: string | null; endDate: string | null; places?: TripPlaceDetailResponse[] }[] = [];

  activeDayIndex = 0;
  expandedDestIndex = 0;
  itineraryItems: ItineraryItemResponse[] = [];
  loading = false;

  // Scheduled items per time slot (keyed by slot label) — for the active day
  scheduledSlots: { [slot: string]: ItineraryItemResponse[] } = {};

  // Time slots 12 AM to 11 PM
  timeSlots: string[] = [
    '12:00 AM', '1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM', '5:00 AM',
    '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
    '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'
  ];

  constructor(
    private tripService: TripService,
    private toastr: ToastrService
  ) {
    this.timeSlots.forEach(slot => {
      this.scheduledSlots[slot] = [];
    });
  }

  ngOnInit(): void {
    if (this.tripId) {
      this.loadItinerary();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tripId'] && this.tripId) {
      this.loadItinerary();
    }
    if (changes['fromDate'] || changes['toDate'] || changes['destinations'] || changes['places']) {
      this.distributeItemsToSlots();
    }
  }

  private loadItinerary(): void {
    this.loading = true;
    this.tripService.getItinerary(this.tripId).subscribe({
      next: (items) => {
        this.itineraryItems = items;
        this.distributeItemsToSlots();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private distributeItemsToSlots(): void {
    // Clear all slots
    this.timeSlots.forEach(slot => {
      this.scheduledSlots[slot] = [];
    });

    // Get items for the active day
    const activeDay = this.days[this.activeDayIndex];
    if (!activeDay?.date) return;

    const activeDateStr = this.formatDate(activeDay.date);
    const dayItems = this.itineraryItems.filter(item => {
      const itemDate = item.scheduledDate.split('T')[0];
      return itemDate === activeDateStr;
    });

    // Place items into their time slots
    dayItems.forEach(item => {
      if (item.startTime) {
        const slot = this.timeToSlotLabel(item.startTime);
        if (this.scheduledSlots[slot]) {
          this.scheduledSlots[slot].push(item);
        }
      }
    });
  }

  private timeToSlotLabel(time: string): string {
    // Convert "09:00" to "9:00 AM", "14:00" to "2:00 PM" etc.
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  private slotLabelToTime(slot: string): string {
    // Convert "9:00 AM" to "09:00", "2:00 PM" to "14:00"
    const match = slot.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) return '00:00';
    let hour = parseInt(match[1]);
    const min = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${min}`;
  }

  private addOneHour(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const newHour = (h + 1) % 24;
    return `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  get days() {
    if (!this.fromDate || !this.toDate) {
      return [{ dayNumber: 1, date: null as Date | null, dayName: 'Day 1' }];
    }
    const start = new Date(this.fromDate);
    const end = new Date(this.toDate);
    const diffMs = end.getTime() - start.getTime();
    const totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
    const result = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      result.push({ dayNumber: i + 1, date, dayName: this.getShortDayName(date) });
    }
    return result;
  }

  get unscheduledPlaces(): TripPlaceDetailResponse[] {
    // Places that don't have an itinerary entry
    const scheduledPlaceIds = new Set(
      this.itineraryItems.filter(i => i.tripPlaceId).map(i => i.tripPlaceId!)
    );
    return this.places.filter(p => !scheduledPlaceIds.has(p.id));
  }

  get activeDest(): string {
    if (this.destinations.length > 0) return this.destinations[0].name;
    return '';
  }

  selectDay(index: number): void {
    if (this.activeDayIndex === index) return;
    this.activeDayIndex = index;
    this.distributeItemsToSlots();
  }

  toggleDest(index: number): void {
    this.expandedDestIndex = this.expandedDestIndex === index ? -1 : index;
  }

  getDestColor(index: number): string {
    const colors = ['#4ade80', '#f97316', '#818cf8', '#f472b6', '#facc15', '#22d3ee'];
    return colors[index % colors.length];
  }

  getDayDestColor(day: { date: Date | null, dayNumber: number }): string {
    if (!day.date || this.destinations.length === 0) return '#4ade80';
    const dayTime = day.date.getTime();
    for (let i = 0; i < this.destinations.length; i++) {
      const dest = this.destinations[i];
      if (dest.startDate && dest.endDate) {
        const start = new Date(dest.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dest.endDate);
        end.setHours(23, 59, 59, 999);
        if (dayTime >= start.getTime() && dayTime <= end.getTime()) {
          return this.getDestColor(i);
        }
      }
    }
    const totalDays = this.days.length;
    const destsCount = this.destinations.length;
    const daysPerDest = Math.ceil(totalDays / destsCount);
    const destIndex = Math.min(Math.floor((day.dayNumber - 1) / daysPerDest), destsCount - 1);
    return this.getDestColor(destIndex);
  }

  getSlotDropListId(slot: string): string {
    return 'slot-' + slot.replace(/[: ]/g, '-');
  }

  get allSlotIds(): string[] {
    return this.timeSlots.map(s => this.getSlotDropListId(s));
  }

  // Drag from unscheduled → time slot: create itinerary entry
  dropOnSlot(event: CdkDragDrop<any[]>, slot: string): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    // Check if it's coming from the unscheduled list
    if (event.previousContainer.id === 'unscheduled-list') {
      const place = event.previousContainer.data[event.previousIndex] as TripPlaceDetailResponse;
      this.schedulePlace(place, slot);
    } else {
      // Moving between slots — update the item
      const item = event.previousContainer.data[event.previousIndex] as ItineraryItemResponse;
      this.moveItemToSlot(item, slot);
    }
  }

  // Drop back to unscheduled — delete the itinerary entry
  dropOnUnscheduled(event: CdkDragDrop<any[]>): void {
    if (event.previousContainer === event.container) {
      return;
    }
    const item = event.previousContainer.data[event.previousIndex] as ItineraryItemResponse;
    this.unscheduleItem(item);
  }

  private schedulePlace(place: TripPlaceDetailResponse, slot: string): void {
    const activeDay = this.days[this.activeDayIndex];
    if (!activeDay?.date) return;

    // Find which destination this place belongs to
    let destinationId = '';
    for (const dest of this.destinations) {
      if (dest.places?.some(p => p.id === place.id)) {
        destinationId = dest.id || '';
        break;
      }
    }
    if (!destinationId && this.destinations.length > 0) {
      destinationId = this.destinations[0].id || '';
    }

    const startTime = this.slotLabelToTime(slot);
    const endTime = this.addOneHour(startTime);

    // Optimistic: create a temporary item and show it immediately
    const tempItem: ItineraryItemResponse = {
      id: 'temp-' + Date.now(),
      tripId: this.tripId,
      destinationId,
      tripPlaceId: place.id,
      title: place.placeName,
      category: place.category,
      scheduledDate: this.formatDate(activeDay.date),
      startTime,
      endTime,
      notes: null,
      createdAt: new Date().toISOString()
    };
    this.itineraryItems.push(tempItem);
    this.scheduledSlots[slot].push(tempItem);

    const dto: CreateItineraryItemDto = {
      destinationId,
      tripPlaceId: place.id,
      title: place.placeName,
      category: place.category,
      scheduledDate: this.formatDate(activeDay.date),
      startTime,
      endTime
    };

    this.tripService.createItineraryItem(this.tripId, dto).subscribe({
      next: (item) => {
        // Replace temp item with real one
        const idx = this.scheduledSlots[slot].findIndex(i => i.id === tempItem.id);
        if (idx >= 0) this.scheduledSlots[slot][idx] = item;
        const listIdx = this.itineraryItems.findIndex(i => i.id === tempItem.id);
        if (listIdx >= 0) this.itineraryItems[listIdx] = item;
      },
      error: () => {
        // Revert on failure
        this.scheduledSlots[slot] = this.scheduledSlots[slot].filter(i => i.id !== tempItem.id);
        this.itineraryItems = this.itineraryItems.filter(i => i.id !== tempItem.id);
        this.toastr.error('Failed to schedule item');
      }
    });
  }

  private moveItemToSlot(item: ItineraryItemResponse, newSlot: string): void {
    const newTime = this.slotLabelToTime(newSlot);
    const newEndTime = this.addOneHour(newTime);
    const oldTime = item.startTime;
    const oldSlot = oldTime ? this.timeToSlotLabel(oldTime) : '';

    // Optimistic: move immediately
    if (oldSlot && this.scheduledSlots[oldSlot]) {
      this.scheduledSlots[oldSlot] = this.scheduledSlots[oldSlot].filter(i => i.id !== item.id);
    }
    item.startTime = newTime;
    item.endTime = newEndTime;
    this.scheduledSlots[newSlot].push(item);

    this.tripService.updateItineraryItem(this.tripId, item.id, { startTime: newTime, endTime: newEndTime }).subscribe({
      error: () => {
        // Revert on failure
        this.scheduledSlots[newSlot] = this.scheduledSlots[newSlot].filter(i => i.id !== item.id);
        item.startTime = oldTime;
        if (oldSlot) this.scheduledSlots[oldSlot].push(item);
        this.toastr.error('Failed to move item');
      }
    });
  }

  removeFromSlot(slot: string, index: number): void {
    const item = this.scheduledSlots[slot][index];
    this.unscheduleItem(item);
  }

  private unscheduleItem(item: ItineraryItemResponse): void {
    this.tripService.deleteItineraryItem(this.tripId, item.id).subscribe({
      next: () => {
        this.itineraryItems = this.itineraryItems.filter(i => i.id !== item.id);
        // Remove from slot
        const slot = item.startTime ? this.timeToSlotLabel(item.startTime) : '';
        if (slot && this.scheduledSlots[slot]) {
          this.scheduledSlots[slot] = this.scheduledSlots[slot].filter(i => i.id !== item.id);
        }
        this.toastr.success(`${item.title} unscheduled`);
      },
      error: () => {
        this.toastr.error('Failed to remove item');
      }
    });
  }

  private getShortDayName(date: Date): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }

  getDateLabel(date: Date | null): string {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  getCategoryColor(category: string): string {
    if (category === 'activity') return '#60a5fa';
    if (category === 'food') return '#fbbf24';
    if (category === 'stay') return '#4ade80';
    if (category === 'transport') return '#a78bfa';
    return '#94a3b8';
  }

  getCategoryLabel(category: string): string {
    if (category === 'stay') return 'Stay';
    if (category === 'food') return 'Food';
    if (category === 'transport') return 'Transport';
    return 'Activity';
  }

  getPlacesForDest(dest: { name: string; id?: string; places?: TripPlaceDetailResponse[] }): TripPlaceDetailResponse[] {
    const destPlaces = dest.places || [];
    const scheduledPlaceIds = new Set(
      this.itineraryItems.filter(i => i.tripPlaceId).map(i => i.tripPlaceId!)
    );
    return destPlaces.filter(p => !scheduledPlaceIds.has(p.id));
  }
}
