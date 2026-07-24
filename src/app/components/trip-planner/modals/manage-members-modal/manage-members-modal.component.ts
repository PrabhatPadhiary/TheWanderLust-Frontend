import { Component, Inject, HostListener } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { TripService, TripMemberResponse, PendingInvitationResponse } from '../../../../services/trip.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { RemoveMemberConfirmComponent, RemoveMemberConfirmData } from '../remove-member-confirm/remove-member-confirm.component';

export interface ManageMembersModalData {
  tripId: string;
  tripName: string;
  members: TripMemberResponse[];
  userRole: 'owner' | 'member' | 'viewer';
}

@Component({
  selector: 'app-manage-members-modal',
  templateUrl: './manage-members-modal.component.html',
  styleUrls: ['./manage-members-modal.component.scss'],
  standalone: false
})
export class ManageMembersModalComponent {
  members: TripMemberResponse[];
  pendingInvites: PendingInvitationResponse[] = [];
  roleDropdownOpenFor: string | null = null;

  // Invite state
  inviteRole: 'member' | 'viewer' = 'member';
  inviteUrl = '';
  inviteCopied = false;
  generatingInvite = false;

  get isOwner(): boolean { return this.data.userRole === 'owner'; }
  get canInvite(): boolean { return this.data.userRole === 'owner' || this.data.userRole === 'member'; }
  get currentUserId(): string { return this.authService.currentUser?.id || ''; }

  constructor(
    public dialogRef: MatDialogRef<ManageMembersModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ManageMembersModalData,
    private dialog: MatDialog,
    private tripService: TripService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.members = [...data.members];
    this.loadPendingInvites();
    this.dialogRef.backdropClick().subscribe(() => this.close());
  }

  @HostListener('document:click')
  closeRoleDropdowns(): void { this.roleDropdownOpenFor = null; }

  private loadPendingInvites(): void {
    if (!this.canInvite) return;
    this.tripService.getInvitations(this.data.tripId).subscribe({
      next: (res) => {
        const now = new Date().getTime();
        this.pendingInvites = res.filter(i => !i.usedBy && new Date(i.expiresAt).getTime() > now);
      },
      error: () => {}
    });
  }

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

  isCurrentUser(userId: string): boolean {
    return userId === this.currentUserId;
  }

  toggleRoleDropdown(userId: string, event: Event): void {
    event.stopPropagation();
    this.roleDropdownOpenFor = this.roleDropdownOpenFor === userId ? null : userId;
  }

  changeRole(member: TripMemberResponse, newRole: string): void {
    if (member.role === newRole) return;
    const oldRole = member.role;
    member.role = newRole;
    this.tripService.updateMemberRole(this.data.tripId, member.userId, newRole).subscribe({
      next: () => this.toastr.success(`${member.name.split(' ')[0]} is now ${this.getRoleLabel(newRole)}`),
      error: () => { member.role = oldRole; this.toastr.error('Could not change role'); }
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
      this.tripService.removeMember(this.data.tripId, member.userId).subscribe({
        next: () => this.toastr.success(`${member.name.split(' ')[0]} removed`),
        error: () => { this.members.splice(idx, 0, member); this.toastr.error('Could not remove member'); }
      });
    });
  }

  generateInvite(): void {
    if (this.generatingInvite) return;
    this.generatingInvite = true;
    this.inviteUrl = '';
    this.inviteCopied = false;
    this.tripService.createInvitation(this.data.tripId, this.inviteRole).subscribe({
      next: (res) => {
        this.inviteUrl = `${window.location.origin}/join/${res.id}`;
        this.generatingInvite = false;
        this.loadPendingInvites();
      },
      error: () => { this.generatingInvite = false; this.toastr.error('Could not generate invite link'); }
    });
  }

  copyInviteLink(): void {
    if (!this.inviteUrl) return;
    navigator.clipboard.writeText(this.inviteUrl).then(() => {
      this.inviteCopied = true;
      setTimeout(() => { this.inviteCopied = false; }, 2000);
    });
  }

  revokeInvite(invite: PendingInvitationResponse): void {
    this.tripService.revokeInvitation(this.data.tripId, invite.id).subscribe({
      next: () => { this.pendingInvites = this.pendingInvites.filter(i => i.id !== invite.id); this.toastr.success('Invite revoked'); },
      error: () => this.toastr.error('Could not revoke invite')
    });
  }

  shareVia(platform: 'whatsapp' | 'telegram' | 'email'): void {
    if (!this.inviteUrl) return;
    const text = `Join my trip "${this.data.tripName}" on Wayraa!`;
    const fullMessage = `${text}\n${this.inviteUrl}`;
    const encoded = encodeURIComponent(fullMessage);
    const encodedUrl = encodeURIComponent(this.inviteUrl);
    const encodedText = encodeURIComponent(text);
    switch (platform) {
      case 'whatsapp': window.open(`https://wa.me/?text=${encoded}`, '_blank'); break;
      case 'telegram': window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank'); break;
      case 'email': window.location.href = `mailto:?subject=${encodeURIComponent('Join my trip on Wayraa')}&body=${encoded}`; break;
    }
  }

  close(): void {
    this.dialogRef.close({ members: this.members });
  }
}
