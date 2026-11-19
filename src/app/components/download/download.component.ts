import { Component } from '@angular/core';

/**
 * /download: the Wayraa Android app (beta) for anyone to install.
 *
 * The APK is hosted on GitHub Releases (too big for the website itself, and
 * Expo's links expire). APK_URL always points at the *latest* release's
 * `wayraa-beta.apk`, so for a new version: create a GitHub release (not marked
 * "pre-release", or "latest" skips it) with the file named exactly
 * wayraa-beta.apk, then update VERSION / UPDATED / SIZE below.
 */
@Component({
  selector: 'app-download',
  templateUrl: './download.component.html',
  styleUrls: ['./download.component.scss'],
  standalone: false
})
export class DownloadComponent {
  readonly APK_URL = 'https://github.com/PrabhatPadhiary/Wayraa-Mobile/releases/latest/download/wayraa-beta.apk';
  readonly VERSION = '1.3.0';
  readonly UPDATED = '17 November 2026';
  readonly SIZE = '116 MB';

  // No navigator while the page is pre-rendered at build time: show the general version.
  private readonly ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  readonly isAndroid = /Android/i.test(this.ua);
  readonly isIOS = /iPhone|iPad|iPod/i.test(this.ua);
}
