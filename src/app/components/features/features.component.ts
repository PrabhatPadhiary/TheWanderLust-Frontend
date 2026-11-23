import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface Chapter {
  id: string;
  num: string;
  kicker: string;
  title: string;
  em: string;
  text: string;
  points: string[];
  /** The caption on the route to the next chapter. */
  next?: string;
  /** A real app screenshot (assets/images/app/<shot>.jpg), shown in a phone. */
  shot?: string;
  shotAlt?: string;
  /** Two small labels that float around the stop. */
  chips: [string, string];
}

/**
 * Features: one trip (Dubai and Sharjah, the same trip as the app screenshots
 * and the launch film) from first idea to the last photo.
 *
 * A route line runs down the page and draws itself as you scroll, its head
 * kept level with a point on the screen. Each feature is a numbered stop on
 * the route; between stops the line passes through a caption that leads to
 * the next one. At each stop, as you scroll, a phone with a real screenshot
 * rises in, the mock-up slides in beside it and two labels drift around them.
 * The launch film plays near the top.
 *
 * Only what the app does today. "Reduce motion" shows it all drawn.
 */
@Component({
  selector: 'app-features',
  templateUrl: './features.component.html',
  styleUrls: ['./features.component.scss'],
  standalone: false
})
export class FeaturesComponent implements AfterViewInit, OnDestroy {
  @ViewChild('journey') journeyRef!: ElementRef<HTMLElement>;
  @ViewChild('film') filmRef!: ElementRef<HTMLElement>;
  @ViewChild('filmVideo') filmVideo!: ElementRef<HTMLVideoElement>;
  /** The launch film starts muted (browsers only autoplay muted video). */
  filmMuted = true;

  readonly chapters: Chapter[] = [
    {
      id: 'discover', num: '01', kicker: 'Discover', title: 'Find the', em: 'place',
      text: 'Search any destination and see the best stays, food and things to do, with real Google ratings and photos. Or see what\'s around you right now.',
      points: ['Stays, food and things to do', 'Ratings and photos from Google', 'Places near you'],
      next: 'Love it? Save it.',
      shot: 'destination', shotAlt: 'Wayraa showing stays in Dubai, with ratings and photos',
      chips: ['★ 4.8 · 29k reviews', 'Stays · Food · Activities'],
    },
    {
      id: 'favourites', num: '02', kicker: 'Favourites', title: 'Save it for', em: 'later',
      text: 'Tap the heart on anything you like. Your favourites stay together, from every destination, ready for when you plan.',
      points: ['One tap to save', 'Every destination in one list'],
      next: 'Ready to go? Make it a trip.',
      shot: 'place', shotAlt: 'A place in Wayraa, saved with the heart',
      chips: ['♥ Saved', 'Add to trip'],
    },
    {
      id: 'trip', num: '03', kicker: 'Trips', title: 'Make it a', em: 'trip',
      text: 'Give it a name and dates, then add where you\'re going. One city or five: every stop gets its own plan.',
      points: ['Dates and stops', 'Several destinations in one trip'],
      next: 'Then plan each day.',
      shot: 'trip', shotAlt: 'A trip to Dubai and Sharjah in Wayraa',
      chips: ['2 stops · 6 days', '11 days to go'],
    },
    {
      id: 'days', num: '04', kicker: 'Itinerary', title: 'Plan every', em: 'day',
      text: 'Put places into days, set the times, and see each day on a map, so you know what\'s close and what comes next.',
      points: ['A day-by-day plan', 'A map for every day'],
      next: 'It\'s better with friends.',
      shot: 'itinerary', shotAlt: 'Day 3 in Dubai, planned and shown on a map',
      chips: ['20 min drive', '4 on the map'],
    },
    {
      id: 'together', num: '05', kicker: 'Together', title: 'Plan it', em: 'together',
      text: 'Send an invite link and your friends join the trip. Changes show up for everyone straight away, and you can see who\'s planning with you.',
      points: ['Invite with a link', 'Live updates for everyone', 'See who\'s here'],
      next: 'Now the practical bits.',
      shot: 'travellers', shotAlt: 'Inviting friends to a trip in Wayraa',
      chips: ['Riya is here', 'Invite link copied'],
    },
    {
      id: 'budget', num: '06', kicker: 'Budget and checklists', title: 'Keep it', em: 'sorted',
      text: 'Add expenses as you go and see who paid for what. Keep a shared checklist for packing and bookings, and tick things off together.',
      points: ['Expenses and who paid', 'Shared checklists'],
      next: 'Home again? Tell the story.',
      shot: 'budget', shotAlt: 'The budget for a trip to Dubai in Wayraa: spent, left and where it went',
      chips: ['19% of the budget used', '2 of 3 ticked'],
    },
    {
      id: 'stories', num: '07', kicker: 'Community', title: 'Share the', em: 'story',
      text: 'Write about the trip with your photos and the places you went, and read other travellers\' stories for your next idea.',
      points: ['Photos and places', 'Likes and comments'],
      chips: ['♥ 14', '3 comments'],
    },
  ];

  private triggers: ScrollTrigger[] = [];
  private cleanups: (() => void)[] = [];

  /** False while pages are pre-rendered at build time (no window, animations or observers then). */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private router: Router, private zone: NgZone) {}

  goToExplore(): void { this.router.navigate(['/']); }
  goToDownload(): void { this.router.navigate(['/download']); }

  /** Smooth-scroll to a chapter (from the hero's mini route). */
  jumpTo(id: string): void {
    const el = document.getElementById('ch-' + id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: reduce ? 'auto' : 'smooth' });
  }

  /** The film can be paused (it loops, so it must be): it then stays paused, even scrolled back to. */
  filmPaused = false;
  togglePlay(): void {
    const v = this.filmVideo?.nativeElement;
    if (!v) return;
    this.filmPaused = !this.filmPaused;
    if (this.filmPaused) v.pause(); else v.play().catch(() => {});
  }

  toggleSound(): void {
    const v = this.filmVideo?.nativeElement;
    if (!v) return;
    this.filmMuted = !this.filmMuted;
    v.muted = this.filmMuted;
    if (!this.filmMuted) { v.currentTime = 0; this.filmPaused = false; v.play().catch(() => {}); }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.zone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      this.film();
      this.route();
      this.stops();
    });
  }

  /** The launch film: plays while it's on screen; grows and straightens as it arrives. */
  private film(): void {
    const section = this.filmRef?.nativeElement;
    const video = this.filmVideo?.nativeElement;
    if (!section || !video) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { video.preload = 'auto'; if (!this.filmPaused) video.play().catch(() => {}); } else video.pause();
    }, { threshold: 0.35 });
    io.observe(video);
    this.cleanups.push(() => io.disconnect());
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.triggers.push(ScrollTrigger.create({
      trigger: section, start: 'top bottom', end: 'center center', scrub: 0.8,
      animation: gsap.timeline({ defaults: { ease: 'none' } })
        .fromTo(section.querySelector('.film-card'), { scale: 0.72, rotation: -7, y: 80 }, { scale: 1, rotation: 0, y: 0 }, 0)
        .fromTo(section.querySelector('.film-copy.left'), { x: -80, opacity: 0 }, { x: 0, opacity: 1 }, 0.3)
        .fromTo(section.querySelector('.film-copy.right'), { x: 80, opacity: 0 }, { x: 0, opacity: 1 }, 0.3),
    }));
  }

  /**
   * Each stop, scrubbed with the scroll: the phone rises and turns into place,
   * the mock-up slides in from the outside, and the labels drift in (and keep
   * drifting as the stop moves on up the screen).
   */
  private stops(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const journey = this.journeyRef?.nativeElement;
    journey?.querySelectorAll<HTMLElement>('.chapter').forEach(ch => {
      const dir = ch.classList.contains('flip') ? -1 : 1;   // which side the stage is on
      const stage = ch.querySelector<HTMLElement>('.ch-stage');
      if (!stage) return;
      const phone = stage.querySelector('.phone'), mock = stage.querySelector('.mock');
      const [c1, c2] = Array.from(stage.querySelectorAll('.float-chip'));
      // One timeline per stop (two would fight over the same properties and jump):
      // first the entrance, then a gentle drift as the stop moves on up the screen.
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      if (phone) tl.fromTo(phone, { y: 180, rotation: dir * 12, opacity: 0 }, { y: 0, rotation: dir * 3, opacity: 1, duration: 1 }, 0);
      if (mock) tl.fromTo(mock, { x: dir * 160, y: 60, rotation: dir * -4, opacity: 0 }, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 1 }, phone ? 0.25 : 0);
      if (c1) tl.fromTo(c1, { y: -90, x: dir * -40, opacity: 0, scale: 0.8 }, { y: 0, x: 0, opacity: 1, scale: 1, duration: 0.8 }, 0.45);
      if (c2) tl.fromTo(c2, { y: 110, x: dir * 50, opacity: 0, scale: 0.8 }, { y: 0, x: 0, opacity: 1, scale: 1, duration: 0.8 }, 0.55);
      const after = 1.35;   // the entrance is done; drift from where everything now sits
      if (phone) tl.to(phone, { y: -30, duration: 1.4, ease: 'none' }, after);
      if (c1) tl.to(c1, { y: -70, duration: 1.4, ease: 'none' }, after);
      if (c2) tl.to(c2, { y: -140, duration: 1.4, ease: 'none' }, after);
      this.triggers.push(ScrollTrigger.create({ trigger: ch, start: 'top 95%', end: 'bottom top', scrub: 0.7, animation: tl }));
    });
  }

  ngOnDestroy(): void {
    this.triggers.forEach(t => t.kill());
    this.cleanups.forEach(fn => fn());
  }

  /** The route line: built through the stops, drawn as you scroll. */
  private route(): void {
    const journey = this.journeyRef?.nativeElement;
    if (!journey) return;
    const svg = journey.querySelector<SVGSVGElement>('.route')!;
    const base = svg.querySelector<SVGPathElement>('.route-base')!;
    const live = svg.querySelector<SVGPathElement>('.route-live')!;
    const head = journey.querySelector<HTMLElement>('.route-head')!;
    const pins = Array.from(journey.querySelectorAll<HTMLElement>('[data-pin]'));
    const bridges = Array.from(journey.querySelectorAll<HTMLElement>('[data-bridge]'));
    const chapters = Array.from(journey.querySelectorAll<HTMLElement>('.chapter'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let total = 0;
    /** y down the path at each sample, to find how much to draw for a screen position. */
    let samples: { len: number; y: number }[] = [];
    let pinY: number[] = [];
    let bridgeY: number[] = [];
    const drawn = { len: 0 };

    // Build the path: from the top, through each stop, curving out to the side between them.
    const build = () => {
      const box = journey.getBoundingClientRect();
      const pts = pins.map(p => {
        const r = p.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      });
      if (!pts.length) return;
      const narrow = box.width < 760;
      const bend = narrow ? 0 : Math.min(330, box.width * 0.3);
      const start = { x: pts[0].x, y: 0 };
      const end = { x: pts[pts.length - 1].x, y: box.height };
      const all = [start, ...pts, end];
      let d = `M${start.x.toFixed(1)} ${start.y.toFixed(1)}`;
      const mids: { x: number; y: number }[] = [];
      for (let i = 1; i < all.length; i++) {
        const a = all[i - 1], b = all[i];
        const dy = b.y - a.y;
        // Between two stops the line swings out to one side, alternating; the ends run straight.
        const between = i > 1 && i < all.length - 1;
        const dir = (i % 2 === 0 ? 1 : -1) * (between ? 1 : 0);
        const c1 = { x: a.x + dir * bend, y: a.y + dy * 0.55 };
        const c2 = { x: b.x + dir * bend, y: b.y - dy * 0.55 };
        d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
        // The curve's midpoint, where that stretch's caption sits.
        mids.push({ x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x, y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y });
      }
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      base.setAttribute('d', d);
      live.setAttribute('d', d);
      total = live.getTotalLength();
      live.style.strokeDasharray = `${total}`;
      samples = [];
      for (let l = 0; l <= total; l += 8) samples.push({ len: l, y: live.getPointAtLength(l).y });
      pinY = pts.map(p => p.y);
      // Captions sit on the stretches between stops (mids[1] is stop 1 → stop 2). On phones a
      // chapter is tall (words, then mock-up), so the caption goes just above the next stop instead.
      bridgeY = bridges.map((el, i) => {
        const next = pts[i + 1];
        const m = narrow ? (next ? { x: next.x, y: next.y - 100 } : undefined) : mids[i + 1];
        if (!m) return Infinity;
        el.style.left = `${m.x}px`;
        el.style.top = `${m.y}px`;
        return m.y;
      });
      draw();
    };

    // Draw up to a length; light up the stops, captions and chapters the line has reached.
    const draw = () => {
      const len = Math.max(0, Math.min(total, drawn.len));
      live.style.strokeDashoffset = `${total - len}`;
      const p = total ? live.getPointAtLength(len) : { x: 0, y: 0 };
      head.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      head.style.opacity = len > 2 && len < total - 2 ? '1' : '0';
      pins.forEach((el, i) => el.classList.toggle('reached', p.y >= pinY[i] - 4));
      bridges.forEach((el, i) => el.classList.toggle('reached', p.y >= bridgeY[i] - 20));
      chapters.forEach((el, i) => { if (p.y >= pinY[i] - 260) el.classList.add('in'); });
    };

    /** How much path to draw so its head sits at this y. */
    const lenAtY = (y: number) => {
      let lo = 0, hi = samples.length - 1;
      if (!samples.length) return 0;
      if (y <= samples[0].y) return 0;
      if (y >= samples[hi].y) return total;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].y < y) lo = mid; else hi = mid; }
      const a = samples[lo], b = samples[hi];
      return a.len + ((y - a.y) / Math.max(1, b.y - a.y)) * (b.len - a.len);
    };

    build();
    if (reduce) {
      drawn.len = total;
      journey.classList.add('static');
      draw();
    } else {
      // The head follows a line 62% down the screen, eased a little.
      const follow = () => {
        const y = window.innerHeight * 0.62 - journey.getBoundingClientRect().top;
        gsap.to(drawn, { len: lenAtY(y), duration: 0.5, ease: 'power2.out', overwrite: true, onUpdate: draw });
      };
      this.triggers.push(ScrollTrigger.create({ trigger: journey, start: 'top bottom', end: 'bottom top', onUpdate: follow, onRefresh: follow }));
      follow();
    }

    // Rebuild when the layout changes (fonts, images, resizing).
    const ro = new ResizeObserver(() => { build(); ScrollTrigger.refresh(); });
    ro.observe(journey);
    this.cleanups.push(() => ro.disconnect());
  }
}
