// Vehicles on the map (plan 1·4 §6): every vehicle the schedule puts on the road, from the story clock.
//   - Sprites: pre-rendered isometric SVGs (assets/sprites/), 9 frames mirrored to 16 directions.
//     The frame is the vehicle's heading minus the map's bearing (a port of Max's GPS frameChoice()).
//   - Others: 0.34 px per decimeter, slightly dimmed, a soft static shadow, no effects.
//   - Yours: ×1.4, full color, on top, with a "Your bus" tag (below the picture when there's no room above it).
//     Moving: it bobs and puffs exhaust from the manifest's tail point.
//     Waiting at a stop: idle smoke and a small shudder. Reduced motion: no effects, positions 10 times a second.
//   - Link vans have no schedule, so a few are simulated, driving back and forth on routed streets.
// Each marker's content sits in an inner wrapper; the map positions the root (never styled).
import { DATA, vehiclesAt, pathAt } from './data.js';
import { vehicleAt } from './engine.js';

const BASE = './assets/sprites/';
const K_OTHER = 0.34, K_YOURS = 0.476;          // px per decimeter (M3)
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const PUFF = 'M-12 5C-22 5-22-9-12-10C-10-22 7-22 10-11C23-11 23 6 14 8C13 19-4 20-8 11C-15 14-20 8-12 5Z';
// Simulated Link vans: a routed path each, a start offset (minutes) so they don't bunch up.
const VANS = [{ path: 'link3a', offset: 0 }, { path: 'link1', offset: 4 }, { path: 'link3', offset: 9 }];

let manifest = null;
export async function loadSprites() {
  manifest = await (await fetch(`${BASE}manifest.json`)).json();
  // Warm the cache so a vehicle never flashes empty when it turns.
  for (const c of Object.values(manifest.classes)) for (const f of c.frames) { const i = new Image(); i.src = BASE + f; }
  return manifest;
}

/** 16 bins of 22.5°; bins 9–15 use frame 16 − bin, mirrored (Max's GPS frameChoice). */
export function frameChoice(heading, mapBearing = 0) {
  const h = (((heading - mapBearing) % 360) + 360) % 360;
  const bin = Math.round(h / 22.5) % 16;
  return { bin, index: bin > 8 ? 16 - bin : bin, mirrored: bin > 8 };
}

const zoomScale = z => Math.max(0.8, Math.min(1.3, 1 + (z - 15) * 0.12));
const TAG_H = 26;   // the tag's height with its ring (map.css: 13 px text, fixed)

class VehicleMarker {
  constructor(stage, cls, { yours = false } = {}) {
    this.stage = stage;
    this.cls = cls;
    this.yours = yours;
    this.el = document.createElement('div');
    this.el.className = `veh ${yours ? 'yours' : 'dim'}`;
    // Yours carries a "Your bus" tag (a Link van: "Your ride") with a pointer, just above the picture (V0.1.4)
    const tag = yours ? `<div class="yours-tag" aria-hidden="true"><span>${cls === 'van' ? 'Your ride' : 'Your bus'}</span></div>` : '';
    this.el.innerHTML = `<div class="veh-shadow"></div>${yours ? '<div class="exhaust" aria-hidden="true"></div>' : ''}
      <div class="veh-bob"><div class="veh-flip"><img class="veh-sprite" alt="" decoding="async"></div></div>${tag}`;
    this.img = this.el.querySelector('img');
    this.flip = this.el.querySelector('.veh-flip');
    this.shadow = this.el.querySelector('.veh-shadow');
    this.exhaust = this.el.querySelector('.exhaust');
    this.tag = this.el.querySelector('.yours-tag');
    this.marker = stage.marker(this.el, { z: yours ? 30 : 10 });
    this.key = '';
    this.mode = '';
  }

  update(p, mapBearing, zoom) {
    this.marker.set([p.lon, p.lat]);
    const c = manifest.classes[this.cls], f = frameChoice(p.heading, mapBearing);
    const k = (this.yours ? K_YOURS : K_OTHER) * zoomScale(zoom);
    const mode = !this.yours ? 'still' : p.moving ? 'driving' : p.onRoad === false ? 'parked' : 'idle';
    const key = `${f.index}|${f.mirrored}|${k.toFixed(3)}|${mode}`;
    if (key === this.key) return;
    this.key = key;
    const [x, y, w, h] = c.viewBox.map(v => v * k), L = c.length * 10 * k;
    if (this.img.dataset.f !== String(f.index)) { this.img.src = BASE + c.frames[f.index]; this.img.dataset.f = f.index; }
    Object.assign(this.img.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    this.flip.classList.toggle('mirrored', f.mirrored);
    Object.assign(this.shadow.style, { left: `${-L * 0.32}px`, top: `${-L * 0.09}px`, width: `${L * 0.64}px`, height: `${L * 0.18}px` });
    if (this.tag) {   // over the picture's middle, 9 px above it (or below it)
      this.tagAt = { above: y - 9, below: y + h + 9 };
      Object.assign(this.tag.style, { left: `${f.mirrored ? -(x + w / 2) : x + w / 2}px`, top: `${this.below ? this.tagAt.below : this.tagAt.above}px` });
    }
    if (this.exhaust) this.smoke(c, f, k, L, mode);
    if (mode !== this.mode) { if (this.mode) this.el.classList.remove(this.mode); this.el.classList.add(mode); this.mode = mode; }
  }

  /** Exhaust (driving) or idle smoke (waiting): 4 staggered puffs drifting from the tail, away from the center. */
  smoke(c, f, k, L, mode) {
    if (mode !== 'driving' && mode !== 'idle') { this.exhaust.innerHTML = ''; this.exhaust.dataset.mode = ''; return; }
    let [tx, ty] = c.tails[f.index].map(v => v * k);
    if (f.mirrored) tx = -tx;
    const len = Math.hypot(tx, ty) || 1, turn = Math.atan2(-tx / len, ty / len) * 180 / Math.PI;
    const box = Math.max(16, Math.min(30, L * (mode === 'driving' ? 0.5 : 0.38)));
    const dur = mode === 'driving' ? 3.6 : 4.8;
    Object.assign(this.exhaust.style, { left: `${tx}px`, top: `${ty}px`, width: `${box}px`, height: `${box}px` });
    this.exhaust.style.setProperty('--turn', `${turn.toFixed(1)}deg`);
    this.exhaust.style.setProperty('--puff-duration', `${dur}s`);
    if (this.exhaust.dataset.mode !== mode) {
      this.exhaust.dataset.mode = mode;
      this.exhaust.className = `exhaust ${mode === 'driving' ? 'drive' : 'park'}`;
      this.exhaust.innerHTML = [0, 1, 2, 3].map(i => `<span class="puff" style="animation-delay:-${(i * dur / 4).toFixed(2)}s"><svg viewBox="-48 -48 96 96"><path d="${PUFF}"/></svg></span>`).join('');
    }
  }

  /** The tag flips below the picture when its top would go under `safe` (map px), and back when there's room again. */
  tagRoom(py, safe) {
    if (!this.tag || !this.tagAt) return;
    const top = py + this.tagAt.above - TAG_H;
    const below = top < safe + (this.below ? 12 : 2);   // 10 px apart, so it doesn't flicker at the line
    if (below === !!this.below) return;
    this.below = below;
    this.tag.classList.toggle('below', below);
    this.tag.style.top = `${below ? this.tagAt.below : this.tagAt.above}px`;
  }

  show(on) { this.marker.show(on); }
  remove() { this.marker.remove(); }
}

/**
 * The fleet for one scene: ambient vehicles for a service (one per block), simulated Link vans,
 * and "yours" (an engine option: your bus's block run, or your Link van).
 */
export class Fleet {
  constructor(stage) {
    this.stage = stage;
    this.ambient = new Map();
    this.vans = [];
    this.yours = null;
    this.scene = null;
    this.last = { t: null, bearing: null, zoom: null };
    stage.onMove(() => { this.moved = true; });
  }

  setScene({ service = null, yours = null, vans = true, still = false } = {}) {
    this.scene = { service, option: yours, vans, still };   // still: Preview my Ride (no bob, no exhaust)
    this.yourPosition = null;
    if (this.yours && (!yours || this.yours.cls !== yours.cls)) { this.yours.remove(); this.yours = null; }
    if (yours && !this.yours) this.yours = new VehicleMarker(this.stage, yours.cls, { yours: true });
    if (!vans) { for (const v of this.vans) v.remove(); this.vans = []; }
    this.last.t = null;
  }

  clear() {
    for (const m of this.ambient.values()) m.remove();
    for (const v of this.vans) v.remove();
    this.yours?.remove();
    this.ambient.clear(); this.vans = []; this.yours = null; this.scene = null;
  }

  /** Bring every vehicle to story minute t. `full` forces an update even if nothing changed. */
  update(t, { full = false } = {}) {
    if (!manifest || !this.scene) return;
    const bearing = this.stage.bearing(), zoom = this.stage.zoom();
    const changed = full || this.moved || t !== this.last.t;
    if (!changed) return;
    this.moved = false;
    this.last = { t, bearing, zoom };
    const { w, h } = this.stage.size(), M = 70;
    const onScreen = p => { const q = this.stage.project([p.lon, p.lat]); return q.x > -M && q.y > -M && q.x < w + M && q.y < h + M; };
    const s = this.scene;

    if (s.service) {
      const seen = new Set();
      const exclude = s.option?.kind === 'bus' ? [s.option.trip] : [];
      for (const v of vehiclesAt(s.service, t, { exclude })) {
        seen.add(v.block);
        let m = this.ambient.get(v.block);
        if (!m || m.cls !== v.cls) { m?.remove(); m = new VehicleMarker(this.stage, v.cls); this.ambient.set(v.block, m); }
        m.update(v, bearing, zoom);
        m.show(onScreen(v));
      }
      for (const [block, m] of this.ambient) if (!seen.has(block)) { m.remove(); this.ambient.delete(block); }
    } else if (this.ambient.size) {
      for (const m of this.ambient.values()) m.remove();
      this.ambient.clear();
    }

    if (s.vans) {
      VANS.forEach((cfg, i) => {
        if (s.option?.kind === 'link' && (cfg.path === s.option.path || cfg.path === s.option.approach)) { this.vans[i]?.show(false); return; }
        const p = vanAt(cfg, t);
        if (!this.vans[i]) this.vans[i] = new VehicleMarker(this.stage, 'van');
        this.vans[i].update(p, bearing, zoom);
        this.vans[i].show(onScreen(p));
      });
    }

    if (s.option && this.yours) {
      let p = vehicleAt(s.option, t);
      if (s.still) p = { ...p, moving: false, onRoad: false };
      this.yours.update(p, bearing, zoom);
      this.yours.show(true);
      this.yourPosition = p;
      this.yours.tagRoom(this.stage.project([p.lon, p.lat]).y, this.safeTop());
    }
  }

  /** The lowest edge of the top bar or the status pill, in map px: the tag stays below it. Read at most twice a second. */
  safeTop() {
    const now = performance.now();
    if (this.safe && now - this.safe.at < 500) return this.safe.y;
    const c = this.stage.container, box = c.getBoundingClientRect(), k = box.width / c.clientWidth || 1;
    let y = 0;
    for (const el of document.querySelectorAll('#topbar, .pill')) { const r = el.getBoundingClientRect(); if (r.height) y = Math.max(y, (r.bottom - box.top) / k); }
    this.safe = { at: now, y };
    return y;
  }
}

/** A simulated Link van: drives its path, waits 2 min, drives back, waits, repeats. */
function vanAt({ path, offset }, t) {
  const drive = DATA.paths[path].minutes, wait = 2, period = 2 * (drive + wait);
  let u = (((t + offset) % period) + period) % period;
  if (u < drive) return { ...pathAt(path, u / drive), moving: true };
  if ((u -= drive) < wait) return { ...pathAt(path, 1), moving: false };
  if ((u -= wait) < drive) { const p = pathAt(path, 1 - u / drive); return { ...p, heading: (p.heading + 180) % 360, moving: true }; }
  return { ...pathAt(path, 0), heading: (pathAt(path, 0).heading + 180) % 360, moving: false };
}

export const motionReduced = () => reducedMotion.matches;
