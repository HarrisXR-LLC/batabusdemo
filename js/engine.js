// Trip engine (plan 1·3 §7): trip options with "(Recommended)", walking, bus and Link legs, fares,
// room levels and the Where's my ride states. Everything comes from data/bata.json and the story
// clock (minutes since midnight, Traverse City time); nothing here reads the device clock.
//
//   options('trip1', { service })   → the option cards for a story request (CONFIG.requests)
//   rideStatus(option, t)           → Where's my ride at minute t: state + the words to show
//   vehicleAt(option, t)            → where your bus or van is at minute t (for the map, 1·4)
import { CONFIG } from './config.js';
import { DATA, chainAt, pathAt, place } from './data.js';
import { formatTime, formatRange, toMinutes } from './story.js';

const E = CONFIG.engine;
const mins = v => (v == null ? null : typeof v === 'string' ? toMinutes(v) : v);
const grid = (v, step, up) => (up ? Math.ceil(v / step - 1e-9) : Math.floor(v / step + 1e-9)) * step;

// ---------- legs (§7.1) ----------

/** Walk minutes: the routed path at 1.2 m/s, rounded to the nearest minute (at least 1). */
export const walkMinutes = name => Math.max(1, Math.round(DATA.paths[name].meters / E.walkSpeed / 60));

/** Link minutes door to door: the 2-min pickup plus the routed drive, rounded up. */
export const linkMinutes = name => Math.ceil(E.linkPickupMin + DATA.paths[name].minutes - 1e-9);

function room(legName, dep) {
  const table = E.room[legName] || {};
  const [level, seats = null] = table[formatHHMM(dep)] || table.default || ['plenty'];
  return { level, seats };
}
const formatHHMM = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

function busOptions(req, service) {
  const leg = DATA.story[req.leg], svc = leg?.svc[service];
  if (!svc) return [];
  const r = DATA.routes[leg.route];
  const walkTo = walkMinutes(req.walkTo), walkFrom = walkMinutes(req.walkFrom);
  const floor = mins(req.now) ?? mins(req.leaveAfter) ?? -Infinity;
  return svc.deps.map(d => {
    const latestLeave = d.dep - E.stopBufferMin - walkTo;              // still catches it
    const planLeave = Math.min(latestLeave, d.here - E.stopBufferMin - walkTo);   // at the stop before the bus is
    const leaveBy = Math.min(latestLeave, Math.max(planLeave, floor));
    const arrive = d.arr + walkFrom;
    return {
      id: `bus:${d.trip}`, kind: 'bus', leg: req.leg, trip: d.trip, prev: d.prev, cls: r.cls,
      route: leg.route, routeShort: r.short, name: r.short === 'Bayline' ? 'Bayline' : `Route ${r.short}`,
      leaveBy, depart: d.dep, here: d.here, arrive, rideArrive: d.arr, walkMin: walkTo,
      fareCents: r.fareCents, room: room(req.leg, d.dep), last: d.last, reachable: latestLeave >= floor,
      board: leg.board, alight: leg.alight,
      legs: [
        { type: 'walk', path: req.walkTo, minutes: walkTo, start: leaveBy, end: leaveBy + walkTo },
        { type: 'bus', trip: d.trip, route: leg.route, board: leg.board, alight: leg.alight, dep: d.dep, arr: d.arr, boardDist: d.bd, alightDist: d.ad },
        { type: 'walk', path: req.walkFrom, minutes: walkFrom, start: d.arr, end: arrive },
      ],
    };
  });
}

function linkOptions(req) {
  const L = req.link, door = linkMinutes(L.path), now = mins(req.now) ?? mins(req.leaveAfter), by = mins(req.arriveBy);
  const slots = [];
  if (now == null && by != null) {        // arrive-by: the latest pickup that arrives with the cushion, then earlier ones
    const p = grid(by - E.linkCushionMin - door, 5, false);
    for (let i = 0; i < L.count; i++) slots.push(p - i * E.linkSlotMin);
  } else {                                // now / leave-after: the soonest pickup, then later ones
    const p = grid(now + E.linkLeadMin, 5, true);
    for (let i = 0; i < L.count; i++) slots.push(p + i * E.linkSlotMin);
  }
  return slots.map(p => ({
    id: `link:${p}`, kind: 'link', cls: 'van', name: 'Link van', path: L.path, approach: L.approach || null,
    leaveBy: p, depart: p, here: p, pickupEnd: p + E.linkPickupMin, arrive: p + door,
    rideArrive: p + E.linkPickupMin + DATA.paths[L.path].minutes, fareCents: DATA.fares.link,
    room: { level: 'reserved', seats: null }, last: false, reachable: true,
    legs: [{ type: 'link', path: L.path, pickup: p, dep: p + E.linkPickupMin, arr: p + door, meters: DATA.paths[L.path].meters }],
  }));
}

// ---------- options and "(Recommended)" (§7.2) ----------

/**
 * The option cards for a story request. `over` can replace any request field (e.g. { now: clock }).
 * Order: Recommended first, then the other valid options by departure, then late ones.
 */
export function options(name, { service, ...over } = {}) {
  const req = { ...CONFIG.requests[name], ...over };
  const by = mins(req.arriveBy), arriveByMode = by != null;
  let list = [];
  if (req.leg) {
    const bus = busOptions(req, service).filter(o => o.reachable);
    const valid = bus.filter(o => !arriveByMode || o.arrive <= by);
    const late = arriveByMode ? bus.filter(o => o.arrive > by).slice(0, req.late ?? 0) : [];
    list = (arriveByMode ? valid.slice(-(req.buses ?? 2)) : valid.slice(0, req.buses ?? 2)).concat(late.map(o => ({ ...o, late: true })));
  }
  if (req.link) list = list.concat(linkOptions(req).map(o => (arriveByMode && o.arrive > by ? { ...o, late: true } : o)));
  list = list.map(o => ({ late: false, ...o, doorToDoor: o.arrive - o.leaveBy }));

  // Recommended: lowest fare → shortest door to door → arrive-by: later departure / leave-after: earlier.
  const valid = list.filter(o => !o.late);
  const better = (a, b) => a.fareCents - b.fareCents || a.doorToDoor - b.doorToDoor || (arriveByMode ? b.depart - a.depart : a.depart - b.depart);
  const best = valid.slice().sort(better)[0];
  for (const o of list) {
    o.recommended = o === best;
    o.times = formatRange(o.depart, o.arrive);
    o.fare = formatFare(o.fareCents);
    o.note = o.late ? `Arrives ${formatTime(o.arrive)}` : o.last ? 'Last bus' : '';
  }
  const rest = list.filter(o => o !== best);
  return [best, ...rest.filter(o => !o.late).sort((a, b) => a.depart - b.depart), ...rest.filter(o => o.late)].filter(Boolean);
}

// ---------- fares, trip code, cancel deadline (§7.4, §7.5a) ----------

/** 0 → "Free", 150 → "$1.50", 600 → "$6" (or "$6.00" with exact). */
export function formatFare(cents, { exact = false } = {}) {
  if (!cents) return 'Free';
  return exact || cents % 100 ? `$${(cents / 100).toFixed(2)}` : `$${cents / 100}`;
}
export const totalFare = (...opts) => opts.reduce((sum, o) => sum + (o?.fareCents || 0), 0);

const CODE = 'ACDEFGHJKMNPQRTUVWXY34679';   // no look-alikes: 0/O, 1/I/L, 2/Z, 5/S, 8/B
/** A 6-character trip code shown as XXX-XXX, made with crypto.getRandomValues, kept in memory only. */
export function tripCode() {
  const out = [], buf = new Uint8Array(16);
  while (out.length < 6) {
    crypto.getRandomValues(buf);
    for (const b of buf) if (b < 250 && out.length < 6) out.push(CODE[b % 25]);   // 250 = 10 × 25: no bias
  }
  return `${out.slice(0, 3).join('')}-${out.slice(3).join('')}`;
}

export const cancelBy = option => option.depart - E.cancelLeadMin;

// ---------- your vehicle and Where's my ride (§7.6) ----------

const approachMinutes = o => (o.approach ? DATA.paths[o.approach].minutes : 10);

/** When your vehicle starts toward you (its block run, or the Link van's previous drop-off). */
export function onRoadFrom(option) {
  if (option.kind === 'link') return option.here - approachMinutes(option);
  return DATA.trips[option.prev || option.trip].pts[0][1];
}

/** Where your bus or van is at minute t: { lon, lat, heading, moving, onRoad }. */
export function vehicleAt(option, t) {
  if (option.kind === 'bus') return chainAt([option.prev, option.trip].filter(Boolean), t);
  const from = onRoadFrom(option), drive = DATA.paths[option.path].minutes;
  if (t < from) return { ...(option.approach ? pathAt(option.approach, 0) : home(option)), moving: false, onRoad: false };
  if (t < option.here) return { ...pathAt(option.approach, (t - from) / (option.here - from)), moving: true, onRoad: true };
  if (t < option.pickupEnd) return { ...pathAt(option.path, 0), moving: false, onRoad: true };
  const f = (t - option.pickupEnd) / drive;
  return { ...pathAt(option.path, f), moving: f < 1, onRoad: f < 1 };
}
const home = o => { const c = DATA.paths[o.path].coords[0]; return { lon: c[0], lat: c[1], heading: 0 }; };

/** The story time "Jump to 30 s" moves to: 30 seconds before your vehicle reaches you. */
export const jumpTime = (option, seconds = 30) => option.here - seconds / 60;

/**
 * Where's my ride at minute t. A clock time until the vehicle is under 5 min away, then a countdown:
 *   scheduled → onway → near ("2 min") → arriving → here ("Leaves 8:00 AM" while it waits) → riding → arrived
 */
export function rideStatus(option, t) {
  const noun = option.kind === 'link' ? 'ride' : 'bus';
  const at = formatTime(option.here), leaves = option.kind === 'link' ? option.pickupEnd : option.depart;
  const boardedAt = Math.max(leaves, option.here + 0.5);   // a pass-through stop (11:13 → 11:13) still has a "Here" moment
  const left = option.here - t;
  let state, big, sub = null, pill = null, minutes = null;
  if (t >= option.rideArrive) { state = 'arrived'; big = `Arrived ${formatTime(option.arrive)}`; }
  else if (t >= boardedAt) { state = 'riding'; minutes = Math.ceil(option.rideArrive - t - 1e-9); big = `Arrives ${formatTime(option.arrive)}`; }
  else if (left <= 0) {
    state = 'here'; big = 'Here'; pill = `Your ${noun} is here`;
    if (leaves - option.here >= 1) sub = `Leaves ${formatTime(leaves)}`;
  } else if (t < onRoadFrom(option)) { state = 'scheduled'; big = `Arrives ${at}`; sub = 'Not on the road yet'; }
  else if (left >= 5) { state = 'onway'; big = `Arrives ${at}`; pill = `Your ${noun} is on its way!`; }
  else if (left >= 1) { state = 'near'; minutes = Math.ceil(left - 1e-9); big = `${minutes} min`; sub = `Arrives ${at}`; pill = `Your ${noun} is on its way!`; }
  else { state = 'arriving'; big = 'Arriving'; pill = `Your ${noun} is arriving`; }
  return { state, big, sub, pill, minutes, here: option.here, leaves };
}

export const engine = { options, walkMinutes, linkMinutes, formatFare, totalFare, tripCode, cancelBy, rideStatus, vehicleAt, jumpTime, onRoadFrom, place };
