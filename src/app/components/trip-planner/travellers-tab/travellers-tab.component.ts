import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TripService, TripMemberResponse, TripExpenseResponse, PendingInvitationResponse } from '../../../services/trip.service';
import { AuthService } from '../../../services/auth.service';
import { RemoveMemberConfirmComponent, RemoveMemberConfirmData } from '../modals/remove-member-confirm/remove-member-confirm.component';

export interface SettleUpEntry {
  from: string;
  fromId: string;
  to: string;
  toId: string;
  amount: number;
}

@Component({
  selector: 'app-travellers-tab',
  templateUrl: './travellers-tab.component.html',
  styleUrls: ['./travellers-tab.component.scss'],
  standalone: false
})
export class TravellersTabComponent implements OnInit, OnChanges {
  @Input() tripId: string = '';
  @Input() tripName: string = '';
  @Input() destination: string = '';
  @Input() members: TripMemberResponse[] = [];
  @Input() travellers: number = 0;
  @Input() userRole: 'owner' | 'member' | 'viewer' = 'viewer';
  @Input() currency: string = '₹';
  @Input() totalBudget: number | null = null;
  @Output() membersChanged = new EventEmitter<TripMemberResponse[]>();

  expenses: TripExpenseResponse[] = [];
  loadingExpenses = false;
  pendingInvites: PendingInvitationResponse[] = [];

  // Invite link state
  inviteRole: 'member' | 'viewer' = 'member';
  inviteUrl: string = '';
  inviteCopied = false;
  generatingInvite = false;

  get isOwner(): boolean { return this.userRole === 'owner'; }
  get canInvite(): boolean { return this.userRole === 'owner' || this.userRole === 'member'; }

  get currentUserId(): string {
    return this.authService.currentUser?.id || '';
  }

  constructor(
    private tripService: TripService,
    private authService: AuthService,
    private toastr: ToastrService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    if (this.tripId) {
      this.loadExpenses();
      this.loadPendingInvites();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tripId'] && changes['tripId'].currentValue && !changes['tripId'].previousValue) {
      this.loadExpenses();
      this.loadPendingInvites();
    }
    if (changes['userRole'] && this.tripId) {
      this.loadPendingInvites();
    }
  }

  private loadExpenses(): void {
    if (!this.tripId) return;
    this.loadingExpenses = true;
    this.tripService.getExpenses(this.tripId).subscribe({
      next: (res) => { this.expenses = res; this.loadingExpenses = false; },
      error: () => { this.loadingExpenses = false; }
    });
  }

  private loadPendingInvites(): void {
    if (!this.tripId || !this.canInvite) return;
    this.tripService.getInvitations(this.tripId).subscribe({
      next: (res) => {
        // Only show unused and not-expired invites
        const now = new Date().getTime();
        this.pendingInvites = res.filter(i => !i.usedBy && new Date(i.expiresAt).getTime() > now);
      },
      error: () => {}
    });
  }

  revokeInvite(invite: PendingInvitationResponse): void {
    this.tripService.revokeInvitation(this.tripId, invite.id).subscribe({
      next: () => {
        this.pendingInvites = this.pendingInvites.filter(i => i.id !== invite.id);
        this.toastr.success('Invite revoked');
      },
      error: () => {
        this.toastr.error('Could not revoke invite');
      }
    });
  }

  // ===== MEMBER HELPERS =====

  getMemberInitial(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  getRoleLabel(role: string): string {
    if (role === 'owner') return 'Owner';
    if (role === 'viewer') return 'Viewer';
    return 'Editor';
  }

  getMemberSpent(userId: string): number {
    return this.expenses
      .filter(e => e.paidByMemberId === userId)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  get totalSpent(): number {
    return this.expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  get fairShare(): number {
    const count = this.members.length;
    return count > 0 ? Math.round(this.totalSpent / count) : 0;
  }

  isCurrentUser(userId: string): boolean {
    return userId === this.currentUserId;
  }

  // ===== SETTLE UP =====

  get settleUpEntries(): SettleUpEntry[] {
    if (this.members.length < 2 || this.totalSpent === 0) return [];

    const fair = this.totalSpent / this.members.length;
    const balances = this.members.map(m => ({
      userId: m.userId,
      name: m.name,
      balance: this.getMemberSpent(m.userId) - fair
    }));

    // Sort: debtors (negative) first, creditors (positive) last
    const debtors = balances.filter(b => b.balance < -0.5).sort((a, b) => a.balance - b.balance);
    const creditors = balances.filter(b => b.balance > 0.5).sort((a, b) => b.balance - a.balance);

    const entries: SettleUpEntry[] = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(-debtors[i].balance, creditors[j].balance);
      if (amount > 0.5) {
        entries.push({
          from: debtors[i].name,
          fromId: debtors[i].userId,
          to: creditors[j].name,
          toId: creditors[j].userId,
          amount: Math.round(amount)
        });
      }
      debtors[i].balance += amount;
      creditors[j].balance -= amount;
      if (Math.abs(debtors[i].balance) < 0.5) i++;
      if (Math.abs(creditors[j].balance) < 0.5) j++;
    }

    return entries;
  }

  get isSettled(): boolean {
    return this.totalSpent > 0 && this.settleUpEntries.length === 0;
  }

  // ===== ROLE MANAGEMENT =====

  roleDropdownOpenFor: string | null = null;

  @HostListener('document:click')
  closeRoleDropdowns(): void {
    this.roleDropdownOpenFor = null;
  }

  toggleRoleDropdown(userId: string, event: Event): void {
    event.stopPropagation();
    this.roleDropdownOpenFor = this.roleDropdownOpenFor === userId ? null : userId;
  }

  changeRole(member: TripMemberResponse, newRole: string): void {
    if (member.role === newRole) return;
    const oldRole = member.role;
    member.role = newRole; // Optimistic

    this.tripService.updateMemberRole(this.tripId, member.userId, newRole).subscribe({
      next: () => {
        this.toastr.success(`${member.name.split(' ')[0]} is now ${this.getRoleLabel(newRole)}`);
        this.membersChanged.emit([...this.members]);
      },
      error: () => {
        member.role = oldRole;
        this.toastr.error('Could not change role');
      }
    });
  }

  removeMember(member: TripMemberResponse): void {
    const dialogRef = this.dialog.open(RemoveMemberConfirmComponent, {
      panelClass: 'custom-dialog-container',
      data: { memberName: member.name } as RemoveMemberConfirmData
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      const idx = this.members.indexOf(member);
      this.members.splice(idx, 1);

      this.tripService.removeMember(this.tripId, member.userId).subscribe({
        next: () => {
          this.toastr.success(`${member.name.split(' ')[0]} removed`);
          this.membersChanged.emit([...this.members]);
        },
        error: () => {
          this.members.splice(idx, 0, member);
          this.toastr.error('Could not remove member');
        }
      });
    });
  }

  // ===== INVITE =====

  generateInvite(): void {
    if (this.generatingInvite) return;
    this.generatingInvite = true;
    this.inviteUrl = '';
    this.inviteCopied = false;

    this.tripService.createInvitation(this.tripId, this.inviteRole).subscribe({
      next: (res) => {
        this.inviteUrl = `${window.location.origin}/join/${res.id}`;
        this.generatingInvite = false;
        // Refresh pending invites list
        this.loadPendingInvites();
      },
      error: () => {
        this.generatingInvite = false;
        this.toastr.error('Could not generate invite link');
      }
    });
  }

  copyInviteLink(): void {
    if (!this.inviteUrl) return;
    navigator.clipboard.writeText(this.inviteUrl).then(() => {
      this.inviteCopied = true;
      setTimeout(() => { this.inviteCopied = false; }, 2000);
    });
  }

  get inviteRoleLabel(): string {
    return this.inviteRole === 'member' ? 'Editor' : 'Viewer';
  }

  get hasNativeShare(): boolean {
    return !!navigator.share;
  }

  shareVia(platform: 'whatsapp' | 'telegram' | 'twitter' | 'email' | 'native'): void {
    if (!this.inviteUrl) return;
    const text = `Join my trip "${this.tripName}" on WanderLust!`;
    const fullMessage = `${text}\n${this.inviteUrl}`;
    const encoded = encodeURIComponent(fullMessage);
    const encodedUrl = encodeURIComponent(this.inviteUrl);
    const encodedText = encodeURIComponent(text);

    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank');
        break;
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent('Join my trip on WanderLust')}&body=${encoded}`;
        break;
      case 'native':
        if (navigator.share) {
          navigator.share({ title: text, url: this.inviteUrl }).catch(() => {});
        }
        break;
    }
  }
}
