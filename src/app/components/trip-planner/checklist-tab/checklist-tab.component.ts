import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, HostListener } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TripService, TripMemberResponse, ChecklistItemResponse, CreateChecklistItemDto } from '../../../services/trip.service';
import { AuthService } from '../../../services/auth.service';
import { AddChecklistItemModalComponent, AddChecklistItemModalData } from './add-checklist-item-modal/add-checklist-item-modal.component';

@Component({
  selector: 'app-checklist-tab',
  templateUrl: './checklist-tab.component.html',
  styleUrls: ['./checklist-tab.component.scss'],
  standalone: false
})
export class ChecklistTabComponent implements OnInit, OnChanges {
  @Input() tripId: string = '';
  @Input() tripName: string = '';
  @Input() destination: string = '';
  @Input() fromDate: string | null = null;
  @Input() toDate: string | null = null;
  @Input() members: TripMemberResponse[] = [];
  @Input() userRole: 'owner' | 'member' | 'viewer' = 'viewer';

  items: ChecklistItemResponse[] = [];
  loading = true;

  @ViewChild('addItemInput') addItemInput!: ElementRef<HTMLInputElement>;

  // Filters
  activeFilter: 'all' | 'todo' | 'done' | 'overdue' = 'all';
  activeCategoryFilter: string | null = null;

  // Add item inline
  newItemTitle: string = '';
  newItemCategory: string = 'other';
  newItemDueDate: Date | null = null;
  newItemAssignee: string = '';
  addingItem = false;
  inlineExpanded = false;
  assignDropdownOpen = false;

  @HostListener('document:click')
  closeAssignDropdown(): void { this.assignDropdownOpen = false; }

  // Show more completed
  showAllCompleted = false;

  readonly categories = ['packing', 'bookings', 'documents', 'money', 'safety', 'other'];
  readonly categoryLabels: Record<string, string> = {
    packing: 'Packing', bookings: 'Bookings', documents: 'Documents',
    money: 'Money', safety: 'Safety', other: 'Other'
  };
  readonly categoryColors: Record<string, string> = {
    packing: '#2563eb', bookings: '#7c3aed', documents: '#0891b2',
    money: '#d97706', safety: '#dc2626', other: '#6b7280'
  };

  get canEdit(): boolean { return this.userRole === 'owner' || this.userRole === 'member'; }

  get currentUserId(): string { return this.authService.currentUser?.id || ''; }

  get totalItems(): number { return this.items.length; }
  get completedItems(): number { return this.items.filter(i => i.isCompleted).length; }
  get remainingItems(): number { return this.totalItems - this.completedItems; }
  get overdueItems(): ChecklistItemResponse[] {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return this.items.filter(i => !i.isCompleted && i.dueDate && new Date(i.dueDate) < now);
  }
  get progressPercent(): number {
    return this.totalItems > 0 ? Math.round((this.completedItems / this.totalItems) * 100) : 0;
  }

  get daysLeft(): number | null {
    if (!this.fromDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(this.fromDate); start.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }

  get filteredItems(): ChecklistItemResponse[] {
    let result = [...this.items];

    if (this.activeCategoryFilter) {
      result = result.filter(i => i.category === this.activeCategoryFilter);
    }

    switch (this.activeFilter) {
      case 'todo': return result.filter(i => !i.isCompleted);
      case 'done': return result.filter(i => i.isCompleted);
      case 'overdue':
        const now = new Date(); now.setHours(0, 0, 0, 0);
        return result.filter(i => !i.isCompleted && i.dueDate && new Date(i.dueDate) < now);
      default: return result;
    }
  }

  get overdueList(): ChecklistItemResponse[] {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return this.filteredItems.filter(i => !i.isCompleted && i.dueDate && new Date(i.dueDate) < now);
  }

  get todoList(): ChecklistItemResponse[] {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return this.filteredItems.filter(i => !i.isCompleted && !(i.dueDate && new Date(i.dueDate) < now));
  }

  get doneList(): ChecklistItemResponse[] {
    return this.filteredItems.filter(i => i.isCompleted);
  }

  get visibleDoneList(): ChecklistItemResponse[] {
    return this.showAllCompleted ? this.doneList : this.doneList.slice(0, 2);
  }

  constructor(
    private tripService: TripService,
    private authService: AuthService,
    private toastr: ToastrService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    if (this.tripId) this.loadItems();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tripId'] && changes['tripId'].currentValue && !changes['tripId'].previousValue) {
      this.loadItems();
    }
  }

  private loadItems(): void {
    if (!this.tripId) return;
    this.loading = true;
    this.tripService.getChecklist(this.tripId).subscribe({
      next: (res) => { this.items = res; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  toggleItem(item: ChecklistItemResponse): void {
    const wasCompleted = item.isCompleted;
    item.isCompleted = !item.isCompleted; // Optimistic
    this.tripService.toggleChecklistItem(this.tripId, item.id).subscribe({
      next: (res) => {
        const idx = this.items.findIndex(i => i.id === item.id);
        if (idx > -1) this.items[idx] = res;
      },
      error: () => { item.isCompleted = wasCompleted; }
    });
  }

  addItem(): void {
    if (!this.newItemTitle.trim() || this.addingItem) return;
    this.addingItem = true;

    const fmt = (d: Date | null): string | null => {
      if (!d) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const dto: CreateChecklistItemDto = {
      title: this.newItemTitle.trim(),
      category: this.newItemCategory,
      dueDate: fmt(this.newItemDueDate),
      assignedToUserId: this.newItemAssignee || null
    };
    this.tripService.addChecklistItem(this.tripId, dto).subscribe({
      next: (res) => {
        this.items.push(res);
        this.newItemTitle = '';
        this.newItemCategory = 'other';
        this.newItemDueDate = null;
        this.newItemAssignee = '';
        this.addingItem = false;
        this.inlineExpanded = false;
        this.toastr.success('Item added');
      },
      error: () => {
        this.addingItem = false;
        this.toastr.error('Could not add item');
      }
    });
  }

  deleteItem(item: ChecklistItemResponse): void {
    this.items = this.items.filter(i => i.id !== item.id);
    this.tripService.deleteChecklistItem(this.tripId, item.id).subscribe({
      next: () => this.toastr.success('Item removed'),
      error: () => {
        this.items.push(item);
        this.toastr.error('Could not delete item');
      }
    });
  }

  editItem(item: ChecklistItemResponse): void {
    const dialogRef = this.dialog.open(AddChecklistItemModalComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        tripId: this.tripId,
        members: this.members,
        fromDate: this.fromDate,
        item
      } as AddChecklistItemModalData
    });

    dialogRef.afterClosed().subscribe((result: ChecklistItemResponse | undefined) => {
      if (result) {
        const idx = this.items.findIndex(i => i.id === item.id);
        if (idx > -1) this.items[idx] = result;
        this.toastr.success('Item updated');
      }
    });
  }

  isOverdue(item: ChecklistItemResponse): boolean {
    if (!item.dueDate || item.isCompleted) return false;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return new Date(item.dueDate) < now;
  }

  getMemberInitial(name: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  setFilter(filter: 'all' | 'todo' | 'done' | 'overdue'): void {
    this.activeFilter = filter;
  }

  setCategoryFilter(cat: string | null): void {
    this.activeCategoryFilter = this.activeCategoryFilter === cat ? null : cat;
  }

  getTrackStatus(): string {
    const pct = this.progressPercent;
    if (pct >= 80) return 'on track';
    if (pct >= 50) return 'in progress';
    return 'getting started';
  }

  focusAddInput(): void {
    setTimeout(() => this.addItemInput?.nativeElement?.focus(), 0);
  }

  openAddModal(): void {
    const dialogRef = this.dialog.open(AddChecklistItemModalComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        tripId: this.tripId,
        members: this.members,
        fromDate: this.fromDate
      } as AddChecklistItemModalData
    });

    dialogRef.afterClosed().subscribe((result: ChecklistItemResponse | undefined) => {
      if (result) {
        this.items.push(result);
        this.toastr.success('Item added');
      }
    });
  }
}
