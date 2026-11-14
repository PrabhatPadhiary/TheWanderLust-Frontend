import { Component, ElementRef, OnInit, AfterViewInit, OnDestroy, ViewChild, NgZone } from '@angular/core';
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

/** The dive's zoom target: the letter (in the SVG), a point deep inside it, and how far to zoom. */
interface DiveTarget { el: SVGTextElement; px: number; py: number; kMax: number; }

/** Community stories: the one that leads the collage, and any left out of it. */
const LEAD_STORY = '29242fa1-9f03-4a53-87a8-adebf6ca50a4';   // Sun, Sand, and Squad Goals (Goa)
const HIDDEN_STORIES = ['e709adcf-7570-4196-9328-39931e4c065f']; // Official Trip to Mysore

/** The letter of the headline's first line that the dive zooms into. */
const DIVE_LETTER = 'o';



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
  @ViewChild('dive') diveRef!: ElementRef<SVGSVGElement>;
  @ViewChild('tripMap') tripMapRef!: ElementRef<HTMLElement>;

  /** The trip on the map. */
  readonly tripStops = TRIP_STOPS;

  /** The friends on the shared trip board. */
  readonly crew = CREW;

  readonly year = new Date().getFullYear();
  /** The page under the navbar is light (after the dive), so it uses dark text. */
  navOnLight = false;
  /** The hero: one photo and its headline (the full stop is the dive's target). */
  readonly intro = {
    src: 'assets/images/hero/santorini.jpg',
    srcSmall: 'assets/images/hero/santorini-sm.jpg',
    title: 'The world,',
    em: 'planned beautifully', // shown with a full stop
    sub: 'Find places, plan trips with friends and keep every day of the journey in one place, right in your browser.',
  };
  /** The headline, letter by letter (spaces kept), and which letter the dive goes into. */
  readonly titleChars = this.intro.title.split('');
  readonly emChars = (this.intro.em + '.').split('');
  diveIndex = -1;

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

  constructor(
    public authService: AuthService,
    private router: Router,
    private journalService: JournalService,
    private zone: NgZone,
  ) {}

  ngOnInit(): void {
    // The page starts light (the frost opening); with reduced motion it starts on the photo.
    this.navOnLight = typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.small = window.matchMedia('(max-width: 720px)').matches;

    this.zone.runOutsideAngular(() => {
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

  ngOnDestroy(): void {
    this.triggers.forEach(t => t.kill());
    this.stopReveals.forEach(fn => fn());
  }

  // ===== Scroll (GSAP) =====

  private scrollEffects(): void {
    const hero = this.heroRef.nativeElement;

    // Hero, pinned: the opening (the card grows to the full screen), a short
    // hold to read the headline, then the dive into its full stop.
    // Scroll length of each part, in screen heights. The dive is long, so the
    // zoom into the letter feels slow and deliberate.
    const OPEN = 1.1;
    const HOLD = 0.6;
    const DIVE = 2.6;
    const total = OPEN + HOLD + DIVE;
    const fadeOut = Array.from(hero.querySelectorAll<HTMLElement>('.hero-search, .hero-facts, .hero-sub, .glass-pill, .scroll-cue'));
    const media = this.heroMedia.nativeElement;
    const shade = hero.querySelector<HTMLElement>('.hero-shade');
    const content = this.heroCopy.nativeElement;
    const wordTop = hero.querySelector<HTMLElement>('.bw-top');
    const wordBottom = hero.querySelector<HTMLElement>('.bw-bottom');
    let target: DiveTarget | null = null;

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
    // The dive goes into the "o" of "world": bold and upright (thick strokes),
    // near the middle. Falls back to the letter nearest the centre.
    const preferred = this.intro.title.indexOf(DIVE_LETTER);
    const pick = () => this.zone.run(() => { this.diveIndex = preferred >= 0 ? preferred : this.nearestLetter(hero); });
    (document as any).fonts?.ready?.then(pick) ?? pick();
    const onResize = () => { card = layoutCard(); pick(); };
    window.addEventListener('resize', onResize);
    this.stopReveals.push(() => window.removeEventListener('resize', onResize));

    const applyOpening = (o: number) => {
      const e = o * o * (3 - 2 * o);
      const ix = card.x * (1 - e), it = card.top * (1 - e), ib = card.bottom * (1 - e);
      const radius = 32 * (1 - e);
      media.style.clipPath = `inset(${it.toFixed(1)}px ${ix.toFixed(1)}px ${ib.toFixed(1)}px ${ix.toFixed(1)}px round ${radius.toFixed(1)}px)`;
      (media.style as any).webkitClipPath = media.style.clipPath;
      // The photo eases from a slight zoom to rest as the card opens.
      gsap.set(media.querySelector('img'), { scale: 1.12 - e * 0.12 });
      // WAY / RAA slide apart behind the growing card.
      if (wordTop) gsap.set(wordTop, { yPercent: -e * 140, opacity: 1 - e });
      if (wordBottom) gsap.set(wordBottom, { yPercent: e * 140, opacity: 1 - e });
      if (shade) gsap.set(shade, { opacity: e });
      // Then the headline and search rise in, centred.
      const t = Math.min(1, Math.max(0, (o - 0.7) / 0.3));
      gsap.set(content, { opacity: t, y: (1 - t) * 30 });
      content.style.pointerEvents = t > 0.5 ? '' : 'none';
      return t;
    };
    applyOpening(0);

    this.heroTrigger = ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: () => '+=' + window.innerHeight * total,
      pin: true,
      anticipatePin: 1,
      scrub: 1.2,
      onUpdate: (st) => {
        const all = st.progress * total;
        const o = Math.min(1, all / OPEN);
        const t = applyOpening(o);
        const zp = Math.min(1, Math.max(0, (all - OPEN - HOLD) / DIVE));

        // The dive: a camera zoom into the highlighted letter. The headline is
        // swapped for an exact vector copy (SVG) that's zoomed by its viewBox,
        // so everything stays sharp; the other letters fly past the edges and
        // the frost letter fills the screen.
        const svg = this.diveRef?.nativeElement;
        const title = hero.querySelector<HTMLElement>('.hero-title');
        if (svg && title) {
          if (zp === 0) target = null;
          else if (!target) target = this.buildDive(title, svg);
          const diving = zp > 0 && !!target;
          svg.style.opacity = diving ? '1' : '0';
          if (!diving) svg.style.backgroundColor = 'transparent';
          title.style.visibility = diving ? 'hidden' : '';
          if (target) {
            const W = window.innerWidth, H = window.innerHeight;
            const k = 1 + Math.pow(zp, 2.4) * (target.kMax - 1);
            const x0 = target.px - target.px / k;
            const y0 = target.py - target.py / k;
            svg.setAttribute('viewBox', `${x0.toFixed(2)} ${y0.toFixed(2)} ${(W / k).toFixed(3)} ${(H / k).toFixed(3)}`);
            // The last stretch: frost fills in behind the letter, so no photo is left at the edges.
            const fill = Math.min(1, Math.max(0, (zp - 0.82) / 0.15));
            svg.style.backgroundColor = `rgba(238, 242, 244, ${fill.toFixed(3)})`;
          }
        }
        // The photo pushes in a little with the zoom.
        gsap.set(media.querySelector('img'), { scale: 1 + Math.pow(zp, 2) * 0.25 });
        fadeOut.forEach(el => gsap.set(el, { opacity: 1 - Math.min(1, zp * 4) }));

        // The hero is light throughout (frost page, then the veiled photo): dark navbar text.
        const light = true;
        if (light !== this.navOnLight) this.zone.run(() => { this.navOnLight = light; });
      },
      onLeave: () => { if (!this.navOnLight) this.zone.run(() => { this.navOnLight = true; }); },
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

  /** Index (in titleChars + emChars) of the letter nearest the screen centre, at rest. */
  private nearestLetter(hero: HTMLElement): number {
    const chars = Array.from(hero.querySelectorAll<HTMLElement>('.hero-title .ch'));
    const content = this.heroCopy.nativeElement;
    const dy = Number(gsap.getProperty(content, 'y')) || 0; // ignore the fade-in offset
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let best = -1, bestD = Infinity;
    chars.forEach((el, i) => {
      if (!/[A-Za-z]/.test(el.textContent || '')) return;
      const r = el.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - cx, r.top - dy + r.height / 2 - cy);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /**
   * Copy the headline into the SVG, letter by letter at exactly the same
   * places, fonts and colours, and work out the zoom: the point deepest
   * inside the highlighted letter's stroke, and how far to zoom for it to
   * cover the whole screen.
   */
  private buildDive(title: HTMLElement, svg: SVGSVGElement): DiveTarget | null {
    const W = window.innerWidth, H = window.innerHeight;
    const chars = Array.from(title.querySelectorAll<HTMLElement>('.ch'));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const NS = 'http://www.w3.org/2000/svg';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    let targetEl: SVGTextElement | null = null;
    let targetBox: { rect: DOMRect; font: string; ascent: number; ch: string } | null = null;
    chars.forEach((el, i) => {
      const cs = getComputedStyle(el);
      // Draw the letter as shown (the headline is in capitals via CSS).
      const raw = el.textContent || '';
      const ch = cs.textTransform === 'uppercase' ? raw.toUpperCase() : raw;
      if (!ch.trim()) return;
      const r = el.getBoundingClientRect();
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.font = font;
      const ascent = ctx.measureText(ch).fontBoundingBoxAscent ?? parseFloat(cs.fontSize) * 0.9;
      // The span's box is its line box; centre the font's content area in it.
      const content = ascent + (ctx.measureText(ch).fontBoundingBoxDescent ?? parseFloat(cs.fontSize) * 0.25);
      const baseline = r.top + (r.height - content) / 2 + ascent;
      const t = document.createElementNS(NS, 'text');
      t.textContent = ch;
      t.setAttribute('x', r.left.toFixed(2));
      t.setAttribute('y', baseline.toFixed(2));
      t.setAttribute('font-family', cs.fontFamily);
      t.setAttribute('font-size', cs.fontSize);
      t.setAttribute('font-weight', cs.fontWeight);
      t.setAttribute('font-style', cs.fontStyle);
      t.setAttribute('fill', cs.color);
      svg.appendChild(t);
      if (i === this.diveIndex) {
        targetEl = t;
        targetBox = { rect: r, font, ascent: baseline - r.top, ch };
      }
    });
    if (!targetEl || !targetBox) return null;
    const tb = targetBox as { rect: DOMRect; font: string; ascent: number; ch: string };

    // The point deepest inside the letter: draw it and find the inked pixel
    // farthest from any blank one (a quick two-pass distance map).
    const pad = 4;
    const gw = Math.ceil(tb.rect.width) + pad * 2;
    const gh = Math.ceil(tb.rect.height) + pad * 2;
    canvas.width = gw;
    canvas.height = gh;
    ctx.font = tb.font;
    ctx.fillText(tb.ch, pad, pad + tb.ascent);
    const data = ctx.getImageData(0, 0, gw, gh).data;
    const dist = new Float32Array(gw * gh);
    for (let p = 0; p < gw * gh; p++) dist[p] = data[p * 4 + 3] > 128 ? 1e6 : 0;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const p = y * gw + x;
      if (!dist[p]) continue;
      dist[p] = Math.min(dist[p], (y > 0 ? dist[p - gw] : 0) + 1, (x > 0 ? dist[p - 1] : 0) + 1);
    }
    let bx = 0, by = 0, bd = 0;
    for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) {
      const p = y * gw + x;
      if (!dist[p]) continue;
      dist[p] = Math.min(dist[p], (y < gh - 1 ? dist[p + gw] : 0) + 1, (x < gw - 1 ? dist[p + 1] : 0) + 1);
      if (dist[p] > bd) { bd = dist[p]; bx = x; by = y; }
    }
    if (!bd) return null;
    const px = tb.rect.left - pad + bx + 0.5;
    const py = tb.rect.top - pad + by + 0.5;
    const far = Math.max(Math.hypot(px, py), Math.hypot(W - px, py), Math.hypot(px, H - py), Math.hypot(W - px, H - py));
    return { el: targetEl, px, py, kMax: (far / Math.max(1, bd - 1)) * 1.08 };
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
  focusSearch(): void {
    window.scrollTo({ top: 0, behavior: this.reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => this.searchInput?.nativeElement.focus(), this.reduceMotion ? 0 : 500);
  }

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
