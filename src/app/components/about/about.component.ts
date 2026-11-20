import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

/**
 * About: why Wayraa exists, who builds it, what it stands for, where it is now,
 * and how to get in touch (feedback and partnerships).
 *
 * The founder photo is assets/images/about/prabhat-headshot.jpg (square crop of prabhat.jpg); until that file exists
 * the card shows initials instead.
 */
@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  standalone: false
})
export class AboutComponent implements AfterViewInit, OnDestroy {
  readonly email = 'support@wayraa.com';
  readonly year = new Date().getFullYear();
  /** False once the photo fails to load (shows initials instead). */
  photoOk = true;

  readonly values = [
    { icon: 'users', title: 'Plan together', text: 'One plan the whole group shares, live. No more screenshots, spreadsheets and twenty versions in the group chat.' },
    { icon: 'pin', title: 'Places worth going', text: 'Stays, food and things to do with real ratings and photos, so you spend less time searching and more time deciding.' },
    { icon: 'book', title: 'Honest stories', text: 'Trips shared by real travellers, with the places they went and what they spent. Not ads, not influencers.' },
    { icon: 'lock', title: 'Your data is yours', text: 'No ads, and we don\'t sell your information. Delete your account and your data any time.' },
  ];

  readonly milestones = [
    { when: 'College', title: 'The first attempts', text: 'Travel websites built in college. Some never launched; each one taught something.' },
    { when: 'The problem', title: 'Planning by spreadsheet', text: 'Excel sheets, endless discussions and plans that kept changing, with no single place for everyone.' },
    { when: 'Today', title: 'Wayraa', text: 'Free in beta on the web and Android, with the iPhone app in testing.' },
  ];

  private observer?: IntersectionObserver;

  /** False while pages are pre-rendered at build time (no window, animations or observers then). */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private router: Router, private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  startPlanning(): void { this.router.navigate(['/']); }

  /** Sections fade up as they come into view (skipped with reduced motion). */
  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const items = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('in'));
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) { e.target.classList.add('in'); this.observer?.unobserve(e.target); }
        });
      }, { threshold: 0.15 });
      items.forEach(el => this.observer!.observe(el));
    });
  }

  ngOnDestroy(): void { this.observer?.disconnect(); }
}
