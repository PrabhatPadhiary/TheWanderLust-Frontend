import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

const OVERLAY_ROUTES = ['/favourites', '/my-trips'];

@Injectable({ providedIn: 'root' })
export class NavHistoryService {
  private lastContentUrl: string = '/';

  constructor(private router: Router) {
    // Capture the current URL at boot (handles direct loads and page refreshes)
    const initialUrl = this.router.url;
    if (initialUrl && !OVERLAY_ROUTES.some(r => initialUrl.startsWith(r))) {
      this.lastContentUrl = initialUrl;
    }

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        const url: string = e.urlAfterRedirects;
        if (!OVERLAY_ROUTES.some(r => url.startsWith(r))) {
          this.lastContentUrl = url;
        }
      });
  }

  goBack(): void {
    this.router.navigateByUrl(this.lastContentUrl);
  }
}
