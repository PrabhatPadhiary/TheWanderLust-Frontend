/**
 * How far (km) a place can be from every stop on a trip before "Add to trip"
 * asks whether it belongs there. Wide enough for day trips (Mysore from
 * Bengaluru), narrow enough to catch another city. Same value as the app.
 */
export const FAR_FROM_TRIP_KM = 150;

export interface LatLng { latitude?: number | null; longitude?: number | null; }

const ok = (p?: LatLng | null): p is { latitude: number; longitude: number } =>
  !!p && Number.isFinite(p.latitude as number) && Number.isFinite(p.longitude as number);

/** Straight-line distance in km, or null when either point is unknown. */
export function distanceKm(a?: LatLng | null, b?: LatLng | null): number | null {
  if (!ok(a) || !ok(b)) return null;
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The stop closest to `point` with its distance, or null when nothing can be measured. */
export function nearestStop<T extends LatLng>(stops: T[] | null | undefined, point: LatLng | null): { stop: T; km: number } | null {
  let best: { stop: T; km: number } | null = null;
  for (const stop of stops || []) {
    const km = distanceKm(stop, point);
    if (km != null && (!best || km < best.km)) best = { stop, km };
  }
  return best;
}

/** "2,700 km": rounded to what's worth saying. */
export function formatFarKm(km: number): string {
  const step = km < 1000 ? 10 : 100;
  return `${(Math.round(km / step) * step).toLocaleString('en-US')} km`;
}

const REGION_TYPES = new Set([
  'locality', 'sublocality', 'postal_town', 'colloquial_area', 'country',
  'administrative_area_level_1', 'administrative_area_level_2', 'administrative_area_level_3',
]);

/** A search result that is a city/region rather than a business. */
export function isRegionResult(result: { types?: string[] } | null | undefined): boolean {
  const types = result?.types;
  if (!Array.isArray(types) || types.length === 0) return true;
  return !types.includes('establishment') && types.some((t) => REGION_TYPES.has(t));
}

/**
 * Likely city names in an address, best first
 * ("…, Downtown Dubai - Dubai" → Dubai; "…, Bengaluru, Karnataka 560001, India" → Bengaluru).
 */
export function cityFromAddress(address?: string | null): string[] {
  const parts = (address || '').split(/,| - /).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [];
  const out: string[] = [];
  const add = (c?: string) => { if (c && !/\d/.test(c) && !out.includes(c)) out.push(c); };
  const coded = parts.map((p, i) => (/\d{3,}|\b[A-Z]{1,2}\d/.test(p) ? i : -1)).filter((i) => i > 0);
  const last = coded.length ? coded[coded.length - 1] : -1;
  if (last > 0) {
    add(parts[last - 1]);
    add(parts[last].split(/\s+/).filter((w) => !/\d/.test(w)).join(' '));
  }
  if (parts.length >= 3) add(parts[parts.length - 3]);
  add(parts[parts.length - 2]);
  // Short addresses ("Sheikh Zayed Rd - Dubai") end in the city itself.
  if (parts.length === 2) add(parts[1]);
  return out.slice(0, 2);
}
