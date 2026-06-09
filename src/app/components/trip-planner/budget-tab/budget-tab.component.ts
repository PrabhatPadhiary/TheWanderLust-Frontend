import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import {
  TripService,
  TripMemberResponse,
  TripExpenseResponse
} from '../../../services/trip.service';
import { AuthService } from '../../../services/auth.service';
import { AddExpenseModalComponent } from './add-expense-modal/add-expense-modal.component';

export interface BudgetExpense {
  id: string;
  title: string;
  category: 'stay' | 'food' | 'activity' | 'transport' | 'other';
  amount: number;
  date: string;
  paidByMemberId: string;
  paidBy: string;
  notes?: string;
}

@Component({
  selector: 'app-budget-tab',
  templateUrl: './budget-tab.component.html',
  styleUrls: ['./budget-tab.component.scss'],
  standalone: false
})
export class BudgetTabComponent implements OnInit, OnChanges {
  @Input() tripId: string = '';
  @Input() tripName: string = '';
  @Input() fromDate: string | null = null;
  @Input() toDate: string | null = null;
  @Input() travellers: number = 1;
  @Input() members: TripMemberResponse[] = [];
  @Input() initialBudget: number | null = null;
  @Input() initialCurrency: string | null = null;
  @Input() userRole: 'owner' | 'member' | 'viewer' = 'viewer';
  @Output() budgetChanged = new EventEmitter<{ totalBudget: number; currency: string }>();

  get isOwner(): boolean { return this.userRole === 'owner'; }
  get canEdit(): boolean { return this.userRole === 'owner' || this.userRole === 'member'; }

  canEditExpense(exp: BudgetExpense): boolean {
    if (this.userRole === 'owner') return true;
    if (this.userRole === 'member') {
      // Editor can only edit/delete their own expenses
      const currentUserId = this.authService.currentUser?.id;
      return !!currentUserId && exp.paidByMemberId === currentUserId;
    }
    return false;
  }

  currency: string = '₹';

  readonly currencyOptions = [
    { symbol: '₹', label: 'INR (₹)' },
    { symbol: '$', label: 'USD ($)' },
    { symbol: '€', label: 'EUR (€)' },
    { symbol: '£', label: 'GBP (£)' },
    { symbol: '¥', label: 'JPY (¥)' },
    { symbol: 'A$', label: 'AUD (A$)' },
    { symbol: 'S$', label: 'SGD (S$)' },
    { symbol: 'AED', label: 'AED' },
    { symbol: 'THB฿', label: 'THB (฿)' },
  ];

  totalBudget: number = 0;
  expenses: BudgetExpense[] = [];
  loadingExpenses = false;

  activeExpenseFilter: 'all' | 'stay' | 'food' | 'activity' | 'transport' | 'other' = 'all';

  // Budget panel state
  showBudgetPanel = false;
  newBudget: number | null = null;
  selectedCurrency: string = '₹';
  savingBudget = false;

  // Inline modal state (kept for fallback compatibility)
  showAddExpense = false;
  editingExpense: BudgetExpense | null = null;
  newTitle: string = '';
  newCategory: BudgetExpense['category'] = 'other';
  newAmount: number | null = null;
  newDate: string = '';
  newPaidBy: string = '';
  newNotes: string = '';

  constructor(
    private dialog: MatDialog,
    private tripService: TripService,
    private toastr: ToastrService,
    private authService: AuthService
  ) {}

  readonly categories: BudgetExpense['category'][] = ['stay', 'food', 'activity', 'transport', 'other'];

  readonly categoryLabels: Record<BudgetExpense['category'], string> = {
    stay: 'Stays', food: 'Food', activity: 'Activities', transport: 'Transport', other: 'Other'
  };

  readonly categoryColors: Record<BudgetExpense['category'], string> = {
    stay: '#2563eb', food: '#dc2626', activity: '#16a34a', transport: '#d97706', other: '#9333ea'
  };

  readonly categoryEmoji: Record<BudgetExpense['category'], string> = {
    stay: '🏨', food: '🍽️', activity: '🎯', transport: '🚗', other: '💳'
  };

  ngOnInit(): void {
    if (this.initialBudget) {
      this.totalBudget = this.initialBudget;
    }
    if (this.tripId) {
      // API-stored currency takes priority, fall back to localStorage
      this.currency = this.initialCurrency || localStorage.getItem(`trip_currency_${this.tripId}`) || '₹';
      this.loadExpenses();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Load expenses when tripId first becomes available (async trip load)
    if (changes['tripId'] && changes['tripId'].currentValue && !changes['tripId'].previousValue) {
      this.currency = this.initialCurrency || localStorage.getItem(`trip_currency_${changes['tripId'].currentValue}`) || '₹';
      this.loadExpenses();
    }
    if (changes['initialBudget'] && changes['initialBudget'].currentValue) {
      this.totalBudget = changes['initialBudget'].currentValue;
    }
    if (changes['initialCurrency'] && changes['initialCurrency'].currentValue) {
      this.currency = changes['initialCurrency'].currentValue;
    }
  }

  private loadExpenses(): void {
    if (!this.tripId) return;
    this.loadingExpenses = true;
    this.tripService.getExpenses(this.tripId).subscribe({
      next: (res) => {
        this.expenses = res.map(e => this.mapExpense(e));
        this.loadingExpenses = false;
      },
      error: () => {
        this.loadingExpenses = false;
      }
    });
  }

  private mapExpense(e: TripExpenseResponse): BudgetExpense {
    return {
      id: e.id,
      title: e.title,
      category: e.category,
      amount: e.amount,
      date: e.date ? e.date.split('T')[0] : '',
      paidByMemberId: e.paidByMemberId,
      paidBy: e.paidByName,
      notes: e.notes
    };
  }

  // ===== COMPUTED =====

  get totalSpent(): number {
    return this.expenses.reduce((s, e) => s + e.amount, 0);
  }

  get remaining(): number {
    return this.totalBudget - this.totalSpent;
  }

  get perPerson(): number {
    return this.travellers > 0 ? Math.round(this.totalSpent / this.travellers) : this.totalSpent;
  }

  get spentPercent(): number {
    return this.totalBudget > 0 ? Math.min((this.totalSpent / this.totalBudget) * 100, 100) : 0;
  }

  getCategorySpent(cat: BudgetExpense['category']): number {
    return this.expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
  }

  getCategoryPercent(cat: BudgetExpense['category']): number {
    if (!this.totalBudget) return 0;
    return Math.round((this.getCategorySpent(cat) / this.totalBudget) * 100);
  }

  getCategorySpendPercent(cat: BudgetExpense['category']): number {
    if (!this.totalSpent) return 0;
    return Math.round((this.getCategorySpent(cat) / this.totalSpent) * 100);
  }

  getActiveCategories(): BudgetExpense['category'][] {
    return this.categories.filter(cat => this.getCategorySpent(cat) > 0);
  }

  getCategoryBarPercent(cat: BudgetExpense['category']): number {
    if (!this.totalBudget) return 0;
    return Math.min((this.getCategorySpent(cat) / this.totalBudget) * 100, 100);
  }

  getSegmentWidth(cat: BudgetExpense['category']): number {
    if (!this.totalBudget) return 0;
    return (this.getCategorySpent(cat) / this.totalBudget) * 100;
  }

  getPersonTotal(name: string): number {
    return this.expenses.filter(e => e.paidBy === name).reduce((s, e) => s + e.amount, 0);
  }

  getPersonInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  get uniquePayers(): string[] {
    return [...new Set(this.expenses.map(e => e.paidBy).filter(Boolean))];
  }

  get filteredExpenses(): BudgetExpense[] {
    if (this.activeExpenseFilter === 'all') return [...this.expenses].reverse();
    return this.expenses.filter(e => e.category === this.activeExpenseFilter).reverse();
  }

  getDaysLeft(): number | null {
    if (!this.fromDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(this.fromDate);
    start.setHours(0, 0, 0, 0);
    const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }

  // ===== BUDGET =====

  openBudgetPanel(): void {
    this.newBudget = this.totalBudget > 0 ? this.totalBudget : null;
    this.selectedCurrency = this.currency;
    this.showBudgetPanel = true;
  }

  closeBudgetPanel(): void {
    this.showBudgetPanel = false;
    this.newBudget = null;
  }

  saveBudget(): void {
    if (!this.newBudget || this.newBudget <= 0 || !this.tripId) return;
    this.savingBudget = true;
    this.tripService.setBudget(this.tripId, { totalBudget: this.newBudget, currency: this.selectedCurrency }).subscribe({
      next: (res) => {
        this.totalBudget = res.totalBudget;
        this.currency = res.currency || this.selectedCurrency;
        localStorage.setItem(`trip_currency_${this.tripId}`, this.currency);
        this.budgetChanged.emit({ totalBudget: res.totalBudget, currency: this.currency });
        this.savingBudget = false;
        this.showBudgetPanel = false;
        this.toastr.success('Budget saved');
      },
      error: () => {
        this.savingBudget = false;
        this.toastr.error('Could not save budget');
      }
    });
  }

  // ===== EXPENSES =====

  openAddExpense(): void {
    const dialogRef = this.dialog.open(AddExpenseModalComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        members: this.members,
        currency: this.currency,
        fromDate: this.fromDate,
        tripId: this.tripId
      } as import('./add-expense-modal/add-expense-modal.component').AddExpenseModalData
    });

    dialogRef.afterClosed().subscribe((result: { expense: any; action: string } | undefined) => {
      if (!result) return;
      this.expenses.push(this.mapExpense(result.expense));
      this.toastr.success('Expense added');
    });
  }

  editExpense(exp: BudgetExpense): void {
    const dialogRef = this.dialog.open(AddExpenseModalComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        members: this.members,
        currency: this.currency,
        fromDate: this.fromDate,
        tripId: this.tripId,
        expense: exp
      } as import('./add-expense-modal/add-expense-modal.component').AddExpenseModalData
    });

    dialogRef.afterClosed().subscribe((result: { expense: any; action: string } | undefined) => {
      if (!result) return;
      const idx = this.expenses.findIndex(e => e.id === exp.id);
      if (idx > -1) this.expenses[idx] = this.mapExpense(result.expense);
      this.toastr.success('Expense updated');
    });
  }

  deleteExpense(exp: BudgetExpense): void {
    if (!this.tripId) return;
    // Optimistic removal
    this.expenses = this.expenses.filter(e => e.id !== exp.id);
    this.tripService.deleteExpense(this.tripId, exp.id).subscribe({
      next: () => {
        this.toastr.success(`${exp.title} removed`);
      },
      error: () => {
        // Restore on failure
        this.expenses.push(exp);
        this.toastr.error('Could not delete expense');
      }
    });
  }

  // ===== FALLBACK (inline modal — not used but kept for safety) =====
  cancelAddExpense(): void { this.showAddExpense = false; this.editingExpense = null; }
  saveExpense(): void {
    if (!this.newTitle || !this.newAmount) return;
    this.cancelAddExpense();
  }
}
