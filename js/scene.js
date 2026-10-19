// Map scenes (plan 1·4 §4.3–4.4): what the map shows at each step, worked out from the trip engine
// and the story clock. Lines (your route faint, your ride, the Link drive, dashed walks), story stops
// with short labels, pins, every vehicle, the walker, and the camera for the moment:
//   plan     home + ride + destination, pitch 0
//   ride     Where's my ride: you + your vehicle, refit gently (at most every 2 s)
//   live     follows the story: walking (zoom 17) → at the stop (17.5) → on board (follow, pitch 55°,
//            bearing along travel, 16.5; 90° − 35° sprite elevation, so the buses sit on the map; with
//            reduced motion north stays up) → arrived
//   arrived  ease back to pitch 0; stop + destination
// Phase 2 may change which option is "yours" (state.trips[n].optionId, and returnId for trip 2's ride back);
// otherwise it's the Recommended one.
import { on, state } from './state.js';
import { DATA, serviceFor, pointAt, pathAt } from './data.js';
import { options } from './engine.js';
import { STEPS, STEP_INDEX } from './steps.js';
import { router } from './router.js';
import { Fleet, loadSprites, motionReduced } from './vehicles.js';
import { Walker } from './walker.js';
import { esc } from './ui.js';

const ICONS = './assets/icons.svg';
const LEGS = {
  trip1: { trip: 1, from: 'home123', to: 'work', pins: [['home', '123 Sesame Street', 'home123', 'left'], ['work', 'Work', 'work', 'right']] },
  trip2: { trip: 2, from: 'home77', to: 'fair', pins: [['home', '77 Sesame Street', 'home77', 'left'], ['pin', 'Fair', 'fair', 'right']] },
  trip2back: { trip: 2, from: 'fair', to: 'home77', pins: [['pin', 'Fair', 'fair', 'right'], ['home', '77 Sesame Street', 'home77', 'left']] },
  trip3: { trip: 3, from: 'home123', to: 'airport', pins: [['home', '123 Sesame Street', 'home123', 'left'], ['plane', 'Cherry Capital Airport', 'airport', 'right']] },
};
// [leg, camera, your vehicle highlighted, where you are taken from (another leg)]. Steps not listed take
// their trip's leg with the plan camera.
const BY_STEP = {
  welcome: [null, 'overview'], end: [null, 'overview'],
  't1.booked': ['trip1', 'plan', true], 't1.ride': ['trip1', 'ride', true], 't1.walk': ['trip1', 'live', true], 't1.stop': ['trip1', 'live', true],
  't1.board': ['trip1', 'live', true], 't1.onboard': ['trip1', 'live', true], 't1.arrived': ['trip1', 'arrived', true],
  't2.return': ['trip2back', 'plan', false, 'trip2'],   // planning the ride back in the morning: you're at home
  't2.booked': ['trip2', 'plan', true], 't2.skip': ['trip2', 'plan', true], 't2.ride': ['trip2', 'ride', true],
  't2.walk': ['trip2', 'live', true], 't2.stop': ['trip2', 'live', true], 't2.board': ['trip2', 'live', true], 't2.onboard': ['trip2', 'live', true],
  't2.arrived': ['trip2', 'arrived', true],
  't2.rideBack': ['trip2back', 'ride', true], 't2.walkBack': ['trip2back', 'live', true], 't2.stopBack': ['trip2back', 'live', true],
  't2.boardBack': ['trip2back', 'live', true], 't2.onboardBack': ['trip2back', 'live', true], 't2.home2': ['trip2back', 'arrived', true],
  't3.link': ['trip3', 'ride', true], 't3.pass': ['trip3', 'live', true], 't3.onboard': ['trip3', 'live', true], 't3.arrived': ['trip3', 'arrived', true],
  't3.preview': ['trip3', 'preview', true],
};
const overrides = new Map();
let api = null, pending;   // a preview asked for before the map was ready

/**
 * Preview my Ride (preview.js): show one moment of a leg: only your vehicle (still) and your path, no other
 * vehicles; the camera frames `focus`. spec: { leg, option, t, focus, zoom, ease } or null to go back.
 */
export function scenePreview(spec) { if (api) api.preview(spec); else pending = spec; }

/** Phase 2: replace a step's scene ({ leg, camera, yours }). */
export function setScene(stepId, scene) { overrides.set(stepId, scene); }

function sceneFor(id) {
  if (overrides.has(id)) return overrides.get(id);
  const [leg, camera, yours = false, riderLeg = leg] = BY_STEP[id] || [`trip${id[1]}`, 'plan', false];
  return { leg, camera, yours, riderLeg };
}

function optionFor(leg, service) {
  const list = options(leg, { service });
  const chosen = state.trips[LEGS[leg].trip]?.[leg === 'trip2back' ? 'returnId' : 'optionId'];   // trip 2 books two legs
  return list.find(o => o.id === chosen) || list[0] || null;
}

/** Where you are on a trip option at minute t. */
export function riderAt(o, t, leg) {
  const L = LEGS[leg], to = DATA.places[L.to];
  if (o.kind === 'link') {
    const start = pathAt(o.path, 0);
    if (t < o.pickupEnd) return { phase: 'home', at: [start.lon, start.lat], heading: start.heading };
    if (t < o.rideArrive) return { phase: 'riding' };
    const end = pathAt(o.path, 1);
    return { phase: 'arrived', at: [end.lon, end.lat], heading: end.heading };
  }
  const [w1, , w2] = o.legs, boarded = Math.max(o.depart, o.here + 0.5);
  const along = (w, f) => { const p = pathAt(w.path, f); return { at: [p.lon, p.lat], heading: p.heading }; };
  if (t < w1.start) return { phase: 'home', ...along(w1, 0) };
  if (t < w1.end) return { phase: 'walking', first: true, ...along(w1, (t - w1.start) / (w1.end - w1.start)) };
  if (t < boarded) return { phase: 'stop', ...along(w1, 1) };
  if (t < o.rideArrive) return { phase: 'riding' };
  if (t < w2.end) return { phase: 'walking', ...along(w2, (t - w2.start) / (w2.end - w2.start)) };
  const end = along(w2, 1);
  return { phase: 'arrived', at: end.at, heading: end.heading, done: !!to };
}

// ---------- lines, stops and pins ----------

function sliceShape(shapeId, d0, d1) {
  const s = DATA.shapes[shapeId], a = pointAt(shapeId, d0), b = pointAt(shapeId, d1);
  return [[a.lon, a.lat], ...s.filter(p => p[2] > d0 && p[2] < d1).map(p => [p[0], p[1]]), [b.lon, b.lat]];
}

function linesFor(o) {
  if (!o) return { route: [], ride: [], link: [], walk: [] };
  if (o.kind === 'link') return { route: [], ride: [], walk: [], link: [DATA.paths[o.path].coords] };
  const shape = DATA.trips[o.trip].s, bus = o.legs[1];
  return {
    route: [DATA.shapes[shape].map(p => [p[0], p[1]])],
    ride: [sliceShape(shape, bus.boardDist, bus.alightDist)],
    walk: [DATA.paths[o.legs[0].path].coords, DATA.paths[o.legs[2].path].coords],
    link: [],
  };
}

const svgIcon = (name, filled = false) => `<svg class="i s${filled ? ' filled' : ''}" aria-hidden="true"><use href="${ICONS}#i-${name}"/></svg>`;

function stopEl(id, label = true) {
  const el = document.createElement('div');
  el.className = 'map-stop';
  el.innerHTML = `<div class="map-stop-dot"></div>${label ? `<div class="map-stop-label glass">${svgIcon('bus')}<span>${esc(DATA.stops[id].short || DATA.stops[id].name)}</span></div>` : ''}`;
  return el;
}

/**
 * Which stops and pins to show, so the map stays clean (M1, M3): planning shows home, the destination and
 * your stop; on the way to the stop only your stop; on board the stop you get off at and the destination.
 * The home pin hides while you walk (M3). Returns [{ pin: index } | { stop: id, label }].
 */
function decorFor(scene, rider) {
  const o = scene.option;
  if (!o) return [];
  const bus = o.kind === 'bus', phase = rider?.phase;
  if (scene.camera === 'plan') return [{ pin: 0 }, { pin: 1 }, ...(bus ? [{ stop: o.board, label: true }, { stop: o.alight, label: false }] : [])];
  if (scene.camera === 'arrived' || phase === 'arrived' || (phase === 'walking' && !rider.first)) return [{ pin: 1 }, ...(bus ? [{ stop: o.alight, label: true }] : [])];
  if (phase === 'riding') return [{ pin: 1 }, ...(bus ? [{ stop: o.board, label: false }, { stop: o.alight, label: true }] : [])];
  return [...(phase === 'walking' ? [] : [{ pin: 0 }]), ...(bus ? [{ stop: o.board, label: true }] : [])];
}

function pinEl(iconName, label, anchor) {
  const el = document.createElement('div');
  el.className = 'map-pin';
  el.dataset.anchor = anchor;
  el.innerHTML = `<div class="map-pin-dot"></div><div class="map-pin-chip glass">${svgIcon(iconName, iconName === 'plane')}<span>${esc(label)}</span></div>`;
  return el;
}

// ---------- the conductor ----------

export async function initScenes(stage) {
  await loadSprites();
  const fleet = new Fleet(stage), walker = new Walker(stage);
  let scene = null, decor = [], decorKey = '', camState = {}, edgeQueued = false, lastStep = null, pv = null;
  window.__scene = { fleet, walker, stage, get scene() { return scene; } };   // QA hooks (tools/, tests)

  const clearDecor = () => { for (const m of decor) m.remove(); decor = []; decorKey = ''; };

  function showDecor(items) {
    const key = JSON.stringify(items);
    if (key === decorKey) return;
    clearDecor();
    decorKey = key;
    const L = LEGS[scene.leg];
    for (const it of items) {
      if ('pin' in it) {
        const [ic, label, placeName, anchor] = L.pins[it.pin];
        decor.push(stage.marker(pinEl(ic, label, anchor), { z: 25, at: DATA.places[placeName] }));
      } else {
        const s = DATA.stops[it.stop];
        decor.push(stage.marker(stopEl(it.stop, it.label), { z: 15, at: [s.lon, s.lat] }));
      }
    }
    queueEdges();
  }

  function showPreview(spec) {
    pv = spec;
    if (!spec) { if (lastStep) apply(lastStep); return; }
    scene = { id: 'preview', leg: spec.leg, camera: 'preview', yours: true, option: spec.option, service: null,
      riderLeg: spec.leg, riderOption: spec.option, travelDay: true };
    for (const [k, v] of Object.entries(linesFor(spec.option))) stage.setLines(k, v);
    fleet.setScene({ service: null, yours: spec.option, vans: false, still: true });
    stage.fit(spec.focus.filter(Boolean), { maxZoom: spec.zoom || 16.5, duration: spec.ease === false || motionReduced() ? 0 : 900 });
    tick(performance.now(), true);
    queueEdges();
  }
  api = { preview: showPreview };

  function apply(step) {
    lastStep = step;
    const { leg, camera, yours, riderLeg } = sceneFor(step.id);
    if (camera === 'preview' && pv) { showPreview(pv); return; }   // the preview step keeps its own map
    const service = serviceFor(state.story.date);
    const option = leg ? optionFor(leg, service) : null;
    const riderOption = riderLeg && riderLeg !== leg ? optionFor(riderLeg, service) : option;
    // Trip 3 is booked a week ahead: on the booking day you're at home and no van is coming yet.
    const travelDay = leg !== 'trip3' || state.story.date === router.dates?.trip3travel;
    scene = { id: step.id, leg, camera: camera === 'preview' ? 'plan' : camera, yours, option, service, riderLeg: riderLeg || leg, riderOption, travelDay };
    clearDecor();
    const lines = linesFor(option);
    for (const [k, v] of Object.entries(lines)) stage.setLines(k, v);
    fleet.setScene({ service, yours: yours ? option : null, vans: true });
    camState = { phase: null, refit: 0, until: 0 };
    tick(performance.now(), true);
    queueEdges();
  }

  function frame(points, opts = {}) { stage.fit(points.filter(Boolean), opts); queueEdges(); }

  function camera(now, rider, vehicle, initial) {
    const s = scene, o = s.option, L = s.leg && LEGS[s.leg];
    const place = n => DATA.places[n];
    const stopLL = id => [DATA.stops[id].lon, DATA.stops[id].lat];
    if (s.camera === 'preview') return;                 // Preview my Ride sets the camera itself
    if (s.camera === 'overview') { if (initial) frame([place('home123'), place('work'), place('home77'), place('fair')], { maxZoom: 14 }); return; }
    if (!o) return;
    if (s.camera === 'plan') {
      if (initial) frame(o.kind === 'link' ? [place(L.from), place(L.to), ...DATA.paths[o.path].coords] :
        [place(L.from), stopLL(o.board), ...linesFor(o).ride[0], stopLL(o.alight), place(L.to)], { maxZoom: 16 });
      return;
    }
    if (s.camera === 'arrived') {
      if (initial) frame(o.kind === 'link' ? [place(L.to), DATA.paths[o.path].coords.at(-1)] : [stopLL(o.alight), place(L.to)], { maxZoom: 17 });
      return;
    }
    if (s.camera === 'ride') {   // you + your vehicle, refit at most every 2 s
      if (initial || now - camState.refit > 2000) {
        camState.refit = now;
        frame([rider?.at, vehicle && [vehicle.lon, vehicle.lat], o.kind === 'bus' ? stopLL(o.board) : null], { maxZoom: 16.5, top: 200, duration: initial ? 1100 : 1800 });
      }
      return;
    }
    // live: follow the story phase
    const phase = rider?.phase || 'home';
    const changed = phase !== camState.phase;
    if (changed) camState.phase = phase;
    const ease = changed ? (motionReduced() ? 0 : 1200) : 0;
    if (changed) camState.until = now + ease;
    if (!changed && now < camState.until) return;      // let the ease finish
    if (phase === 'walking') stage.follow(rider.at, { zoom: 17, pitch: 0, bearing: 0, duration: ease });
    else if (phase === 'stop') { if (changed) stage.follow(rider.at, { zoom: 17.5, pitch: 0, bearing: 0, duration: ease }); }
    else if (phase === 'riding' && vehicle) {
      // Reduced motion: the map never turns (north stays up), so the bus picture turns on screen the way it
      // really goes. Snapping the map to the bus once a second made turns look backwards (V0.1.3, S21+ report).
      const cur = stage.bearing(), diff = ((vehicle.heading - cur + 540) % 360) - 180;
      const bearing = motionReduced() ? 0 : changed ? vehicle.heading : cur + diff * 0.06;
      stage.follow([vehicle.lon, vehicle.lat], { zoom: 16.5, pitch: 55, bearing, duration: ease, top: 120, bottom: 40 });
    } else if (phase === 'home') { if (changed) frame([rider.at, o.kind === 'bus' ? stopLL(o.board) : null], { maxZoom: 17 }); }
    else if (phase === 'arrived' && changed) frame(o.kind === 'link' ? [rider.at] : [stopLL(o.alight), place(L.to)], { maxZoom: 17 });
  }

  let lastTick = 0, lastClock = null;
  function tick(now, initial = false) {
    if (!scene) return;
    const t = pv ? pv.t : state.story.clock;
    fleet.update(t, { full: initial });
    let rider = null;
    if (scene.leg && scene.option) {
      rider = riderAt(scene.riderOption, scene.travelDay ? t : -Infinity, scene.riderLeg);
      if (rider.phase === 'riding') walker.hide();
      else walker.set({ at: rider.at, heading: rider.heading, moving: rider.phase === 'walking' });
    } else walker.hide();
    showDecor(scene.leg ? decorFor(scene, rider) : []);
    if (initial || t !== lastClock || scene.camera === 'live') camera(now, rider, fleet.yourPosition && scene.yours ? fleet.yourPosition : null, initial);
    lastClock = t;
  }

  function loop(now) {
    const every = motionReduced() ? 100 : 33;      // ~30 fps; reduced motion: 10 steps a second (once a second read as broken)
    if (now - lastTick >= every && !document.hidden) { lastTick = now; tick(now); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Stop labels flip left near the right edge; pin chips slide inward to stay 8px from the edges.
  function queueEdges() { if (!edgeQueued) { edgeQueued = true; requestAnimationFrame(() => { edgeQueued = false; edges(); }); } }
  function edges() {
    const box = stage.container.getBoundingClientRect(), k = box.width / stage.container.clientWidth || 1;
    const W = stage.container.clientWidth, x = r => ({ left: (r.left - box.left) / k, right: (r.right - box.left) / k });
    for (const label of stage.container.querySelectorAll('.map-stop-label')) {
      label.classList.remove('flip');
      label.style.marginLeft = '0px';
      if (x(label.getBoundingClientRect()).right <= W - 8) continue;
      label.classList.add('flip');                          // try the dot's left side
      if (x(label.getBoundingClientRect()).left >= 8) continue;
      label.classList.remove('flip');                       // neither side fits (small phones): slide inward
      label.style.marginLeft = `${W - 8 - x(label.getBoundingClientRect()).right}px`;
    }
    for (const chip of stage.container.querySelectorAll('.map-pin-chip')) {
      chip.style.marginLeft = '0px';
      const r = chip.getBoundingClientRect(), left = (r.left - box.left) / k, right = (r.right - box.left) / k, W = stage.container.clientWidth;
      const dx = left < 8 ? 8 - left : right > W - 8 ? W - 8 - right : 0;
      if (dx) chip.style.marginLeft = `${dx}px`;
    }
  }
  stage.onMove(queueEdges);

  on('step', step => stage.ready.then(() => apply(step)));
  // Screens change the sheet's height: once it settles, frame again so nothing hides behind it.
  on('sheet-settled', () => { if (scene) { camState.phase = null; tick(performance.now(), true); } });
  on('restart', () => { fleet.clear(); walker.hide(); clearDecor(); stage.clearLines(); scene = null; stage.home(); });
  await stage.ready;
  if (pending) { pv = pending; pending = undefined; }
  if (state.step) apply(STEPS[STEP_INDEX.get(state.step)]);
}
