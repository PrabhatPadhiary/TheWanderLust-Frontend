import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { TripService, TripPlaceDetailResponse, ItineraryItemResponse, CreateItineraryItemDto } from '../../../services/trip.service';
import { ToastrService } from 'ngx-toastr';
import { ItineraryItemDetailComponent, ItineraryItemDetailData, ItineraryItemDetailResult } from '../modals/itinerary-item-detail/itinerary-item-detail.component';

const HOUR_HEIGHT = 80; // pixels per hour

@Component({
  selector: 'app-itinerary-tab',
  templateUrl: './itinerary-tab.component.html',
  styleUrls: ['./itinerary-tab.component.scss'],
  standalone: false
})
export class ItineraryTabComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() tripId: string = '';
  @Input() fromDate: string | null = null;
  @Input() toDate: string | null = null;
  @Input() places: TripPlaceDetailResponse[] = [];
  @Input() destinations: { id?: string; name: string; startDate: string | null; endDate: string | null; places?: TripPlaceDetailResponse[] }[] = [];
  @ViewChild('scheduleCol') scheduleColRef!: ElementRef<HTMLElement>;

  activeDayIndex = 0;
  expandedDestIndex = 0;
  itineraryItems: ItineraryItemResponse[] = [];
  loading = false;

  // Quick add state
  quickAddSlot: string | null = null;
  quickAddTitle = '';
  quickAddCategory = 'activity';
  quickAddTop = 0;

  // Auto-scroll during drag
  private autoScrollInterval: any = null;
  private boundDragMove = this.onDragMove.bind(this);
  private isDragging = false;

  // Drag-to-reposition state
  private dragItem: ItineraryItemResponse | null = null;
  private dragStartY = 0;
  private dragOriginalTop = 0;
  private didDrag = false;
  dragVisualTop: number | null = null;
  private dragBound = this.onItemMouseMove.bind(this);
  private dragUpBound = this.onItemMouseUp.bind(this);

  // Drag-to-resize state
  private resizeItem: ItineraryItemResponse | null = null;
  private resizeStartY = 0;
  private resizeOriginalHeight = 0;
  private didResize = false;
  resizeVisualHeight: number | null = null;
  private resizeBound = this.onResizeMouseMove.bind(this);
  private resizeUpBound = this.onResizeMouseUp.bind(this);

  // Time slots 12 AM to 11 PM
  timeSlots: string[] = [
    '12:00 AM', '1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM', '5:00 AM',
    '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
    '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'
  ];

  constructor(
    private tripService: TripService,
    private toastr: ToastrService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    document.addEventListener('mousemove', this.boundDragMove);
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mousemove', this.dragBound);
    document.removeEventListener('mouseup', this.dragUpBound);
    document.removeEventListener('mousemove', this.resizeBound);
    document.removeEventListener('mouseup', this.resizeUpBound);
    this.stopAutoScroll();
  }

  // ===== Auto-scroll during CDK drag =====
  private onDragMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    if (!this.scheduleColRef?.nativeElement) return;
    const el = this.scheduleColRef.nativeElement;
    const rect = el.getBoundingClientRect();
    const edgeThreshold = 60;
    const scrollSpeed = 8;
    const mouseY = event.clientY;

    if (event.clientX < rect.left || event.clientX > rect.right) {
      this.stopAutoScroll();
      return;
    }

    if (mouseY > rect.bottom - edgeThreshold && mouseY <= rect.bottom) {
      this.startAutoScroll(el, scrollSpeed);
    } else if (mouseY < rect.top + edgeThreshold && mouseY >= rect.top) {
      this.startAutoScroll(el, -scrollSpeed);
    } else {
      this.stopAutoScroll();
    }
  }

  private startAutoScroll(el: HTMLElement, speed: number): void {
    if (this.autoScrollInterval) return;
    this.autoScrollInterval = setInterval(() => {
      el.scrollTop += speed;
    }, 16);
  }

  private stopAutoScroll(): void {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
  }

  onDragStarted(): void {
    this.isDragging = true;
  }

  // ===== Lifecycle =====
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tripId'] && this.tripId) {
      this.loadItinerary();
    }
  }

  private loadItinerary(): void {
    this.loading = true;
    this.tripService.getItinerary(this.tripId).subscribe({
      next: (items) => {
        this.itineraryItems = items;
        this.scrollToEarliestItem(items);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  // ===== Active day items (absolute positioning) =====
  get activeDayItems(): ItineraryItemResponse[] {
    const activeDay = this.days[this.activeDayIndex];
    if (!activeDay?.date) return [];
    const activeDateStr = this.formatDate(activeDay.date);
    return this.itineraryItems.filter(item => {
      const itemDate = item.scheduledDate.split('T')[0];
      return itemDate === activeDateStr && item.startTime;
    });
  }

  getItemTop(item: ItineraryItemResponse): number {
    if (this.dragItem === item && this.dragVisualTop !== null) {
      return this.dragVisualTop;
    }
    if (!item.startTime) return 0;
    const [h, m] = item.startTime.split(':').map(Number);
    return h * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
  }

  getItemHeight(item: ItineraryItemResponse): number {
    if (this.resizeItem === item && this.resizeVisualHeight !== null) {
      return this.resizeVisualHeight;
    }
    if (!item.startTime || !item.endTime) return HOUR_HEIGHT;
    const [sh, sm] = item.startTime.split(':').map(Number);
    const [eh, em] = item.endTime.split(':').map(Number);
    const durationMin = (eh * 60 + em) - (sh * 60 + sm);
    const height = (durationMin / 60) * HOUR_HEIGHT;
    return Math.max(height, 30);
  }

  // ===== Overlap layout (side-by-side columns) =====
  private overlapCache: Map<string, { col: number; totalCols: number }> = new Map();
  private lastOverlapItems: ItineraryItemResponse[] = [];

  private computeOverlapLayout(): void {
    const items = this.activeDayItems;
    // Invalidate if items array changed (reference or length)
    if (items.length !== this.lastOverlapItems.length || items !== this.lastOverlapItems) {
      this.overlapCache.clear();
      this.lastOverlapItems = items;
    }
    if (this.overlapCache.size > 0) return;

    if (items.length === 0) return;

    // Convert to time ranges
    const ranges = items.map(item => {
      const [sh, sm] = (item.startTime || '0:0').split(':').map(Number);
      const [eh, em] = (item.endTime || '1:0').split(':').map(Number);
      return { id: item.id, start: sh * 60 + sm, end: eh * 60 + em };
    }).sort((a, b) => a.start - b.start || a.end - b.end);

    // Greedy column assignment
    const columns: { id: string; end: number }[][] = [];

    for (const r of ranges) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1];
        if (lastInCol.end <= r.start) {
          columns[c].push({ id: r.id, end: r.end });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([{ id: r.id, end: r.end }]);
      }
    }

    // Now assign each item its column index and the max columns in its overlap group
    // Simple approach: each item gets col index from which column it's in, totalCols = columns.length for its overlapping group
    const itemColMap = new Map<string, number>();
    for (let c = 0; c < columns.length; c++) {
      for (const entry of columns[c]) {
        itemColMap.set(entry.id, c);
      }
    }

    // For each item, find how many columns overlap at its time
    for (const r of ranges) {
      let maxCols = 0;
      for (let c = 0; c < columns.length; c++) {
        for (const entry of columns[c]) {
          const entryRange = ranges.find(x => x.id === entry.id)!;
          if (entryRange.start < r.end && entryRange.end > r.start) {
            maxCols = Math.max(maxCols, c + 1);
          }
        }
      }
      this.overlapCache.set(r.id, {
        col: itemColMap.get(r.id) || 0,
        totalCols: maxCols
      });
    }
  }

  getItemLeft(item: ItineraryItemResponse): number {
    this.computeOverlapLayout();
    const layout = this.overlapCache.get(item.id);
    if (!layout || layout.totalCols <= 1) return 72; // default left (label width)
    const availableWidth = 1; // we'll use percentage via getItemWidth
    return 72 + (layout.col / layout.totalCols) * 0; // handled by CSS calc
  }

  getItemLeftPercent(item: ItineraryItemResponse): string {
    this.computeOverlapLayout();
    const layout = this.overlapCache.get(item.id);
    if (!layout || layout.totalCols <= 1) return '72px';
    // 72px for label + percentage of remaining space
    const colWidth = 100 / layout.totalCols;
    return `calc(72px + ${layout.col * colWidth}% - ${layout.col * 72 / layout.totalCols}px)`;
  }

  getItemWidthPercent(item: ItineraryItemResponse): string {
    this.computeOverlapLayout();
    const layout = this.overlapCache.get(item.id);
    if (!layout || layout.totalCols <= 1) return 'calc(100% - 84px)';
    const colWidth = 100 / layout.totalCols;
    return `calc(${colWidth}% - ${84 / layout.totalCols}px)`;
  }

  // ===== CDK Drop on Schedule (from unscheduled) =====
  dropOnSchedule(event: CdkDragDrop<any[]>): void {
    this.isDragging = false;
    this.stopAutoScroll();

    if (event.previousContainer.id !== 'unscheduled-list') return;

    const place = event.previousContainer.data[event.previousIndex] as TripPlaceDetailResponse;
    const el = this.scheduleColRef.nativeElement;

    // Calculate Y position from the drop point
    const dropPointY = event.distance.y + this.getElementPageY(event.previousContainer.element.nativeElement, event.previousIndex);
    const scheduleRect = el.getBoundingClientRect();
    const relativeY = dropPointY - scheduleRect.top + el.scrollTop;

    // Snap to 15-min increments (20px)
    const snapped = Math.round(relativeY / 20) * 20;
    const totalMinutes = (snapped / HOUR_HEIGHT) * 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    const clampedHours = Math.max(0, Math.min(23, hours));
    const clampedMinutes = Math.max(0, Math.min(59, minutes));

    const startTime = `${clampedHours.toString().padStart(2, '0')}:${clampedMinutes.toString().padStart(2, '0')}`;
    const endTime = this.addOneHour(startTime);

    this.schedulePlaceAtTime(place, startTime, endTime);
  }

  private getElementPageY(container: HTMLElement, index: number): number {
    // Approximate: use the CDK item's original position
    const items = container.querySelectorAll('.cdk-drag');
    if (items[index]) {
      return items[index].getBoundingClientRect().top;
    }
    return container.getBoundingClientRect().top;
  }

  dropOnUnscheduled(event: CdkDragDrop<any[]>): void {
    this.isDragging = false;
    this.stopAutoScroll();
    if (event.previousContainer === event.container) return;
    const item = event.previousContainer.data[event.previousIndex] as ItineraryItemResponse;
    this.unscheduleItem(item);
  }

  // ===== Custom drag-to-reposition (within calendar) =====
  onItemMouseDown(event: MouseEvent, item: ItineraryItemResponse): void {
    // Ignore if clicking resize handle or remove button
    const target = event.target as HTMLElement;
    if (target.closest('.cal-item-resize') || target.closest('.cal-item-remove')) return;

    event.preventDefault();
    this.dragItem = item;
    this.dragStartY = event.clientY;
    this.dragOriginalTop = this.getItemTop(item);
    this.dragVisualTop = this.dragOriginalTop;
    this.didDrag = false;

    document.addEventListener('mousemove', this.dragBound);
    document.addEventListener('mouseup', this.dragUpBound);
  }

  private onItemMouseMove(event: MouseEvent): void {
    if (!this.dragItem) return;
    const dy = event.clientY - this.dragStartY;
    // Only count as a drag if moved more than 5px
    if (Math.abs(dy) > 5) this.didDrag = true;
    const newTop = this.dragOriginalTop + dy;
    // Snap to 15-min increments (20px)
    const snapped = Math.round(newTop / 20) * 20;
    this.dragVisualTop = Math.max(0, Math.min(1920 - 30, snapped));
  }

  private onItemMouseUp(): void {
    if (!this.dragItem) return;
    document.removeEventListener('mousemove', this.dragBound);
    document.removeEventListener('mouseup', this.dragUpBound);

    const item = this.dragItem;
    const finalTop = this.dragVisualTop ?? this.dragOriginalTop;
    this.dragItem = null;
    this.dragVisualTop = null;

    // Calculate new start time from pixel position
    const totalMinutes = (finalTop / HOUR_HEIGHT) * 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    const newStartTime = `${Math.min(23, hours).toString().padStart(2, '0')}:${Math.min(59, minutes).toString().padStart(2, '0')}`;

    // Keep same duration
    const oldDuration = this.getDurationMinutes(item);
    const newEndTime = this.addMinutes(newStartTime, oldDuration);

    if (newStartTime === item.startTime) {
      // No position change — still reset didDrag
      setTimeout(() => { this.didDrag = false; }, 50);
      return;
    }

    const oldStart = item.startTime;
    const oldEnd = item.endTime;
    item.startTime = newStartTime;
    item.endTime = newEndTime;

    this.tripService.updateItineraryItem(this.tripId, item.id, { startTime: newStartTime, endTime: newEndTime }).subscribe({
      error: () => {
        item.startTime = oldStart;
        item.endTime = oldEnd;
        this.toastr.error('Failed to move item');
      }
    });

    // Reset didDrag after a tick so click events in this cycle still see it
    setTimeout(() => { this.didDrag = false; }, 50);
  }

  // ===== Drag-to-resize =====
  onResizeMouseDown(event: MouseEvent, item: ItineraryItemResponse): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizeItem = item;
    this.resizeStartY = event.clientY;
    this.resizeOriginalHeight = this.getItemHeight(item);
    this.resizeVisualHeight = this.resizeOriginalHeight;
    this.didResize = false;

    document.addEventListener('mousemove', this.resizeBound);
    document.addEventListener('mouseup', this.resizeUpBound);
  }

  private onResizeMouseMove(event: MouseEvent): void {
    if (!this.resizeItem) return;
    const dy = event.clientY - this.resizeStartY;
    if (Math.abs(dy) > 3) this.didResize = true;
    const newHeight = this.resizeOriginalHeight + dy;
    // Snap to 15-min increments (20px), minimum 15 min (20px)
    const snapped = Math.round(newHeight / 20) * 20;
    this.resizeVisualHeight = Math.max(20, snapped);
  }

  private onResizeMouseUp(): void {
    if (!this.resizeItem) return;
    document.removeEventListener('mousemove', this.resizeBound);
    document.removeEventListener('mouseup', this.resizeUpBound);

    const item = this.resizeItem;
    const finalHeight = this.resizeVisualHeight ?? this.resizeOriginalHeight;
    this.resizeItem = null;
    this.resizeVisualHeight = null;

    // Calculate new end time from height
    const durationMinutes = (finalHeight / HOUR_HEIGHT) * 60;
    const newEndTime = this.addMinutes(item.startTime!, Math.round(durationMinutes));

    if (newEndTime === item.endTime) {
      setTimeout(() => { this.didResize = false; }, 50);
      return;
    }

    const oldEnd = item.endTime;
    item.endTime = newEndTime;

    this.tripService.updateItineraryItem(this.tripId, item.id, { endTime: newEndTime }).subscribe({
      error: () => {
        item.endTime = oldEnd;
        this.toastr.error('Failed to resize item');
      }
    });

    setTimeout(() => { this.didResize = false; }, 50);
  }

  // ===== Quick Add (click on grid) =====
  onScheduleClick(event: MouseEvent): void {
    // Ignore if we just finished a drag or resize
    if (this.didDrag || this.didResize) {
      this.didDrag = false;
      this.didResize = false;
      return;
    }
    // Ignore if clicking on an item
    const target = event.target as HTMLElement;
    if (target.closest('.cal-item') || target.closest('.cal-quick-add')) return;

    const el = this.scheduleColRef.nativeElement;
    const rect = el.getBoundingClientRect();
    const relativeY = event.clientY - rect.top + el.scrollTop;

    // Snap to 15-min
    const snapped = Math.round(relativeY / 20) * 20;
    this.quickAddTop = snapped;

    const totalMinutes = (snapped / HOUR_HEIGHT) * 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    const clampedH = Math.max(0, Math.min(23, hours));
    const clampedM = Math.max(0, Math.min(59, minutes));

    this.quickAddSlot = `${clampedH.toString().padStart(2, '0')}:${clampedM.toString().padStart(2, '0')}`;
    this.quickAddTitle = '';
    this.quickAddCategory = 'activity';

    setTimeout(() => {
      const input = document.querySelector('.quick-add-input') as HTMLInputElement;
      if (input) input.focus();
    }, 50);
  }

  cancelQuickAdd(): void {
    this.quickAddSlot = null;
    this.quickAddTitle = '';
    this.quickAddCategory = 'activity';
  }

  submitQuickAdd(slot: string): void {
    const title = this.quickAddTitle.trim();
    if (!title) return;

    const activeDay = this.days[this.activeDayIndex];
    if (!activeDay?.date) return;

    const destinationId = this.destinations.length > 0 ? (this.destinations[0].id || '') : '';
    const startTime = slot; // Already in HH:mm format
    const endTime = this.addOneHour(startTime);

    const tempItem: ItineraryItemResponse = {
      id: 'temp-' + Date.now(),
      tripId: this.tripId,
      destinationId,
      tripPlaceId: null,
      title,
      category: this.quickAddCategory,
      scheduledDate: this.formatDate(activeDay.date),
      startTime,
      endTime,
      notes: null,
      createdAt: new Date().toISOString()
    };
    this.itineraryItems.push(tempItem);

    this.quickAddSlot = null;
    this.quickAddTitle = '';

    const dto: CreateItineraryItemDto = {
      destinationId,
      tripPlaceId: null,
      title,
      category: this.quickAddCategory,
      scheduledDate: this.formatDate(activeDay.date),
      startTime,
      endTime
    };

    this.tripService.createItineraryItem(this.tripId, dto).subscribe({
      next: (item) => {
        const listIdx = this.itineraryItems.findIndex(i => i.id === tempItem.id);
        if (listIdx >= 0) this.itineraryItems[listIdx] = item;
        this.toastr.success(`"${title}" added`);
      },
      error: () => {
        this.itineraryItems = this.itineraryItems.filter(i => i.id !== tempItem.id);
        this.toastr.error('Failed to add item');
      }
    });
  }

  // ===== Remove / Unschedule =====
  removeItem(item: ItineraryItemResponse): void {
    this.unscheduleItem(item);
  }

  private unscheduleItem(item: ItineraryItemResponse): void {
    this.tripService.deleteItineraryItem(this.tripId, item.id).subscribe({
      next: () => {
        this.itineraryItems = this.itineraryItems.filter(i => i.id !== item.id);
        this.toastr.success(`${item.title} unscheduled`);
      },
      error: () => {
        this.toastr.error('Failed to remove item');
      }
    });
  }

  // ===== Schedule a place at a given time =====
  private schedulePlaceAtTime(place: TripPlaceDetailResponse, startTime: string, endTime: string): void {
    const activeDay = this.days[this.activeDayIndex];
    if (!activeDay?.date) return;

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
        const listIdx = this.itineraryItems.findIndex(i => i.id === tempItem.id);
        if (listIdx >= 0) this.itineraryItems[listIdx] = item;
      },
      error: () => {
        this.itineraryItems = this.itineraryItems.filter(i => i.id !== tempItem.id);
        this.toastr.error('Failed to schedule item');
      }
    });
  }

  // ===== Item detail dialog =====
  openItemDetail(item: ItineraryItemResponse, event: Event): void {
    event.stopPropagation();
    // Don't open if we just dragged or resized
    if (this.didDrag || this.didResize) return;

    let destName = '';
    for (const dest of this.destinations) {
      if (dest.id === item.destinationId) {
        destName = dest.name;
        break;
      }
    }
    if (!destName && this.destinations.length > 0) destName = this.destinations[0].name;

    const dialogRef = this.dialog.open(ItineraryItemDetailComponent, {
      panelClass: 'custom-dialog-container',
      data: { item, destinationName: destName } as ItineraryItemDetailData
    });

    dialogRef.afterClosed().subscribe((result: ItineraryItemDetailResult | null) => {
      if (!result) return;
      if (result.action === 'deleted') {
        this.itineraryItems = this.itineraryItems.filter(i => i.id !== item.id);
      } else if (result.action === 'updated' && result.item) {
        const idx = this.itineraryItems.findIndex(i => i.id === item.id);
        if (idx >= 0) this.itineraryItems[idx] = result.item;
      }
    });
  }

  // ===== Scroll to earliest item on load =====
  private scrollToEarliestItem(dayItems: ItineraryItemResponse[]): void {
    setTimeout(() => {
      if (!this.scheduleColRef?.nativeElement) return;
      const el = this.scheduleColRef.nativeElement;
      let targetSlotIndex = 8; // Default: 8 AM

      if (dayItems.length > 0) {
        const itemsWithTime = dayItems.filter(i => i.startTime);
        if (itemsWithTime.length > 0) {
          const earliest = itemsWithTime.reduce((min, item) =>
            item.startTime! < min.startTime! ? item : min
          );
          const [h] = earliest.startTime!.split(':').map(Number);
          targetSlotIndex = Math.max(0, h - 1);
        }
      }

      el.scrollTop = targetSlotIndex * HOUR_HEIGHT;
    }, 100);
  }

  // ===== Day / destination helpers =====
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
    const validDates = new Set(this.days.filter(d => d.date).map(d => this.formatDate(d.date!)));
    const scheduledPlaceIds = new Set(
      this.itineraryItems
        .filter(i => i.tripPlaceId && validDates.has(i.scheduledDate.split('T')[0]))
        .map(i => i.tripPlaceId!)
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

  // ===== Display helpers =====
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
    if (category === 'other') return '#94a3b8';
    return '#94a3b8';
  }

  getCategoryLabel(category: string): string {
    if (category === 'stay') return 'Stay';
    if (category === 'food') return 'Food';
    if (category === 'transport') return 'Transport';
    if (category === 'other') return 'Other';
    return 'Activity';
  }

  formatTimeDisplay(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  getHalfHourLabel(hourIndex: number): string {
    const h = hourIndex;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:30`;
  }

  getPlacesForDest(dest: { name: string; id?: string; places?: TripPlaceDetailResponse[] }): TripPlaceDetailResponse[] {
    const destPlaces = dest.places || [];
    const validDates = new Set(this.days.filter(d => d.date).map(d => this.formatDate(d.date!)));
    const scheduledPlaceIds = new Set(
      this.itineraryItems
        .filter(i => i.tripPlaceId && validDates.has(i.scheduledDate.split('T')[0]))
        .map(i => i.tripPlaceId!)
    );
    return destPlaces.filter(p => !scheduledPlaceIds.has(p.id));
  }

  getPlacesForDestByCategory(dest: { name: string; id?: string; places?: TripPlaceDetailResponse[] }, category: string): TripPlaceDetailResponse[] {
    return this.getPlacesForDest(dest).filter(p => p.category === category);
  }

  // ===== Time utility methods =====
  private getShortDayName(date: Date): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private addOneHour(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const newHour = (h + 1) % 24;
    return `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.min(23, Math.max(0, Math.floor(total / 60)));
    const newM = Math.max(0, total % 60);
    return `${newH.toString().padStart(2, '0')}:${Math.min(59, newM).toString().padStart(2, '0')}`;
  }

  private getDurationMinutes(item: ItineraryItemResponse): number {
    if (!item.startTime || !item.endTime) return 60;
    const [sh, sm] = item.startTime.split(':').map(Number);
    const [eh, em] = item.endTime.split(':').map(Number);
    return Math.max(15, (eh * 60 + em) - (sh * 60 + sm));
  }
}
