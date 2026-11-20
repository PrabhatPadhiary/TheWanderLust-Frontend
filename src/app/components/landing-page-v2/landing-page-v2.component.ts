import { Component, ElementRef, OnInit, AfterViewInit, OnDestroy, ViewChild, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate, inView, stagger } from 'motion';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { JournalService, JournalFeedItem } from '../../services/journal.service';
import { Subject } from 'rxjs';
import { tripMapStory, TRIP_STOPS } from './trip-map';
import { planTogetherStory, CREW } from './plan-together';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

declare var google: any;

/** Community stories: the one that leads the collage, and any left out of it. */
const LEAD_STORY = '29242fa1-9f03-4a53-87a8-adebf6ca50a4';   // Sun, Sand, and Squad Goals (Goa)
const HIDDEN_STORIES = ['e709adcf-7570-4196-9328-39931e4c065f']; // Official Trip to Mysore

@Component({
  selector: 'app-landing-page-v2',
  templateUrl: './landing-page-v2.component.html',
  styleUrls: ['./landing-page-v2.component.scss'],
  standalone: false
})
/**
 * Landing page: an editorial hero (a cream panel on warm sand with the
 * headline, the search and a tilted Santorini photo), then a "step into the
 * photo" as it straightens and fills the screen, into the next section; a
 * destination slider; the trip on a map (trip-map.ts); planning together on a
 * live board (plan-together.ts); a collage slider of real community stories;
 * what you can do; and a call to plan on the web or get the app.
 *
 * "Reduce motion" starts opened, with no scroll effects. All animation runs
 * outside Angular's zone.
 */
export class LandingPageV2Component implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('hero') heroRef!: ElementRef<HTMLElement>;
  @ViewChild('heroCopy') heroCopy!: ElementRef<HTMLElement>;
  @ViewChild('story') storyRef!: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('together') togetherRef!: ElementRef<HTMLElement>;
  /** The collage is only in the page once stories arrive; its scroll is set up when it appears. */
  @ViewChild('collage') set collageView(ref: ElementRef<HTMLElement> | undefined) {
    this.collageEl = ref?.nativeElement;
    if (this.collageEl && this.animating) setTimeout(() => this.zone.runOutsideAngular(() => this.collageStory()));
  }
  private collageEl?: HTMLElement;
  @ViewChild('tripMap') tripMapRef!: ElementRef<HTMLElement>;

  /** The trip on the map. */
  readonly tripStops = TRIP_STOPS;

  /** The friends on the shared trip board. */
  readonly crew = CREW;

  readonly year = new Date().getFullYear();
  /** The page under the navbar is light, so it uses dark text. */
  navOnLight = false;
  /** The hero's search is out of view: the navbar shows its own (wide screens). */
  showNavSearch = false;
  /** …and on narrow screens a floating one, unless the closing section's search is on screen. */
  showFloatSearch = false;
  /** The hero: its headline and line of text. */
  readonly intro = {
    src: 'assets/images/hero/santorini.jpg',
    srcSmall: 'assets/images/hero/santorini-sm.jpg',
    title: 'The world,',
    em: 'planned beautifully', // shown with a full stop
    sub: 'Find places, plan trips with friends and keep every day of the journey in one place, right in your browser.',
  };
  /** The destination being shown in the slider, and the one before (it stays under the next as that grows in). */
  activeStep = 0;
  prevStep = -1;
  /** "Choose your next destination": the slider's places (Explore opens each one's page). */
  readonly dests = [
    { name: 'Santorini', country: 'Greece', placeId: 'ChIJ6bzjBc7NmRQR26Hvu5LB9Ak',
      src: 'assets/images/hero/santorini.jpg', srcSmall: 'assets/images/hero/santorini-sm.jpg',
      text: 'Whitewashed villages on volcanic cliffs above the Aegean, and sunsets over the caldera.' },
    { name: 'Kyoto', country: 'Japan', placeId: 'ChIJ8cM8zdaoAWARPR27azYdlsA',
      src: 'assets/images/hero/kyoto.jpg', srcSmall: 'assets/images/hero/kyoto-sm.jpg',
      text: 'Temples, tea houses and lantern-lit lanes, with cherry blossom in spring.' },
    { name: 'Machu Picchu', country: 'Peru', placeId: 'ChIJVVVViV-abZERJxqgpA43EDo',
      src: 'assets/images/hero/machu-picchu.jpg', srcSmall: 'assets/images/hero/machu-picchu-sm.jpg',
      text: 'The Inca citadel high in the Andes, above a valley of cloud forest.' },
    { name: 'Bali', country: 'Indonesia', placeId: 'ChIJoQ8Q6NNB0S0RkOYkS7EPkSQ',
      src: 'assets/images/hero/bali.jpg', srcSmall: 'assets/images/hero/bali-sm.jpg',
      text: 'Rice terraces, temples by the sea and long beach days, all on one island.' },
    { name: 'Cape Town', country: 'South Africa', placeId: 'ChIJ1-4miA9QzB0Rh6ooKPzhf2g',
      src: 'assets/images/hero/cape-town.jpg', srcSmall: 'assets/images/hero/cape-town-sm.jpg',
      text: 'Table Mountain over the harbour, with beaches and vineyards close by.' },
  ];
  readonly features = [
    { icon: 'search', title: 'Smart discovery', text: 'Stays, food and things to do for any destination, with ratings and photos from Google.' },
    { icon: 'calendar', title: 'Day-by-day planner', text: 'Drag places into days, set times and see your whole trip at a glance.' },
    { icon: 'users', title: 'Plan together', text: 'Invite friends with a link, plan in real time and keep everyone on the same page.' },
    { icon: 'heart', title: 'Favourites', text: 'Your wishlist of places, saved from anywhere and sorted by city.' },
    { icon: 'map', title: 'Maps', text: 'Every stop on a map, so you can see your route and what is close by.' },
    { icon: 'check', title: 'Budget and checklists', text: 'Split costs, track spending and tick off packing lists together.' },
  ];

  private heroTrigger: ScrollTrigger | null = null;
  private storyTrigger: ScrollTrigger | null = null;
  private triggers: ScrollTrigger[] = [];
  private stopReveals: (() => void)[] = [];
  private reduceMotion = false;
  /** Scroll effects are on (not reduced motion). */
  private animating = false;
  private collageReady = false;
  private small = false;

  // Hero search
  predictions: any[] = [];
  showDropdown = false;
  selectedPlace: any = null;
  private searchSubject = new Subject<string>();
  private autocompleteService: any;
  private blurTimeout: any;

  /** The latest real stories from the community, for the landing section. */
  stories: JournalFeedItem[] = [];

  /** False while pages are pre-rendered at build time (no window, animations or observers then). */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(
    public authService: AuthService,
    private router: Router,
    private journalService: JournalService,
    private zone: NgZone,
  ) {}

  ngOnInit(): void {
    // The page starts light (the frost opening); with reduced motion it starts on the photo.
    this.navOnLight = typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.isBrowser) return;   // places search and stories load in the browser
    this.initPlacesAutocomplete();
    // Real stories only: the newest six with a photo (the section hides if none load).
    this.journalService.getFeed().subscribe({
      next: (items) => {
        // Curated: the Mysore story is left out and a Goa story leads.
        const withPhotos = (items || []).filter(j => j.photos?.length && !HIDDEN_STORIES.includes(j.id));
        const lead = withPhotos.filter(j => j.id === LEAD_STORY);
        this.stories = [...lead, ...withPhotos.filter(j => j.id !== LEAD_STORY)].slice(0, 6);
      },
      error: () => { this.stories = []; },
    });
  }

  storyExcerpt(body: string): string {
    const text = (body || '').trim();
    return text.length > 140 ? text.slice(0, 140).trimEnd() + '…' : text;
  }

  storyDate(j: JournalFeedItem): string {
    return new Date(j.publishedAt || j.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }

  storyColor(name: string): string {
    const colors = ['#2B3F51', '#3F5A73', '#A53412', '#4F6070', '#D9481C'];
    return colors[(name || 'T').charCodeAt(0) % colors.length];
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.small = window.matchMedia('(max-width: 720px)').matches;

    this.zone.runOutsideAngular(() => {
      this.watchSearches();
      if (!this.reduceMotion) {
        gsap.registerPlugin(ScrollTrigger);
        this.animating = true;
        this.scrollEffects();
        this.stepIntoPhoto();   // after the destinations' own triggers, so it reads the card where it ends up
        this.reveals();
        if (this.collageEl) this.zone.runOutsideAngular(() => this.collageStory());
      } else {
        this.runTripMap(false);
        if (this.togetherRef) planTogetherStory(this.togetherRef.nativeElement, () => {}, false);
      }
    });
  }

  /** "Your trip, mapped" (see trip-map.ts); still, when motion is reduced. */
  private runTripMap(animated: boolean): void {
    const section = this.tripMapRef?.nativeElement;
    if (section) tripMapStory(section, t => this.triggers.push(t), fn => this.stopReveals.push(fn), animated);
  }

  /**
   * Step into the photo: as the destinations section scrolls up, a copy of the
   * hero's tilted Santorini flies from the tilted one into the destinations
   * card (straightening, growing, matching its corners), following both live
   * as they move, then fades into the card's own Santorini.
   */
  private stepIntoPhoto(): void {
    const hero = this.heroRef.nativeElement;
    const story = this.storyRef?.nativeElement;
    const panel = story?.querySelector<HTMLElement>('.dest-panel');
    const tilt = hero.querySelector<HTMLElement>('.hero-tilt');
    const photo = document.querySelector<HTMLElement>('.step-photo');
    if (!story || !panel || !photo) return;
    const TILT_DEG = -7, FROM_RADIUS = 22, TO_RADIUS = 32;

    /** The tilted photo's unrotated box (centre and size), or on phones (where it's hidden) a card low in the middle. */
    const fromBox = () => {
      if (tilt && tilt.offsetWidth) {
        const r = tilt.getBoundingClientRect();
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: tilt.offsetWidth, h: tilt.offsetHeight };
      }
      const w = window.innerWidth * 0.7;
      return { cx: window.innerWidth / 2, cy: window.innerHeight * 0.78, w, h: w * 0.75 };
    };

    const morph = (p: number) => {
      if (p <= 0 || p >= 1) {
        photo.style.visibility = 'hidden';
        if (tilt) tilt.style.visibility = p >= 1 ? 'hidden' : '';
        return;
      }
      const a = fromBox();
      const t = panel.getBoundingClientRect();
      const e = p * p * (3 - 2 * p);   // ease in and out
      const w = a.w + (t.width - a.w) * e;
      const h = a.h + (t.height - a.h) * e;
      const cx = a.cx + (t.left + t.width / 2 - a.cx) * e;
      const cy = a.cy + (t.top + t.height / 2 - a.cy) * e;
      photo.style.visibility = 'visible';
      photo.style.width = `${w.toFixed(1)}px`;
      photo.style.height = `${h.toFixed(1)}px`;
      photo.style.left = `${(cx - w / 2).toFixed(1)}px`;
      photo.style.top = `${(cy - h / 2).toFixed(1)}px`;
      photo.style.borderRadius = `${(FROM_RADIUS + (TO_RADIUS - FROM_RADIUS) * e).toFixed(1)}px`;
      photo.style.transform = `rotate(${(TILT_DEG * (1 - e)).toFixed(2)}deg)`;
      // The last stretch: fade into the card (the same photo is under it).
      photo.style.opacity = String(p < 0.88 ? 1 : Math.max(0, 1 - (p - 0.88) / 0.12));
      if (tilt) tilt.style.visibility = 'hidden';
    };

    this.triggers.push(ScrollTrigger.create({
      trigger: story,
      start: 'top bottom',
      end: 'top top',
      onUpdate: st => morph(st.progress),
      onLeave: () => morph(1),
      onLeaveBack: () => morph(0),
    }));
  }

  ngOnDestroy(): void {
    this.triggers.forEach(t => t.kill());
    this.stopReveals.forEach(fn => fn());
  }

  /**
   * Is the hero's search on screen (and not faded by the step into the photo)? If not, the
   * navbar shows a search (wide screens) or a floating one does (narrow), so
   * there's always a search in reach. The floating one steps aside while the
   * closing section's own search is on screen.
   */
  private watchSearches(): void {
    const hero = this.heroRef.nativeElement.querySelector<HTMLElement>('.hero-search');
    const closing = document.querySelector<HTMLElement>('.cta-search');
    const onScreen = (el: HTMLElement | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };
    let queued = false;
    const check = () => {
      queued = false;
      const heroShown = !!hero && onScreen(hero) && parseFloat(getComputedStyle(hero).opacity || '1') > 0.3;
      const nav = !heroShown;
      const float = !heroShown && !onScreen(closing);
      if (nav !== this.showNavSearch || float !== this.showFloatSearch) {
        this.zone.run(() => { this.showNavSearch = nav; this.showFloatSearch = float; });
      }
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    this.stopReveals.push(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    });
    check();
  }

  // ===== Scroll (GSAP) =====

  private scrollEffects(): void {
    const hero = this.heroRef.nativeElement;

    // Hero, pinned for a moment: it opens on the panel, holds, then its words
    // fade (the tilted photo stays). Then, as the destinations section scrolls
    // up, the photo flies into its card (stepIntoPhoto).
    const HOLD = 0.35;
    const FADE = 0.5;
    const total = HOLD + FADE;
    const scrollCue = hero.querySelector<HTMLElement>('.scroll-cue');
    const content = this.heroCopy.nativeElement;
    const search = hero.querySelector<HTMLElement>('.hero-search')!;
    const copy = Array.from(content.querySelectorAll<HTMLElement>('.hero-panel-bg, .panel-head, .hero-title, .hero-sub, .hero-facts'));

    this.heroTrigger = ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: () => '+=' + window.innerHeight * total,
      pin: true,
      anticipatePin: 1,
      scrub: 1,
      onUpdate: (st) => {
        const all = st.progress * total;
        const fade = 1 - Math.min(1, Math.max(0, (all - HOLD) / FADE));
        gsap.set(copy, { opacity: fade, y: -40 * (1 - fade) });
        search.style.opacity = String(fade);
        content.style.pointerEvents = fade > 0.5 ? '' : 'none';
        if (scrollCue) scrollCue.style.opacity = String(fade);
        // The hero is light throughout: dark navbar text.
        if (!this.navOnLight) this.zone.run(() => { this.navOnLight = true; });
      },
    });
    this.triggers.push(this.heroTrigger);

    // How it works: pinned on large screens, the steps change as you scroll.
    const story = this.storyRef?.nativeElement;
    if (story) {
      // The section is tall and its content sticks to the top with CSS
      // (native, so it never jumps); this only reads how far through it you are.
      // As it arrives, the panel drifts a touch against the scroll
      // so they ease to a stop where it sticks, rather than halting suddenly.
      const stage = story.querySelector<HTMLElement>('.dest-panel');
      if (stage) {
        this.triggers.push(ScrollTrigger.create({
          trigger: story,
          start: 'top 45%',
          end: 'top top',
          scrub: true,
          animation: gsap.fromTo(stage, { y: () => -window.innerHeight * 0.18 }, { y: 0, ease: 'power1.in' }),
        }));
      }
      this.triggers.push(this.storyTrigger = ScrollTrigger.create({
        trigger: story,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (st) => {
          const step = Math.min(this.dests.length - 1, Math.floor(st.progress * this.dests.length));
          if (step !== this.activeStep) this.zone.run(() => { this.prevStep = this.activeStep; this.activeStep = step; });
        },
      }));
    }

    this.runTripMap(true);

    const together = this.togetherRef?.nativeElement;
    if (together) planTogetherStory(together, t => this.triggers.push(t), true);
  }

  // ===== From the community: the collage slider =====

  /**
   * The stories' collage slides sideways as you scroll down (the section is
   * as tall as the track is wide). Each story builds itself as it slides in,
   * and the small photos drift at their own pace, for depth.
   */
  private collageStory(): void {
    const section = this.collageEl;
    const track = section?.querySelector<HTMLElement>('.collage-track');
    if (!section || !track || this.collageReady) return;
    this.collageReady = true;
    section.classList.add('live');

    let dist = 0;
    const size = () => {
      dist = Math.max(0, track.scrollWidth - track.clientWidth);
      section.style.height = `${window.innerHeight + dist}px`;
    };
    size();
    ScrollTrigger.addEventListener('refreshInit', size);
    this.stopReveals.push(() => ScrollTrigger.removeEventListener('refreshInit', size));

    const clusters = Array.from(section.querySelectorAll<HTMLElement>('.cluster'));

    // The photos slide in sideways, which lazy loading doesn't notice: load them all as the section nears.
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      section.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
    }, { rootMargin: '150% 0px' });
    io.observe(section);
    this.stopReveals.push(() => io.disconnect());

    // The slide: a straight (linear) tween, so each story can time its own entrance against it.
    const slide = gsap.to(track, { x: () => -dist, ease: 'none' });
    this.triggers.push(ScrollTrigger.create({
      trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.8, invalidateOnRefresh: true, animation: slide,
    }));

    // Depth: the small photos and captions drift at their own pace as it slides.
    this.triggers.push(ScrollTrigger.create({
      trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.8,
      animation: gsap.timeline({ defaults: { ease: 'none' } })
        .fromTo(section.querySelectorAll('.ph.second'), { x: 60 }, { x: -60 }, 0)
        .fromTo(section.querySelectorAll('.ph.third'), { x: 120 }, { x: -90 }, 0)
        .fromTo(section.querySelectorAll('.cluster-card'), { x: 30 }, { x: -30 }, 0),
    }));

    // Each story builds itself as it slides in from the right: the main photo
    // opens up, the second drops in and tilts, the third spins up from below,
    // and the caption rises.
    clusters.forEach(c => {
      const alt = c.classList.contains('alt');
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      const main = c.querySelector('.main'), second = c.querySelector('.second'), third = c.querySelector('.third'), card = c.querySelector('.cluster-card');
      if (main) tl.fromTo(main, { clipPath: 'inset(14% 18% 14% 18% round 30px)', opacity: 0.4 }, { clipPath: 'inset(0% 0% 0% 0% round 30px)', opacity: 1, duration: 1 }, 0);
      if (second) tl.fromTo(second, { y: -110, rotation: alt ? -16 : 16, opacity: 0 }, { y: 0, rotation: alt ? -3 : 3, opacity: 1, duration: 0.8 }, 0.2);
      if (third) tl.fromTo(third, { y: 140, rotation: alt ? 22 : -22, opacity: 0 }, { y: 0, rotation: alt ? 4 : -4, opacity: 1, duration: 0.8 }, 0.35);
      if (card) tl.fromTo(card, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0.5);
      this.triggers.push(ScrollTrigger.create({
        trigger: c, containerAnimation: slide, start: 'left 100%', end: 'left 50%', scrub: 0.6, animation: tl,
      }));
    });

    // As the section arrives, the first stories rise into place and the heading's words lift in.
    this.triggers.push(ScrollTrigger.create({
      trigger: section, start: 'top 90%', end: 'top top', scrub: 0.8,
      animation: gsap.fromTo(clusters.slice(0, 3), { y: 160, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.15, ease: 'power2.out' }),
    }));
    const h = section.querySelector<HTMLElement>('h2');
    if (h) {
      const words = this.splitWords(h);
      words.forEach(w => { w.style.transform = 'translateY(110%)'; });
      this.stopReveals.push(inView(h, () => {
        animate(words, { transform: ['translateY(110%)', 'translateY(0%)'] }, { duration: 0.9, delay: stagger(0.06), ease: [0.22, 1, 0.36, 1] });
      }, { amount: 0.5 }));
    }
    ScrollTrigger.refresh();
  }

  // ===== Reveals (Motion) =====

  /** Fade and rise sections, split headings into rising words, stagger cards, and add parallax and tilt. */
  private reveals(): void {
    // The page's <main> (not the hero's parent: GSAP wraps the pinned hero in a spacer).
    const root = (this.heroRef.nativeElement.closest('main') ?? document.body) as HTMLElement;
    const ease = [0.22, 1, 0.36, 1] as const;

    // Headings: each word rises out of its own line.
    root.querySelectorAll<HTMLElement>('[data-split]').forEach(h => {
      const words = this.splitWords(h);
      words.forEach(w => { w.style.transform = 'translateY(110%)'; });
      this.stopReveals.push(inView(h, () => {
        animate(words, { transform: ['translateY(110%)', 'translateY(0%)'] }, { duration: 0.9, delay: stagger(0.06), ease });
      }, { amount: 0.5 }));
    });

    root.querySelectorAll<HTMLElement>('[data-reveal]').forEach(el => {
      el.style.opacity = '0';
      this.stopReveals.push(inView(el, () => {
        animate(el, { opacity: [0, 1], transform: ['translateY(40px)', 'translateY(0px)'] }, { duration: 0.9, ease });
        const kids = el.querySelectorAll<HTMLElement>('[data-reveal-item]');
        if (kids.length) {
          animate(kids, { opacity: [0, 1], transform: ['translateY(36px) scale(0.97)', 'translateY(0px) scale(1)'] },
            { duration: 0.8, delay: stagger(0.09, { startDelay: 0.15 }), ease });
        }
      }, { amount: 0.15 }));
    });

    // Parallax: photos move a little slower than the page.
    root.querySelectorAll<HTMLElement>('[data-parallax]').forEach(img => {
      this.triggers.push(ScrollTrigger.create({
        trigger: img.parentElement || img, start: 'top bottom', end: 'bottom top', scrub: true,
        animation: gsap.fromTo(img, { yPercent: -8, scale: 1.12 }, { yPercent: 8, scale: 1.12, ease: 'none' }),
      }));
    });

    // Feature cards: fade in one after another; each icon pops in and draws its lines, then the words follow.
    const grid = root.querySelector<HTMLElement>('.feature-grid');
    if (grid) {
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.feature'));
      cards.forEach(card => {
        card.style.opacity = '0';
        card.querySelectorAll('.feature-icon svg > *').forEach(el => el.setAttribute('pathLength', '1'));
        card.querySelectorAll<HTMLElement>('.feature-icon, h3, p').forEach(el => (el.style.opacity = '0'));
      });
      grid.classList.add('armed');   // icon lines start undrawn (see .feature-grid.armed in the styles)
      this.stopReveals.push(inView(grid, () => {
        cards.forEach((card, i) => {
          const d = i * 0.1;
          animate(card, { opacity: [0, 1] }, { duration: 1.1, delay: d, ease: 'easeOut' });
          const icon = card.querySelector<HTMLElement>('.feature-icon')!;
          animate(icon, { opacity: [0, 1], transform: ['scale(0.3) rotate(-25deg)', 'scale(1) rotate(0deg)'] },
            { type: 'spring', stiffness: 320, damping: 14, delay: d + 0.25 });
          setTimeout(() => card.classList.add('drawn'), (d + 0.4) * 1000);              // the lines draw (CSS)
          setTimeout(() => { icon.style.transform = ''; }, (d + 1.6) * 1000);            // hand the transform back to the CSS hover
          animate(Array.from(card.querySelectorAll('h3, p')), { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'] },
            { duration: 0.6, delay: stagger(0.08, { startDelay: d + 0.35 }), ease });
        });
      }, { amount: 0.2 }));
    }

    // Feature cards lean towards the mouse.
    if (!this.small) {
      root.querySelectorAll<HTMLElement>('.feature').forEach(card => {
        const move = (e: PointerEvent) => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          animate(card, { transform: `perspective(800px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-4px)` },
            { type: 'spring', stiffness: 260, damping: 22 });
        };
        const leave = () => animate(card, { transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)' },
          { type: 'spring', stiffness: 200, damping: 20 });
        card.addEventListener('pointermove', move);
        card.addEventListener('pointerleave', leave);
        this.stopReveals.push(() => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', leave); });
      });
    }
  }

  /** Wrap each word of a heading in a clipping line, for the rising-words reveal (keeps <em>). */
  private splitWords(el: HTMLElement): HTMLElement[] {
    const words: HTMLElement[] = [];
    const walk = (node: Node) => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = (child.textContent || '').split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const outer = document.createElement('span');
            outer.className = 'w';
            const inner = document.createElement('span');
            inner.className = 'wi';
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
            words.push(inner);
          });
          child.parentNode!.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    return words;
  }

  /** The slider: a card, dot or arrow scrolls to that place (or just shows it, without scroll effects). */
  showStep(i: number): void {
    i = Math.max(0, Math.min(this.dests.length - 1, i));
    const st = this.storyTrigger;
    if (!st) { this.prevStep = this.activeStep; this.activeStep = i; return; }
    const y = st.start + (st.end - st.start) * ((i + 0.5) / this.dests.length);
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  /** "Start planning": back to the search, ready to type. */
  // ===== Hero Search =====
  private initPlacesAutocomplete(): void {
    if (typeof google !== 'undefined' && google.maps?.places) {
      this.autocompleteService = new google.maps.places.AutocompleteService();

      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(value => value.length >= 2)
      ).subscribe(value => {
        this.autocompleteService.getPlacePredictions(
          { input: value },
          (predictions: any[], status: string) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              const allowedTypes = ['locality', 'administrative_area_level_1', 'country'];
              this.predictions = predictions
                .filter(pred => pred.types?.some((type: string) => allowedTypes.includes(type)))
                .sort((a, b) => {
                  const priority = (types: string[]) => {
                    if (types.includes('locality')) return 1;
                    if (types.includes('administrative_area_level_1')) return 2;
                    if (types.includes('country')) return 3;
                    return 4;
                  };
                  return priority(a.types) - priority(b.types);
                });
              this.showDropdown = this.predictions.length > 0;
            } else {
              this.predictions = [];
              this.showDropdown = false;
            }
          }
        );
      });
    }
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value.length < 2) {
      this.predictions = [];
      this.showDropdown = false;
      return;
    }
    this.searchSubject.next(value);
  }

  selectPlace(prediction: any): void {
    this.selectedPlace = prediction;
    this.predictions = [];
    this.showDropdown = false;
    this.router.navigate(['/destination', prediction.place_id], {
      state: { destinationName: prediction.structured_formatting?.main_text || prediction.description }
    });
  }

  onExplore(): void {
    if (this.selectedPlace) {
      this.router.navigate(['/destination', this.selectedPlace.place_id]);
    }
  }

  onBlur(): void {
    this.blurTimeout = setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  getPlaceLabel(prediction: any): string {
    if (prediction.types?.includes('locality')) return 'City';
    if (prediction.types?.includes('administrative_area_level_1')) return 'State';
    if (prediction.types?.includes('country')) return 'Country';
    return '';
  }
}
