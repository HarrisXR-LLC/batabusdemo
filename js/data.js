// BATA data (plan 1·3 §5): loads data/bata.json and answers "where is this vehicle at minute t?".
// A position comes from the schedule: interpolate the distance along the shape between two stops by
// time, then find that distance on the shape. BATA's GTFS has shape_dist_traveled, so no projection.
// Times are minutes since midnight in Traverse City time (the story clock); nothing here uses Date.
import { weekday } from './story.js';

export let DATA = null;
let blocks = null;                 // 'service|block' → trip ids in time order
const pathLengths = new Map();     // path name → cumulative meters at each point

export async function loadData(url = './data/bata.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  useData(await res.json());
  return DATA;
}

/** Use data that is already loaded (the self-test reuses this). */
export function useData(data) {
  DATA = data;
  blocks = new Map();
  for (const [id, t] of Object.entries(DATA.trips)) {
    const key = `${t.v}|${t.b}`;
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key).push(id);
  }
  for (const list of blocks.values()) list.sort((a, b) => start(a) - start(b));
  pathLengths.clear();
}

/** BATA service ids: 1 Mon–Thu, 2 Fri, 3 Sat, 4 Sun. (Holiday exceptions are ignored: it's a story.) */
export function serviceFor(date) {
  const wd = weekday(date);
  return wd === 0 ? '4' : wd === 6 ? '3' : wd === 5 ? '2' : '1';
}

export const route = id => DATA.routes[id];
/** A stop's name for the screen: without the feed's "(Stella - Eastbound)" or " - Westbound" endings. */
export const stopLabel = id => DATA.stops[id].name.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+-\s+(East|West|North|South)bound$/i, '').trim();
export const stop = id => DATA.stops[id];
export const place = name => DATA.places[name];
export const path = name => DATA.paths[name];
const start = id => DATA.trips[id].pts[0][1];
const end = id => DATA.trips[id].pts.at(-1)[1];

// ---------- geometry ----------

const K = Math.cos(44.75 * Math.PI / 180);   // Traverse City: degrees of longitude are shorter
function bearing(a, b) {
  return ((Math.atan2((b[0] - a[0]) * K, b[1] - a[1]) * 180 / Math.PI) + 360) % 360;
}
const meters = (a, b) => Math.hypot((b[0] - a[0]) * K * 111320, (b[1] - a[1]) * 110540);

/** The point (and heading) at distance d along a shape. */
export function pointAt(shapeId, d) {
  const s = DATA.shapes[shapeId];
  let lo = 1, hi = s.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid][2] < d) lo = mid + 1; else hi = mid; }
  const a = s[lo - 1], b = s[lo];
  const f = b[2] === a[2] ? 0 : Math.max(0, Math.min(1, (d - a[2]) / (b[2] - a[2])));
  return { lon: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f, heading: bearing(a, b) };
}

/** Distance along the trip's shape at minute t (null when the trip isn't running), and whether it moves. */
function distAt(pts, t) {
  if (t < pts[0][1] || t > pts.at(-1)[1]) return null;
  for (let i = 1; i < pts.length; i++) {
    const [d0, t0] = pts[i - 1], [d1, t1] = pts[i];
    if (t <= t1) return { d: t1 === t0 ? d1 : d0 + (d1 - d0) * (t - t0) / (t1 - t0), moving: d1 !== d0 && t0 !== t1 };
  }
  return { d: pts.at(-1)[0], moving: false };
}

/** Where one trip's vehicle is at minute t, or null when it isn't running. */
export function tripAt(tripId, t) {
  const trip = DATA.trips[tripId], at = distAt(trip.pts, t);
  if (!at) return null;
  return { ...pointAt(trip.s, at.d), dist: at.d, trip: tripId, moving: at.moving };
}

const endPoint = id => ({ ...pointAt(DATA.trips[id].s, DATA.trips[id].pts.at(-1)[0]), trip: id, moving: false });
const startPoint = id => ({ ...pointAt(DATA.trips[id].s, DATA.trips[id].pts[0][0]), trip: id, moving: false });

/**
 * Where a vehicle is on a chain of trips (its block runs, in order) at minute t.
 * Between two trips it waits at the end of the earlier one. Before the first trip it is parked at
 * the start (onRoad false); after the last it stays at the end.
 */
export function chainAt(tripIds, t) {
  for (let i = 0; i < tripIds.length; i++) {
    const id = tripIds[i];
    if (t < start(id)) return i === 0 ? { ...startPoint(id), onRoad: false } : { ...endPoint(tripIds[i - 1]), onRoad: true };
    const p = tripAt(id, t);
    if (p) return { ...p, onRoad: true };
  }
  return { ...endPoint(tripIds.at(-1)), onRoad: false };
}

/** Every vehicle the schedule puts on the road at minute t (one per block), for the map (1·4). */
export function vehiclesAt(service, t, { exclude = [] } = {}) {
  const skip = new Set(exclude.map(id => `${DATA.trips[id]?.v}|${DATA.trips[id]?.b}`));
  const out = [], seen = new Set();
  for (const id of DATA.ambient[service] || []) {
    const key = `${DATA.trips[id].v}|${DATA.trips[id].b}`;
    if (seen.has(key) || skip.has(key)) continue;
    const chain = blocks.get(key);
    let p = null;
    for (let i = 0; i < chain.length && !p; i++) {
      p = tripAt(chain[i], t);
      const next = chain[i + 1];
      if (!p && next && t > end(chain[i]) && t < start(next) && start(next) - end(chain[i]) <= 60) p = endPoint(chain[i]);
    }
    if (!p) continue;
    seen.add(key);
    const r = DATA.routes[DATA.trips[p.trip].r];
    out.push({ ...p, block: DATA.trips[p.trip].b, route: DATA.trips[p.trip].r, short: r.short, cls: r.cls });
  }
  return out;
}

// ---------- routed paths ----------

function lengths(name) {
  if (!pathLengths.has(name)) {
    const c = DATA.paths[name].coords, acc = [0];
    for (let i = 1; i < c.length; i++) acc.push(acc[i - 1] + meters(c[i - 1], c[i]));
    pathLengths.set(name, acc);
  }
  return pathLengths.get(name);
}

/** The point at fraction f (0–1) along a routed path, with its heading. */
export function pathAt(name, f) {
  const c = DATA.paths[name].coords, acc = lengths(name), want = Math.max(0, Math.min(1, f)) * acc.at(-1);
  let i = 1;
  while (i < c.length - 1 && acc[i] < want) i++;
  const a = c[i - 1], b = c[i], seg = acc[i] - acc[i - 1];
  const g = seg ? (want - acc[i - 1]) / seg : 0;
  return { lon: a[0] + (b[0] - a[0]) * g, lat: a[1] + (b[1] - a[1]) * g, heading: bearing(a, b) };
}

/** Distance in meters between two [lon, lat] points (for checks and camera framing). */
export const distance = meters;
