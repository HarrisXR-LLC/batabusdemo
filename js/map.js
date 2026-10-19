// The map (plan 1·4 §4): MapLibre GL JS 6.12.0 (vendored, ES modules) with OpenFreeMap Positron,
// recolored light and quiet. If the street map can't load (no WebGL, offline, the library fails, or
// the style or first tiles take over ~8 s once the library is in), a simplified SVG map takes over
// (§8, fallback-map.js). The library itself gets longer (30 s): it is ours, and slow phone networks need it (2·4).
//
// Both backends offer the same small "stage": markers, story line layers, a camera that fits or
// follows, the bearing and pitch, and project(). vehicles.js, walker.js and scene.js use only that.
// Rule from the mockups: never style a MapLibre marker's root element; style an inner wrapper.
import { on, emit } from './state.js';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const LIB = '../vendor/maplibre-gl-6.12.0/';
const HOME = { center: [-85.635, 44.752], zoom: 13.2 };
const LIB_TIMEOUT_MS = 30000;  // the library and its stylesheet (about 300 KB compressed)
const TIMEOUT_MS = 8000;       // then OpenFreeMap's style and the first tiles
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const LINE_KINDS = ['route', 'ride', 'link', 'walk'];

let stage = null;

/** The library, its worker and its stylesheet. The stylesheet goes before ours, so ours still wins. */
async function loadLibrary() {
  const css = new Promise(ok => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL(`${LIB}maplibre-gl.css`, import.meta.url).href });
    link.onload = link.onerror = ok;
    document.head.insertBefore(link, document.head.querySelector('link[rel="stylesheet"]'));
  });
  const [lib] = await Promise.all([import(`${LIB}maplibre-gl.mjs`), css]);
  lib.setWorkerUrl(new URL(`${LIB}maplibre-gl-worker.mjs`, import.meta.url).href);
  return lib;
}

/** Colors from css/tokens.css, so the map follows the design system. */
function token(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function mix(hex, over, share) {
  const a = hex.match(/\w\w/g).map(h => parseInt(h, 16)), b = over.match(/\w\w/g).map(h => parseInt(h, 16));
  return '#' + a.map((v, i) => Math.round(v * share + b[i] * (1 - share)).toString(16).padStart(2, '0')).join('');
}
export function palette() {
  const land = '#F3F5F7';
  return {
    land, water: mix(token('--bata-blue'), land, .2), waterway: mix(token('--bata-blue'), land, .27), park: mix(token('--bata-lime'), land, .15),
    wood: mix(token('--bata-lime'), land, .12), residential: '#EDF0F3', building: '#E5E9ED', road: '#FFFFFF', casing: '#D9DFE5', path: '#E1E6EA',
    label: token('--g600'),   // labels 5.3:1 on the land (2·4 audit; was #6A7580, 4.3:1)
    blue: token('--bata-blue'), green: token('--bata-green-strong'), ink: token('--g900'),
  };
}

// ---------- the stage ----------

/**
 * Start the map in `container` (#map-layer). Returns the stage at once; stage.ready resolves when either
 * backend is drawn. The camera's padding follows the sheet (and leaves room for a tip).
 */
export function initMap({ container, screen, sheet }) {
  stage = new Stage(container, screen, sheet);
  stage.start();
  return stage;
}
export const getStage = () => stage;
/** For map-targeted tips (1·2 §7.3: tip.ready): resolves when the map has settled. */
export const mapSettled = () => (stage ? stage.idle() : Promise.resolve());

class Stage {
  constructor(container, screen, sheet) {
    this.container = container;
    this.screen = screen;
    this.sheetEl = sheet;
    this.backend = null;
    this.listeners = new Set();
    this.markers = new Set();
    this.lines = Object.fromEntries(LINE_KINDS.map(k => [k, []]));
    this.ready = new Promise(r => { this.resolveReady = r; });
    this.kind = null;
    this.watchSheet();
    this.credits();
  }

  async start() {
    const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
    const forced = new URLSearchParams(location.search).get('map');
    if (forced === 'simple' || !webgl || navigator.onLine === false) return this.fallback(forced === 'simple' ? 'asked for' : !webgl ? 'no WebGL' : 'offline');
    const within = (p, ms, what) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(`no ${what} after ${ms / 1000} s`)), ms))]);
    try {
      const lib = await within(loadLibrary(), LIB_TIMEOUT_MS, 'map library');
      this.use(await within(this.maplibre(lib), TIMEOUT_MS, 'street map'), 'maplibre');
    } catch (err) {
      this.fallback(err.message);      // a designed path (blocked tiles, offline): reported as info, not a warning
    }
  }

  async maplibre(lib) {
    const map = new lib.Map({
      container: this.container, ...HOME, attributionControl: false,
      dragRotate: false, pitchWithRotate: false, touchPitch: false, keyboard: false, boxZoom: false,
      maxPitch: 60, fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.getCanvas().tabIndex = -1;          // the map layer is aria-hidden: nothing inside may take focus
    this.pendingMap = map;
    const c = palette();
    await new Promise((ok, no) => {
      map.once('load', ok);
      map.on('error', e => { if (!map.loaded()) no(e.error || new Error('map error')); });
      map.setStyle(STYLE, { transformStyle: (_, next) => quietStyle(next, c) });   // quiet before the first frame
    });
    addLineLayers(map, c);
    await new Promise(ok => map.once('idle', ok));   // the first tiles are drawn
    return new MapLibreBackend(lib, map);
  }

  async fallback(reason) {
    try { this.pendingMap?.remove(); } catch {}
    this.pendingMap = null;
    this.container.textContent = '';
    const { SvgBackend } = await import('./fallback-map.js');
    this.use(new SvgBackend(this.container, palette()), 'svg');
    this.chip(`Simplified map`);
    console.info(`Simplified map (${reason})`);
  }

  use(backend, kind) {
    if (this.backend) return;
    this.backend = backend;
    this.kind = kind;
    this.container.dataset.map = kind;
    for (const m of this.markers) m.attach(backend);
    for (const k of LINE_KINDS) backend.setLines(k, this.lines[k]);
    backend.onMove(() => { for (const fn of this.listeners) fn(); });
    this.resolveReady(this);
    emit('map-ready', kind);
  }

  // --- markers: content goes in an inner wrapper; the root is left to the map ---
  marker(inner, { z = 1, at = null } = {}) {
    const m = new StageMarker(inner, z);
    this.markers.add(m);
    if (at) m.set(at);
    if (this.backend) m.attach(this.backend);
    m.onRemove = () => this.markers.delete(m);
    return m;
  }

  /** Replace one kind of story line ('route' | 'ride' | 'link' | 'walk') with these coordinate lists. */
  setLines(kind, lists) {
    this.lines[kind] = lists.filter(l => l && l.length > 1);
    this.backend?.setLines(kind, this.lines[kind]);
  }
  clearLines() { for (const k of LINE_KINDS) this.setLines(k, []); }

  onMove(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  bearing() { return this.backend?.bearing() ?? 0; }
  pitch() { return this.backend?.pitch() ?? 0; }
  zoom() { return this.backend?.zoom() ?? HOME.zoom; }
  project(ll) { return this.backend ? this.backend.project(ll) : { x: -1e4, y: -1e4 }; }
  size() { return { w: this.container.clientWidth, h: this.container.clientHeight }; }
  /** Resolves when the camera has finished moving and the map is drawn (captures wait for this). */
  async idle() {
    await this.ready;
    for (let left; (left = (this.easingUntil || 0) - performance.now()) > 0;) await new Promise(r => setTimeout(r, left + 30));
    await this.backend.idle();
  }

  /** Padding that keeps framed things clear of the top bar, the status pill, the sheet and a tip. */
  padding(extraBottom = 120) {
    const { h } = this.size();
    const top = this.kTop ?? 150;
    return { top, bottom: Math.min(h - top - 80, this.sheetSpace + extraBottom), left: 60, right: 60 };
  }

  fit(points, { pitch = 0, bearing = 0, maxZoom = 16.5, duration = 1100, top = 150, bottom = 120 } = {}) {
    if (!this.backend || !points.length) return;
    this.kTop = top;
    const d = reducedMotion.matches ? 0 : duration;
    this.easingUntil = performance.now() + d;
    this.backend.fit(points, { padding: this.padding(bottom), pitch, bearing, maxZoom, duration: d });
  }

  follow(center, { zoom, pitch = 0, bearing = 0, duration = 0, top = 150, bottom = 60 } = {}) {
    if (!this.backend) return;
    this.kTop = top;
    const d = reducedMotion.matches ? 0 : duration;
    if (d) this.easingUntil = performance.now() + d;
    this.backend.follow(center, { zoom, pitch, bearing, padding: this.padding(bottom), duration: d });
  }

  home() { this.backend?.follow(HOME.center, { zoom: HOME.zoom, pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 0 }); }
  /** Where the camera is now (for checks): center, zoom, pitch, bearing. */
  camera() { return this.backend?.camera() ?? null; }

  // --- the sheet's height sets the bottom padding and where the credits sit ---
  watchSheet() {
    const measure = () => {
      const s = this.screen.getBoundingClientRect(), t = this.sheetEl.getBoundingClientRect();
      const k = s.height / this.screen.offsetHeight || 1;
      this.sheetSpace = Math.max(0, (s.bottom - t.top) / k);
      this.screen.style.setProperty('--map-bottom', `${Math.round(this.sheetSpace)}px`);
    };
    this.sheetSpace = 300;
    new ResizeObserver(measure).observe(this.sheetEl);
    addEventListener('resize', measure);
    on('sheet-settled', measure);
    measure();
  }

  // --- credits (compact, always visible) and the "Simplified map" chip, outside the aria-hidden map ---
  credits() {
    const wrap = document.createElement('div');
    wrap.className = 'map-credits';
    wrap.innerHTML = `<button type="button" class="map-credits-btn glass" aria-expanded="false" aria-controls="map-credits-text" aria-label="Map credits">i</button>
      <p id="map-credits-text" class="map-credits-text glass" hidden><a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>
      · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a>
      · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a></p>`;
    const btn = wrap.querySelector('button'), text = wrap.querySelector('p');
    btn.addEventListener('click', () => { const open = text.hidden; text.hidden = !open; btn.setAttribute('aria-expanded', open); });
    this.screen.insertBefore(wrap, this.sheetEl);
  }

  chip(label) {
    const el = document.createElement('p');
    el.className = 'map-chip glass';
    el.textContent = label;
    this.screen.insertBefore(el, this.sheetEl);
  }
}

class StageMarker {
  constructor(inner, z) {
    this.root = document.createElement('div');     // left unstyled (MapLibre positions it); only z-index
    this.root.style.zIndex = z;
    this.root.append(inner);
    this.inner = inner;
    this.ll = null;
    this.visible = true;
  }
  attach(backend) { this.handle = backend.addMarker(this.root); if (this.ll) this.handle.set(this.ll); if (!this.visible) this.root.hidden = true; }
  set(ll) { this.ll = ll; this.handle?.set(ll); return this; }
  show(on) { if (on !== this.visible) { this.visible = on; this.root.hidden = !on; } return this; }
  remove() { this.handle?.remove(); this.handle = null; this.onRemove?.(); }
}

// ---------- MapLibre backend ----------

class MapLibreBackend {
  constructor(lib, map) { this.lib = lib; this.map = map; }
  addMarker(root) {
    const m = new this.lib.Marker({ element: root, anchor: 'center' });
    let added = false;
    return {
      set: ll => { m.setLngLat(ll); if (!added) { m.addTo(this.map); added = true; } },
      remove: () => m.remove(),
    };
  }
  setLines(kind, lists) {
    const src = this.map.getSource(`story-${kind}`);
    src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lists } });
  }
  onMove(fn) { this.map.on('move', fn); }
  bearing() { return this.map.getBearing(); }
  pitch() { return this.map.getPitch(); }
  zoom() { return this.map.getZoom(); }
  project(ll) { const p = this.map.project(ll); return { x: p.x, y: p.y }; }
  camera() { const c = this.map.getCenter(); return { center: [c.lng, c.lat], zoom: this.map.getZoom(), pitch: this.map.getPitch(), bearing: this.map.getBearing() }; }
  idle() { return this.map.loaded() && !this.map.isMoving() ? Promise.resolve() : new Promise(r => this.map.once('idle', r)); }
  // The map's own (persistent) padding is never set: fits pass padding to cameraForBounds, follows use an offset.
  fit(points, { padding, pitch, bearing, maxZoom, duration }) {
    const lons = points.map(p => p[0]), lats = points.map(p => p[1]);
    const bounds = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
    const cam = this.map.cameraForBounds(bounds, { padding, bearing, maxZoom });
    if (!cam) return;
    this.map.easeTo({ center: cam.center, zoom: cam.zoom, bearing, pitch, duration, essential: true });
  }
  follow(center, { zoom, pitch, bearing, padding, duration }) {
    const offset = [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2];
    this.map.easeTo({ center, pitch, bearing, offset, duration, essential: true, ...(zoom != null ? { zoom } : {}) });
  }
}

// ---------- the quiet style and our layers (values proven in the mockups: recolor() in mockups.html) ----------

/**
 * OpenFreeMap's Positron, made light and quiet before its first frame (setStyle's transformStyle): our colors,
 * gray labels with white halos, and no boundaries, airport or road-shield layers. Dropping those (rather than
 * hiding them) also means their filters never run, which kept MapLibre's worker warning in the console (2·4).
 */
function quietStyle(style, c) {
  const paint = {
    background: { 'background-color': c.land }, water: { 'fill-color': c.water }, waterway: { 'line-color': c.waterway },
    park: { 'fill-color': c.park }, landcover_wood: { 'fill-color': c.wood }, landuse_residential: { 'fill-color': c.residential },
    building: { 'fill-color': c.building, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15, 1] },
    highway_path: { 'line-color': c.path },
  };
  for (const id of ['highway_minor', 'highway_major_inner', 'highway_motorway_inner', 'highway_motorway_bridge_inner', 'highway_major_subtle', 'highway_motorway_subtle']) paint[id] = { 'line-color': c.road };
  for (const id of ['highway_major_casing', 'highway_motorway_casing', 'highway_motorway_bridge_casing']) paint[id] = { 'line-color': c.casing };
  const drop = id => ['boundary_3', 'boundary_2', 'boundary_disputed', 'airport'].includes(id) || id.includes('shield');
  return {
    ...style,
    layers: style.layers.filter(l => !drop(l.id)).map(l => ({
      ...l,
      paint: { ...l.paint, ...paint[l.id], ...(l.type === 'symbol' ? { 'text-color': c.label, 'text-halo-color': '#FFFFFF' } : {}) },
    })),
  };
}

function addLineLayers(map, c) {
  const before = map.getStyle().layers.find(l => l.type === 'symbol')?.id;   // under every label
  const empty = { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [] } };
  for (const k of LINE_KINDS) map.addSource(`story-${k}`, { type: 'geojson', data: empty });
  const round = { 'line-cap': 'round', 'line-join': 'round' };
  map.addLayer({ id: 'story-route', type: 'line', source: 'story-route', layout: round, paint: { 'line-color': c.blue, 'line-opacity': .3, 'line-width': 4 } }, before);
  map.addLayer({ id: 'story-ride-casing', type: 'line', source: 'story-ride', layout: round, paint: { 'line-color': '#FFFFFF', 'line-width': 10 } }, before);
  map.addLayer({ id: 'story-ride', type: 'line', source: 'story-ride', layout: round, paint: { 'line-color': c.blue, 'line-width': 6 } }, before);
  map.addLayer({ id: 'story-link-casing', type: 'line', source: 'story-link', layout: round, paint: { 'line-color': '#FFFFFF', 'line-width': 9 } }, before);
  map.addLayer({ id: 'story-link', type: 'line', source: 'story-link', layout: round, paint: { 'line-color': c.green, 'line-width': 5 } }, before);
  // Dashed "- - - -": 8px dashes, 6px gaps at 4px wide. Butt caps keep the gaps open (round caps closed them in the mockups).
  map.addLayer({ id: 'story-walk', type: 'line', source: 'story-walk', layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': c.ink, 'line-opacity': .7, 'line-width': 4, 'line-dasharray': [2, 1.5] } }, before);
}
