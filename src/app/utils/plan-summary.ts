/**
 * "Trip at a glance" for the trip Overview: where you sleep each night and
 * what each day holds, simplified. Same rules as the app (utils/planSummary.js).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SLOT_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, anytime: 3 };

export interface GlanceStop { id?: string; name: string; startDate: string | null; endDate: string | null; }

export interface GlanceItem {
  id: string;
  title: string;
  category: string;
  scheduledDate: string;
  startTime?: string | null;
  slot?: string | null;
  sortOrder?: number | null;
  tripPlaceId?: string | null;
  createdAt?: string;
}

export interface GlanceDay { day: number; index: number; date: string; stop: GlanceStop | null; }

export interface GlanceStay { key: string; title: string; stopName: string; fromNight: number; toNight: number; }

export interface GlancePlannedDay {
  day: number;
  index: number;
  date: string;          // YYYY-MM-DD
  stopName: string;
  items: { id: string; title: string; category: string }[];
}

/** Whole-day number (UTC) of an ISO date or date-time; null when missing. */
export function isoToDay(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS);
}

export function dayToDate(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Wed 12 Mar" */
export function dayLabel(day: number): string {
  const d = new Date(day * DAY_MS);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Night 2" / "Nights 1–3" */
export function nightsLabel(from: number, to: number): string {
  return from === to ? `Night ${from}` : `Nights ${from}–${to}`;
}

/** The stop a day belongs to: the arrival stop on travel days, the most specific stop otherwise. */
function stopForDay(day: number, stops: GlanceStop[]): GlanceStop | null {
  if (!stops.length) return null;
  const startOf = (d: GlanceStop) => isoToDay(d.startDate);
  const endOf = (d: GlanceStop) => isoToDay(d.endDate) ?? isoToDay(d.startDate);
  const covering = stops.filter(d => startOf(d) != null && day >= startOf(d)! && day <= endOf(d)!);
  if (covering.length === 1) return covering[0];
  if (covering.length > 1) {
    const arriving = covering.filter(d => startOf(d) === day);
    const leaving = covering.filter(d => endOf(d) === day && startOf(d) !== day);
    const pool = arriving.length && leaving.length && arriving.length + leaving.length === covering.length
      ? arriving : covering;
    return [...pool].sort((a, b) => (endOf(a)! - startOf(a)!) - (endOf(b)! - startOf(b)!)
      || startOf(b)! - startOf(a)!)[0];
  }
  const started = stops.filter(d => startOf(d) != null && startOf(d)! <= day)
    .sort((a, b) => startOf(b)! - startOf(a)!);
  return started[0] || stops[0];
}

/** Every day of the trip (at most 60), with its stop. Empty without dates. */
export function tripDays(fromDate: string | null, toDate: string | null, stops: GlanceStop[]): GlanceDay[] {
  const start = isoToDay(fromDate);
  const end = isoToDay(toDate) ?? start;
  if (start == null || end == null || end < start) return [];
  const days: GlanceDay[] = [];
  for (let day = start; day <= Math.min(end, start + 59); day++) {
    days.push({ day, index: days.length, date: dayToDate(day), stop: stopForDay(day, stops) });
  }
  return days;
}

function timeToMinutes(time?: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || '');
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

function slotOf(item: GlanceItem): string {
  if (item.slot && item.slot in SLOT_ORDER) return item.slot;
  const m = timeToMinutes(item.startTime);
  if (m == null) return 'anytime';
  return m < 12 * 60 ? 'morning' : m < 17 * 60 ? 'afternoon' : 'evening';
}

/** Morning → afternoon → evening → anytime, then as arranged, then by time. */
function compareInDay(a: GlanceItem, b: GlanceItem): number {
  const ta = timeToMinutes(a.startTime); const tb = timeToMinutes(b.startTime);
  const byTime = ta == null && tb == null ? 0 : ta == null ? 1 : tb == null ? -1 : ta - tb;
  return (SLOT_ORDER[slotOf(a)] - SLOT_ORDER[slotOf(b)])
    || ((a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    || byTime
    || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}

const stayKey = (item: GlanceItem) => item.tripPlaceId || (item.title || '').trim().toLowerCase();

/**
 * Stays grouped by night (a stay carries on to the next nights with none of
 * their own at the same stop, but not onto the trip's last day; on a day with
 * two stays the later one counts), and each day with something else planned.
 */
export function summarizePlan(items: GlanceItem[], days: GlanceDay[]): { stays: GlanceStay[]; days: GlancePlannedDay[] } {
  const byDay = new Map<number, GlanceItem[]>(days.map(d => [d.day, []]));
  for (const it of items || []) {
    const list = byDay.get(isoToDay(it.scheduledDate) as number);
    if (list) list.push(it);
  }
  byDay.forEach(list => list.sort(compareInDay));

  const nights: ({ item: GlanceItem; stopId?: string } | null)[] = days.map(() => null);
  days.forEach((d, i) => {
    const stays = byDay.get(d.day)!.filter(it => it.category === 'stay');
    if (stays.length) { nights[i] = { item: stays[stays.length - 1], stopId: d.stop?.id }; return; }
    const prev = nights[i - 1];
    if (prev && i !== days.length - 1 && prev.stopId === d.stop?.id) nights[i] = prev;
  });

  const stays: GlanceStay[] = [];
  nights.forEach((n, i) => {
    if (!n) return;
    const open = stays[stays.length - 1];
    if (open && open.key === stayKey(n.item) && open.toNight === i) { open.toNight = i + 1; return; }
    stays.push({ key: stayKey(n.item), title: n.item.title, stopName: days[i].stop?.name || '', fromNight: i + 1, toNight: i + 1 });
  });

  const planned = days
    .map(d => ({
      day: d.day,
      index: d.index,
      date: d.date,
      stopName: d.stop?.name || '',
      items: byDay.get(d.day)!.filter(it => it.category !== 'stay')
        .map(it => ({ id: it.id, title: it.title, category: it.category })),
    }))
    .filter(d => d.items.length > 0);

  return { stays, days: planned };
}
