import { gsap } from 'gsap';
import { setSlidingNumber } from '../../shared/motion/sliding-number';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Map as GLMap, GeoJSONSource, StyleSpecification } from 'maplibre-gl';

/**
 * "Your trip, mapped": a scroll-driven camera over a real, Apple Maps-like map.
 *
 * The map is MapLibre GL (open source) with OpenFreeMap's "Liberty" style
 * (OpenStreetMap data; free, no key) and relief shading from the open AWS
 * terrain tiles. The library loads only when the section comes near.
 *
 * As you scroll: home in Bengaluru, a flight to Dubai, the drive to Abu Dhabi,
 * flights on to Doha and Muscat, and the flight home, with the camera flying,
 * tilting and turning between them. Pins drop with a ripple, each stop's card
 * pops up and then folds into a small tag, the day list ticks along, and the
 * trip's numbers count up. Scrubbed, so it all runs backwards too.
 */

type LngLat = [number, number];
interface Cam { lng: number; lat: number; zoom: number; pitch: number; bearing: number; }

export interface TripStop {
  id: string;
  name: string;
  at: LngLat;
  /** Where its tag sits from the pin (some are close together). */
  tagSide: 'up' | 'down' | 'left' | 'right';
  /** Where its card opens from the pin. */
  cardSide: 'up' | 'down' | 'left' | 'right';
  num?: string;
  days?: string;
  spots?: string;
}

export const TRIP_STOPS: TripStop[] = [
  { id: 'blr', name: 'Bengaluru', at: [77.5946, 12.9716], tagSide: 'down', cardSide: 'right' },
  { id: 'dxb', name: 'Dubai', at: [55.2708, 25.2048], tagSide: 'up', cardSide: 'right', num: 'Stop 1', days: 'Days 1–3', spots: 'Burj Khalifa · Al Fahidi · Desert safari' },
  { id: 'auh', name: 'Abu Dhabi', at: [54.3773, 24.4539], tagSide: 'down', cardSide: 'down', num: 'Stop 2', days: 'Day 4', spots: 'Sheikh Zayed Mosque · Louvre Abu Dhabi' },
  { id: 'doh', name: 'Doha', at: [51.531, 25.2854], tagSide: 'up', cardSide: 'left', num: 'Stop 3', days: 'Days 5–6', spots: 'Souq Waqif · Museum of Islamic Art' },
  { id: 'mct', name: 'Muscat', at: [58.4059, 23.588], tagSide: 'right', cardSide: 'right', num: 'Stop 4', days: 'Days 7–8', spots: 'Grand Mosque · Mutrah Corniche' },
];

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/** A curved leg between two places. Positive bend arcs north, negative south. */
class Leg {
  readonly p0: LngLat; readonly c: LngLat; readonly p2: LngLat;
  /** How much is drawn (0–1). */
  t = 0;
  constructor(a: LngLat, b: LngLat, bend: number) {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(dx, dy);
    let [nx, ny] = [-dy / len, dx / len];
    if (ny < 0) { nx = -nx; ny = -ny; }          // the northward side
    this.p0 = a; this.p2 = b;
    this.c = [(a[0] + b[0]) / 2 + nx * len * bend, (a[1] + b[1]) / 2 + ny * len * bend];
  }
  at(t: number): LngLat {
    const u = 1 - t;
    return [u * u * this.p0[0] + 2 * u * t * this.c[0] + t * t * this.p2[0], u * u * this.p0[1] + 2 * u * t * this.c[1] + t * t * this.p2[1]];
  }
  /** The drawn part, as a line. */
  line(): LngLat[] {
    if (this.t <= 0) return [];
    const n = Math.max(2, Math.ceil(this.t * 64));
    return Array.from({ length: n + 1 }, (_, i) => this.at((i / n) * this.t));
  }
}

export function tripMapStory(section: HTMLElement, onTrigger: (t: ScrollTrigger) => void, onCleanup: (fn: () => void) => void, animated: boolean): void {
  const panel = section.querySelector<HTMLElement>('.map-panel');
  const holder = section.querySelector<HTMLElement>('.map-gl');
  if (!panel || !holder) return;
  const q = <T extends Element>(sel: string) => section.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(section.querySelectorAll<T>(sel));
  const stop = (id: string) => TRIP_STOPS.find(s => s.id === id)!.at;
  let dead = false;
  onCleanup(() => { dead = true; });

  const legs = {
    fly1: new Leg(stop('blr'), stop('dxb'), 0.22),
    road: new Leg(stop('dxb'), stop('auh'), 0.08),
    fly2: new Leg(stop('auh'), stop('doh'), 0.3),
    fly3: new Leg(stop('doh'), stop('mct'), 0.28),
    fly4: new Leg(stop('mct'), stop('blr'), -0.12),   // home by a southern arc: the trip draws a loop
  };
  const flights: (keyof typeof legs)[] = ['fly1', 'fly2', 'fly3', 'fly4'];

  // Camera shots (zoom for a ~1100px-wide map; smaller panels zoom out a little).
  const shots: Record<string, Cam> = {
    region: { lng: 66, lat: 20, zoom: 3.7, pitch: 0, bearing: 0 },
    home: { lng: 77.59, lat: 12.97, zoom: 9.6, pitch: 55, bearing: -18 },
    route: { lng: 66.2, lat: 19.6, zoom: 4.5, pitch: 25, bearing: 0 },
    dubai: { lng: 55.25, lat: 25.15, zoom: 10.6, pitch: 58, bearing: 22 },
    road: { lng: 54.85, lat: 24.8, zoom: 9.1, pitch: 55, bearing: 40 },
    west: { lng: 53.0, lat: 24.95, zoom: 7.3, pitch: 45, bearing: 10 },
    east: { lng: 55.9, lat: 24.4, zoom: 6.8, pitch: 40, bearing: -12 },
    final: { lng: 61.6, lat: 19.4, zoom: 4.35, pitch: 18, bearing: 0 },   // room on the left for the day list
  };
  const cam: Cam = { ...shots['region'] };
  const vehicle = { plane: 0, car: 0 };
  let map: GLMap | undefined;
  let tl: gsap.core.Timeline | undefined;
  const dayTimes: number[] = [];
  let drawn = '';

  const anchors = qa<HTMLElement>('[data-anchor]');
  const plane = q<HTMLElement>('.plane');
  const car = q<HTMLElement>('.car');
  const days = qa<HTMLElement>('.itin li');
  const zoomShift = () => Math.log2(Math.min(1, (panel.clientWidth || 1100) / 1100)) * 0.85;

  /** Move the camera and redraw the route, pins, cards and vehicles. */
  const render = () => {
    // The day list: past days ticked, the current one lit.
    const now = tl ? tl.time() : (animated ? -1 : Infinity);
    const at = dayTimes.filter(t => now >= t).length - 1;
    days.forEach((d, i) => { d.classList.toggle('on', i === at); d.classList.toggle('done', i < at); });
    if (!map) return;

    map.jumpTo({ center: [cam.lng, cam.lat], zoom: cam.zoom + zoomShift(), pitch: cam.pitch, bearing: cam.bearing });

    // The route (only re-sent when it changes).
    const key = Object.values(legs).map(l => l.t.toFixed(4)).join();
    if (key !== drawn) {
      drawn = key;
      const line = (k: keyof typeof legs) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: legs[k].line() } });
      (map.getSource('flights') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: flights.map(line).filter(f => f.geometry.coordinates.length > 1) });
      (map.getSource('road') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [line('road')].filter(f => f.geometry.coordinates.length > 1) });
    }

    // Pins, cards and tags sit on their places.
    const px = (p: LngLat) => map!.project(p);
    anchors.forEach(el => {
      const p = px(stop(el.dataset['anchor']!));
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    });

    // The plane rides the latest flight that has started, turned along it; the car rides the road.
    const ride = (el: HTMLElement | null, leg: Leg, opacity: number) => {
      if (!el) return;
      el.style.opacity = String(opacity);
      if (opacity <= 0) return;
      const t = Math.max(0.001, leg.t);
      const a = px(leg.at(Math.max(0, t - 0.01))), b = px(leg.at(t));
      const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg)`;
    };
    ride(plane, legs[[...flights].reverse().find(k => legs[k].t > 0) ?? 'fly1'], vehicle.plane);
    ride(car, legs.road, vehicle.car);
  };

  const buildMap = async () => {
    const [{ default: maplibregl }, style] = await Promise.all([
      import('maplibre-gl'),
      fetch(STYLE_URL).then(r => r.json() as Promise<StyleSpecification>),
    ]);
    if (dead) return;

    // English place names, a softer sea, and relief shading under the water and roads.
    style.layers.forEach(l => {
      if (l.id === 'water' && l.type === 'fill') l.paint = { ...l.paint, 'fill-color': '#A8D1EA' };
      if (l.type === 'symbol' && l.layout && 'text-field' in l.layout) {
        l.layout['text-field'] = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];
      }
    });
    style.sources['dem'] = { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 12, attribution: 'Terrain: Mapzen / AWS Open Data' };
    const waterAt = style.layers.findIndex(l => l.id === 'water');
    style.layers.splice(waterAt < 0 ? 1 : waterAt, 0, {
      id: 'relief', type: 'hillshade', source: 'dem',
      paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#6B5A48', 'hillshade-highlight-color': '#FFFFFF', 'hillshade-accent-color': '#8A7660' },
    });

    map = new maplibregl.Map({
      container: holder,
      style,
      center: [cam.lng, cam.lat],
      zoom: cam.zoom + zoomShift(),
      interactive: false,
      attributionControl: { compact: true },
      fadeDuration: 0,
      // Room for the areas the trip visits (see warmUp), but no more: a big
      // cache is held in graphics memory, and in Safari that made the rest of
      // the page's scroll animations stutter.
      maxTileCacheSize: 350,
    });
    onCleanup(() => map?.remove());

    map.on('load', () => {
      if (dead || !map) return;
      map.addSource('flights', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('road', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'flights-glow', type: 'line', source: 'flights', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 6, 'line-opacity': 0.7, 'line-blur': 2 } });
      map.addLayer({ id: 'flights', type: 'line', source: 'flights', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1C2833', 'line-width': 2.6, 'line-dasharray': [0.1, 2.4] } });
      map.addLayer({ id: 'road-casing', type: 'line', source: 'road', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 9 } });
      map.addLayer({ id: 'road', type: 'line', source: 'road', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#D9481C', 'line-width': 5 } });
      drawn = '';
      // The credits start folded into their (i) button.
      holder.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      panel.classList.add('loaded');
      render();
      warmUp();
    });
    const ro = new ResizeObserver(() => { map?.resize(); render(); });
    ro.observe(panel);
    onCleanup(() => ro.disconnect());
  };

  /**
   * Preload the whole trip: while the section is still off screen, the camera
   * visits every shot (and the halfway points between them) and waits for that
   * area's tiles. They stay cached, so when the plane gets there the land is
   * already drawn. Stops at once if the section comes on screen.
   */
  let onScreen = false;
  const warmUp = async () => {
    if (!map) return;
    const order = ['region', 'home', 'route', 'dubai', 'road', 'west', 'east', 'final'].map(k => shots[k]);
    const visits: Cam[] = [];
    order.forEach((c, i) => {
      visits.push(c);
      const n = order[i + 1];
      if (n) visits.push({
        lng: (c.lng + n.lng) / 2, lat: (c.lat + n.lat) / 2,
        zoom: Math.min(c.zoom, n.zoom) - 0.3,   // a halfway camera is pulled back
        pitch: (c.pitch + n.pitch) / 2, bearing: (c.bearing + n.bearing) / 2,
      });
    });
    for (const c of visits) {
      if (dead || onScreen || !map) break;
      map.jumpTo({ center: [c.lng, c.lat], zoom: c.zoom + zoomShift(), pitch: c.pitch, bearing: c.bearing });
      await new Promise<void>(done => {
        const t = setTimeout(done, 6000);   // a slow tile server doesn't hold the rest up
        map!.once('idle', () => { clearTimeout(t); done(); });
      });
    }
    if (!dead) render();   // back to where the story is
  };

  // Is the section on screen (then the warm-up stops and the story drives the camera)?
  const seen = new IntersectionObserver(entries => {
    onScreen = entries.some(e => e.isIntersecting);
    if (onScreen) render();
  });
  seen.observe(section);
  onCleanup(() => seen.disconnect());

  // Build the map soon after the page has loaded (quietly, when the browser is
  // idle), so it's ready and warmed up long before you scroll to it. If you get
  // close first, it starts straight away.
  let started = false;
  const start = () => {
    if (started || dead) return;
    started = true;
    io.disconnect();
    buildMap().catch(() => { /* the cards and numbers still work without the map */ });
  };
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) start();
  }, { rootMargin: '200% 0px' });
  io.observe(section);
  onCleanup(() => io.disconnect());
  const idle = (cb: () => void) => ('requestIdleCallback' in window)
    ? (window as any).requestIdleCallback(cb, { timeout: 4000 })
    : setTimeout(cb, 1500);
  const afterLoad = () => idle(start);
  if (document.readyState === 'complete') afterLoad();
  else { window.addEventListener('load', afterLoad, { once: true }); onCleanup(() => window.removeEventListener('load', afterLoad)); }

  const nums = { days: 0, stops: 0, spots: 0 };
  const numEls = { days: q<HTMLElement>('[data-num="days"]'), stops: q<HTMLElement>('[data-num="stops"]'), spots: q<HTMLElement>('[data-num="spots"]') };
  // Each number flashes orange and lifts as it changes, so the count is noticed.
  const units = { days: ['day', 'days'], stops: ['stop', 'stops'], spots: ['spot', 'spots'] } as const;
  const showNums = () => {
    (Object.keys(nums) as (keyof typeof nums)[]).forEach(k => {
      const el = numEls[k];
      const n = Math.round(nums[k]);
      const v = String(n);
      const unit = q<HTMLElement>(`[data-unit="${k}"]`);
      if (unit) unit.textContent = units[k][n === 1 ? 0 : 1];
      if (!el || el.dataset['sn'] === v) return;
      // The digits roll to the new value (Sliding Number), with a flash of orange.
      setSlidingNumber(el, n);
      if (animated) el.animate([{ color: '#C9431A' }, { color: '' }], { duration: 900, easing: 'ease-out' });
    });
    // The counter shows once the trip has its first stop.
    section.classList.toggle('has-count', Math.round(nums.days) > 0);
  };

  if (!animated) {
    // Reduced motion: the finished trip, still.
    Object.values(legs).forEach(l => (l.t = 1));
    Object.assign(cam, shots['final']);
    Object.assign(nums, { days: 9, stops: 4, spots: 18 });
    dayTimes.push(0, 0, 0, 0, 0);
    section.classList.add('static');
    showNums();
    render();
    return;
  }

  // Start state.
  gsap.set(qa('.pin .pin-body'), { scale: 0, y: -24, transformOrigin: '50% 100%' });
  gsap.set(qa('.pin .ripple'), { scale: 0.4, opacity: 0 });
  gsap.set(qa('.stop-card'), { autoAlpha: 0, scale: 0.6 });
  gsap.set(qa('.stop-tag'), { autoAlpha: 0, scale: 0.7 });
  gsap.set(q('.itin'), { autoAlpha: 0, x: -20 });

  tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: render });
  const t = tl;
  const camTo = (shot: string, at: number, dur: number) =>
    t.to(cam, { ...shots[shot], duration: dur, ease: 'sine.inOut' }, at);
  const drop = (id: string, at: number) => {
    t.to(q(`.pin[data-for="${id}"] .pin-body`), { scale: 1, y: 0, duration: 0.35, ease: 'bounce.out' }, at)
      .fromTo(q(`.pin[data-for="${id}"] .ripple`), { scale: 0.4, opacity: 0.9 }, { scale: 3.2, opacity: 0, duration: 0.6, ease: 'power1.out', immediateRender: false }, at + 0.2);
  };
  const card = (id: string, at: number) =>
    t.to(q(`.stop-card[data-for="${id}"]`), { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(1.7)' }, at);
  /** The card folds away and leaves a small name tag. */
  const fold = (id: string, at: number) =>
    t.to(q(`.stop-card[data-for="${id}"]`), { autoAlpha: 0, scale: 0.6, duration: 0.25, ease: 'power2.in' }, at)
      .to(q(`.stop-tag[data-for="${id}"]`), { autoAlpha: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' }, at + 0.15);
  const fly = (leg: keyof typeof legs, at: number, dur: number, vehicleKey: 'plane' | 'car') => {
    t.to(vehicle, { [vehicleKey]: 1, duration: 0.12 }, at)
      .to(legs[leg], { t: 1, duration: dur, ease: 'power1.inOut' }, at)
      .to(vehicle, { [vehicleKey]: 0, duration: 0.12 }, at + dur - 0.12);
  };
  const day = (i: number, at: number) => { dayTimes[i] = at; };
  const count = (to: Partial<typeof nums>, at: number) =>
    t.to(nums, { ...to, duration: 0.4, ease: 'power1.out', onUpdate: showNums }, at);

  // Timing (in timeline units, spread over the section's scroll). The camera's
  // dives into each stop are long and gentle, with a short hold after each.

  // 0: the whole region, then a slow dive to home.
  t.to({}, { duration: 0.4 }, 0);
  camTo('home', 0.4, 1.6);
  drop('blr', 1.6);
  t.to(q('.stop-tag[data-for="blr"]'), { autoAlpha: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' }, 1.8);
  t.to(q('.itin'), { autoAlpha: 1, x: 0, duration: 0.3, ease: 'power2.out' }, 1.4);

  // 1: fly to Dubai, the camera pulling back to take in the route, then easing down onto Dubai.
  camTo('route', 2.3, 1.2);
  fly('fly1', 2.4, 2.0, 'plane');
  camTo('dubai', 3.9, 1.8);
  drop('dxb', 4.4);
  card('dxb', 4.7);
  day(0, 4.5);
  count({ days: 3, stops: 1, spots: 6 }, 4.5);

  // 2: the drive to Abu Dhabi, close up.
  camTo('road', 6.1, 1.0);
  fold('dxb', 6.2);
  fly('road', 6.4, 1.3, 'car');
  drop('auh', 7.6);
  card('auh', 7.8);
  day(1, 7.7);
  count({ days: 4, stops: 2, spots: 9 }, 7.7);

  // 3: on to Doha.
  camTo('west', 8.3, 1.3);
  fold('auh', 8.35);
  fly('fly2', 8.6, 1.2, 'plane');
  drop('doh', 9.7);
  card('doh', 9.9);
  day(2, 9.8);
  count({ days: 6, stops: 3, spots: 13 }, 9.8);

  // 4: across to Muscat.
  camTo('east', 10.5, 1.3);
  fold('doh', 10.55);
  fly('fly3', 10.8, 1.3, 'plane');
  drop('mct', 12.0);
  card('mct', 12.2);
  day(3, 12.1);
  count({ days: 8, stops: 4, spots: 17 }, 12.1);

  // 5: home, the camera pulling back to the whole trip.
  fold('mct', 12.8);
  camTo('final', 12.8, 1.6);
  fly('fly4', 13.0, 1.8, 'plane');
  day(4, 14.6);
  count({ days: 9, spots: 18 }, 14.6);
  t.to({}, { duration: 0.6 }, 14.9);

  onTrigger(ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.9,
    animation: t,
  }));
}
