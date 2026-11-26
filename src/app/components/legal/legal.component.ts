import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Wayraa's Privacy Policy (/privacy), Terms of Use (/terms) and Child Safety
 * Standards (/child-safety), one layout for all three. The mobile app links here (Welcome, Sign up, Profile), and the URLs go
 * in Google's OAuth consent screen and the app store listings.
 *
 * Which document to show comes from the route's data: { doc: 'privacy' | 'terms' | 'child-safety' }.
 * The child safety page is the one Google Play asks for (App content → Child
 * safety standards) for apps where people post content.
 * When changing either text, update LAST_UPDATED.
 */
@Component({
  selector: 'app-legal',
  templateUrl: './legal.component.html',
  styleUrls: ['./legal.component.scss'],
  standalone: false
})
export class LegalComponent {
  readonly LAST_UPDATED = '26 November 2026';
  readonly SUPPORT_EMAIL = 'support@wayraa.com';

  doc: 'privacy' | 'terms' | 'child-safety';

  constructor(route: ActivatedRoute) {
    const doc = route.snapshot.data['doc'];
    this.doc = doc === 'terms' || doc === 'child-safety' ? doc : 'privacy';
  }
}
