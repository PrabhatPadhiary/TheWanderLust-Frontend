import { Component } from '@angular/core';

/**
 * /delete-account: how to delete a Wayraa account, in the app, on the web or
 * by email, and what happens to your data. Public (no sign-in needed): Google
 * Play requires a web link where people can ask for their account to be
 * deleted without the app. The link goes in Play Console's Data safety form.
 *
 * Keep it in step with section 6 of the Privacy Policy (legal.component.html).
 */
@Component({
  selector: 'app-delete-account',
  templateUrl: './delete-account.component.html',
  styleUrls: ['./delete-account.component.scss'],
  standalone: false
})
export class DeleteAccountComponent {
  readonly SUPPORT_EMAIL = 'support@wayraa.com';
  readonly year = new Date().getFullYear();

  /** A ready-made email asking us to delete the account. */
  get mailto(): string {
    const subject = encodeURIComponent('Delete my Wayraa account');
    const body = encodeURIComponent(
      'Hello,\n\nPlease delete my Wayraa account and its data.\n\n' +
      'The email address on my account: \n\n' +
      '(Please send this from the email address on your account, so we can confirm it\'s you.)\n'
    );
    return `mailto:${this.SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }
}
