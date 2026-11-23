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
import { suggestionKeys } from '../../utils/suggestion-keys';

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
 * Landing page: an Apple-style opening (the photo grows from a rounded card,
 * between the big WAY / RAA, to the full screen), the headline and search over
 * it, then a dive into the "o" of WORLD that lands in the next section; a
 * destination slider; the trip on a map (trip-map.ts); planning together on a
 * live board (plan-together.ts); a collage slider of real community stories;
 * what you can do; and a call to plan on the web or get the app.
 *
 * "Reduce motion" starts opened, with no scroll effects. All animation runs
 * outside Angular's zone.
 */
export class LandingPageV2Component implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('hero') heroRef!: ElementRef<HTMLElement>;
  @ViewChild('heroMedia') heroMedia!: ElementRef<HTMLElement>;
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
  /** The page under the navbar is light, so it uses dark text (off over the dark closing panel). */
  navOnLight = false;
  /** The hero's search isn't showing: the navbar shows its own (wide screens). */
  showNavSearch = false;
  /** …and on narrow screens a floating one, unless the closing section's search is on screen. */
  showFloatSearch = false;
  /** The headline's last word, in turn (the first is what screen readers and search engines read). */
  readonly heroWords = ['beautifully.', 'together.', 'day by day.'];
  /** The hero: one photo and its headline. */
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
  activeIndex = -1;
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
   * Is the hero's search showing (on screen, and not faded by the opening or
   * the dive)? If not, the navbar shows a search (wide screens) or a floating
   * one does (narrow), so there's always one in reach. The floating one steps
   * aside while the closing section's own search is on screen.
   */
  private watchSearches(): void {
    const hero = this.heroRef.nativeElement;
    const heroSearch = hero.querySelector<HTMLElement>('.hero-search');
    const closing = document.querySelector<HTMLElement>('.cta-search');
    const onScreen = (el: HTMLElement | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };
    // Its own opacity times its parents' (the hero fades the copy as a whole).
    const shownOpacity = (el: HTMLElement) => {
      let o = 1;
      for (let n: HTMLElement | null = el; n && n !== hero.parentElement; n = n.parentElement) {
        o *= parseFloat(getComputedStyle(n).opacity || '1');
      }
      return o;
    };
    // Sections whose content sticks to the screen while you scroll through
    // them: the floating search would sit on their controls, so it steps aside.
    const sticky = Array.from(document.querySelectorAll<HTMLElement>('.landing .story, .landing .tripmap, .landing .together'));
    const covering = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.25 && r.bottom > window.innerHeight * 0.75;
    };
    // Dark panels (the closing section and the footer): light navbar text over them.
    const dark = Array.from(document.querySelectorAll<HTMLElement>('.landing .cta-panel, app-site-footer'));
    const lightDefault = this.navOnLight;
    let queued = false;
    const check = () => {
      queued = false;
      const heroShown = !!heroSearch && onScreen(heroSearch) && shownOpacity(heroSearch) > 0.3;
      const nav = !heroShown;
      const float = !heroShown && !onScreen(closing) && !sticky.some(covering);
      // The bar sits about 24-104px from the top.
      const overDark = dark.some(el => { const r = el.getBoundingClientRect(); return r.top < 70 && r.bottom > 50; });
      const onLight = overDark ? false : lightDefault;
      if (nav !== this.showNavSearch || float !== this.showFloatSearch || onLight !== this.navOnLight) {
        this.zone.run(() => { this.showNavSearch = nav; this.showFloatSearch = float; this.navOnLight = onLight; });
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
    setTimeout(check, 300);   // once the opening has set its first frame
  }

  ngOnDestroy(): void {
    this.triggers.forEach(t => t.kill());
    this.stopReveals.forEach(fn => fn());
  }

  // ===== Scroll (GSAP) =====

  private scrollEffects(): void {
    const hero = this.heroRef.nativeElement;

    // Hero: the opening plays by itself, once, as the page loads (not tied to
    // scroll): WAY / RAA around the photo card, the card grows to the full
    // screen, then the headline and search rise in. Nothing is pinned, so the
    // page scrolls normally from the first moment.
    const HOLD = 0.35;      // seconds on WAY / RAA before the card opens
    const OPEN = 1.25;      // seconds for the card to open and the copy to arrive
    const media = this.heroMedia.nativeElement;
    const shade = hero.querySelector<HTMLElement>('.hero-shade');
    const content = this.heroCopy.nativeElement;
    const wordTop = hero.querySelector<HTMLElement>('.bw-top');
    const wordBottom = hero.querySelector<HTMLElement>('.bw-bottom');

    /**
     * The card at the start: centred in the space below the navbar, with the
     * WAY / RAA letters sized to fit above and below it (they slightly tuck
     * behind the card's top and bottom edges).
     */
    const layoutCard = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const areaTop = this.small ? 88 : 120;   // clear of the navbar
      const areaBottom = h - (this.small ? 20 : 28);
      const fs = Math.min(w * (this.small ? 0.2 : 0.17), h * 0.17, 272);
      const cw = this.small ? w * 0.82 : Math.min(w * 0.44, 720);
      const room = areaBottom - areaTop - fs * 1.3;  // what's left between the words
      const ch = Math.max(140, Math.min(room, cw * (this.small ? 1.1 : 0.62)));
      const centre = (areaTop + areaBottom) / 2;
      const top = centre - ch / 2;
      const bottom = centre + ch / 2;
      hero.style.setProperty('--bw-size', `${fs.toFixed(1)}px`);
      hero.style.setProperty('--card-top', `${top.toFixed(1)}px`);
      hero.style.setProperty('--card-bottom', `${bottom.toFixed(1)}px`);
      return { x: (w - cw) / 2, top, bottom: h - bottom };
    };
    let card = layoutCard();

    const applyOpening = (o: number) => {
      const e = o * o * (3 - 2 * o);
      const ix = card.x * (1 - e), it = card.top * (1 - e), ib = card.bottom * (1 - e);
      const radius = 32 * (1 - e);
      media.style.clipPath = o >= 1 ? '' : `inset(${it.toFixed(1)}px ${ix.toFixed(1)}px ${ib.toFixed(1)}px ${ix.toFixed(1)}px round ${radius.toFixed(1)}px)`;
      (media.style as any).webkitClipPath = media.style.clipPath;
      // The photo eases from a slight zoom to rest as the card opens.
      gsap.set(media.querySelector('img'), { scale: 1.12 - e * 0.12 });
      // WAY / RAA slide apart behind the growing card.
      if (wordTop) gsap.set(wordTop, { yPercent: -e * 140, opacity: 1 - e });
      if (wordBottom) gsap.set(wordBottom, { yPercent: e * 140, opacity: 1 - e });
      if (shade) gsap.set(shade, { opacity: e });
      // Then the headline and search rise in, centred.
      const t = Math.min(1, Math.max(0, (o - 0.6) / 0.4));
      gsap.set(content, { opacity: t, y: (1 - t) * 24 });
      content.style.pointerEvents = t > 0.5 ? '' : 'none';
    };

    // Scrolled down already (a reload part-way down the page): no opening.
    if (window.scrollY > window.innerHeight * 0.5) {
      applyOpening(1);
    } else {
      applyOpening(0);
      const state = { o: 0 };
      const tween = gsap.to(state, {
        o: 1, duration: OPEN, delay: HOLD, ease: 'power2.inOut',
        onUpdate: () => applyOpening(state.o),
      });
      // Anyone who starts scrolling or typing straight away skips to the end.
      const skip = () => { if (tween.isActive() || tween.progress() < 1) tween.progress(1); };
      window.addEventListener('wheel', skip, { once: true, passive: true });
      window.addEventListener('touchmove', skip, { once: true, passive: true });
      window.addEventListener('keydown', skip, { once: true });
      this.stopReveals.push(() => {
        tween.kill();
        window.removeEventListener('wheel', skip);
        window.removeEventListener('touchmove', skip);
        window.removeEventListener('keydown', skip);
      });
    }
    const onResize = () => { card = layoutCard(); };
    window.addEventListener('resize', onResize);
    this.stopReveals.push(() => window.removeEventListener('resize', onResize));

    // As the hero scrolls away, the photo drifts a little slower than the page.
    this.triggers.push(ScrollTrigger.create({
      trigger: hero, start: 'top top', end: 'bottom top', scrub: true,
      animation: gsap.fromTo(media, { yPercent: 0 }, { yPercent: 18, ease: 'none' }),
    }));

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
        trigger: c, containerAnimation: slide, start: 'left 100%', end: 'left 50%', scrub: true, animation: tl,
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
    // The page's <main>.
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
              this.activeIndex = -1;
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
    this.activeIndex = -1;
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

  onSearchKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !this.predictions.length) { this.onExplore(); return; }
    this.activeIndex = suggestionKeys(e, this.activeIndex, this.predictions.length, {
      pick: i => this.selectPlace(this.predictions[i]),
      close: () => { this.showDropdown = false; },
      open: () => { this.showDropdown = true; },
      isOpen: this.showDropdown,
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
