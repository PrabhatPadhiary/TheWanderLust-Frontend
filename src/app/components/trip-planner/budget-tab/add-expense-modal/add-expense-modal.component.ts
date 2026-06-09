import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TripMemberResponse } from '../../../../services/trip.service';
import { BudgetExpense } from '../budget-tab.component';

export interface AddExpenseModalData {
  members: TripMemberResponse[];
  expense?: BudgetExpense; // present when editing
  currency: string;
  fromDate: string | null;
}

export interface AddExpenseModalResult {
  title: string;
  category: BudgetExpense['category'];
  amount: number;
  date: string;
  paidByMemberId: string;
  paidByName: string;
  notes: string;
}

@Component({
  selector: 'app-add-expense-modal',
  templateUrl: './add-expense-modal.component.html',
  styleUrls: ['./add-expense-modal.component.scss'],
  standalone: false
})
export class AddExpenseModalComponent {
  title: string = '';
  category: BudgetExpense['category'] = 'other';
  amount: number | null = null;
  dateObj: Date | null = null;
  paidByMemberId: string = '';
  notes: string = '';
  memberDropdownOpen = false;

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

  get isEditing(): boolean {
    return !!this.data.expense;
  }

  constructor(
    public dialogRef: MatDialogRef<AddExpenseModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddExpenseModalData
  ) {
    this.dateObj = data.fromDate ? new Date(data.fromDate) : new Date();

    if (data.expense) {
      this.title = data.expense.title;
      this.category = data.expense.category;
      this.amount = data.expense.amount;
      this.dateObj = data.expense.date ? new Date(data.expense.date) : new Date();
      this.paidByMemberId = data.expense.paidByMemberId ?? '';
      this.notes = data.expense.notes ?? '';
    }

    // Default paid by to first member if available
    if (!this.paidByMemberId && data.members.length > 0) {
      this.paidByMemberId = data.members[0].userId;
    }
  }

  getMemberInitial(name: string): string {
    return name?.charAt(0).toUpperCase() ?? '?';
  }

  getSelectedMemberName(): string {
    const m = this.data.members.find(m => m.userId === this.paidByMemberId);
    return m?.name ?? '';
  }

  get isValid(): boolean {
    return !!this.title.trim() && !!this.amount && this.amount > 0 && !!this.paidByMemberId;
  }

  save(): void {
    if (!this.isValid) return;
    const member = this.data.members.find(m => m.userId === this.paidByMemberId);
    const fmt = (d: Date | null) => d ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const result: AddExpenseModalResult = {
      title: this.title.trim(),
      category: this.category,
      amount: this.amount!,
      date: fmt(this.dateObj),
      paidByMemberId: this.paidByMemberId,
      paidByName: member?.name ?? '',
      notes: this.notes.trim()
    };
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
