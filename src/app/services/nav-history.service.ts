import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

const OVERLAY_ROUTES = ['/favourites', '/my-trips'];

@Injectable({ providedIn: 'root' })
export class NavHistoryService {
  private lastContentUrl: string = '/';
  /** Pages seen in this visit (the first one included). */
  private pagesSeen = 0;

  constructor(private router: Router, private location: Location) {
    // Capture the current URL at boot (handles direct loads and page refreshes)
    const initialUrl = this.router.url;
    if (initialUrl && !OVERLAY_ROUTES.some(r => initialUrl.startsWith(r))) {
      this.lastContentUrl = initialUrl;
    }

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.pagesSeen++;
        const url: string = e.urlAfterRedirects;
        if (!OVERLAY_ROUTES.some(r => url.startsWith(r))) {
          this.lastContentUrl = url;
        }
      });
  }

  goBack(): void {
    this.router.navigateByUrl(this.lastContentUrl);
  }

  /** True when there's an earlier page on this site to go back to (not a fresh visit from a link). */
  get canGoBack(): boolean {
    return this.pagesSeen > 1;
  }

  /** Back to wherever the person came from on the site; `fallback` when they arrived straight here. */
  back(fallback: string): void {
    if (this.canGoBack) this.location.back();
    else this.router.navigateByUrl(fallback);
  }
}
