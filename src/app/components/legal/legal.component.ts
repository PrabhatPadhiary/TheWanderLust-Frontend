import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Wayraa's Privacy Policy (/privacy) and Terms of Use (/terms), one layout for
 * both. The mobile app links here (Welcome, Sign up, Profile), and the URLs go
 * in Google's OAuth consent screen and the app store listings.
 *
 * Which document to show comes from the route's data: { doc: 'privacy' | 'terms' }.
 * When changing either text, update LAST_UPDATED.
 */
@Component({
  selector: 'app-legal',
  templateUrl: './legal.component.html',
  styleUrls: ['./legal.component.scss'],
  standalone: false
})
export class LegalComponent {
  readonly LAST_UPDATED = '13 November 2026';
  readonly SUPPORT_EMAIL = 'support@wayraa.com';

  doc: 'privacy' | 'terms';

  constructor(route: ActivatedRoute) {
    this.doc = route.snapshot.data['doc'] === 'terms' ? 'terms' : 'privacy';
  }
}
