// Simplified map (plan 1·4 §8): used when the street map can't load. An SVG drawn from BATA's own
// route shapes (as a quiet street network) and the story lines, with the same stage backend calls as
// the MapLibre map, so the sprites, walker, simulation and framing all keep working.
// Web Mercator, north up, no pitch. The camera is a transform; markers are positioned over the SVG.
import { DATA } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const TILE = 256;
const world = ([lon, lat]) => {
  const s = Math.sin(lat * Math.PI / 180);
  return [(lon + 180) / 360 * TILE, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE];
};
const ease = t => 1 - Math.pow(1 - t, 3);
// Paths are drawn relative to Traverse City at zoom-15 pixels, so the numbers stay small and precise.
const Z0 = 15, ORIGIN = world([-85.62, 44.75]);
const local = ll => { const [x, y] = world(ll); return [(x - ORIGIN[0]) * 2 ** Z0, (y - ORIGIN[1]) * 2 ** Z0]; };

export class SvgBackend {
  constructor(container, palette) {
    this.el = container;
    this.p = palette;
    this.cam = { x: 0, y: 0, z: 13.2, ox: 0, oy: 0 };
    [this.cam.x, this.cam.y] = world([-85.635, 44.752]);
    this.listeners = new Set();
    this.roots = new Map();
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'fallback-map');
    this.svg.innerHTML = `<rect class="fb-land" width="100%" height="100%" fill="${palette.land}"/><g class="fb-world">
      <g class="fb-base"></g><g data-kind="route"></g><g data-kind="ride"></g><g data-kind="link"></g><g data-kind="walk"></g></g>`;
    this.worldG = this.svg.querySelector('.fb-world');
    this.layer = document.createElement('div');
    this.layer.className = 'fallback-markers';
    container.append(this.svg, this.layer);
    this.drawBase();
    new ResizeObserver(() => this.render()).observe(container);
    this.render();
  }

  drawBase() {
    // Every bus route as a street (white with a gray casing): enough to read the town without tiles.
    const d = Object.values(DATA.shapes).map(s => this.pathD(s.map(p => [p[0], p[1]]))).join('');
    this.svg.querySelector('.fb-base').innerHTML =
      `<path d="${d}" fill="none" stroke="${this.p.casing}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
      `<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  }

  pathD(coords) {
    return coords.map((c, i) => { const [x, y] = local(c); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('');
  }

  setLines(kind, lists) {
    const g = this.svg.querySelector(`[data-kind="${kind}"]`), d = lists.map(l => this.pathD(l)).join('');
    const p = this.p, ns = 'vector-effect="non-scaling-stroke" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    g.innerHTML = !d ? '' : {
      route: `<path d="${d}" stroke="${p.blue}" stroke-opacity=".3" stroke-width="4" ${ns}/>`,
      ride: `<path d="${d}" stroke="#fff" stroke-width="10" ${ns}/><path d="${d}" stroke="${p.blue}" stroke-width="6" ${ns}/>`,
      link: `<path d="${d}" stroke="#fff" stroke-width="9" ${ns}/><path d="${d}" stroke="${p.green}" stroke-width="5" ${ns}/>`,
      walk: `<path d="${d}" stroke="${p.ink}" stroke-opacity=".7" stroke-width="4" stroke-dasharray="8 6" vector-effect="non-scaling-stroke" fill="none"/>`,
    }[kind];
  }

  addMarker(root) {
    const entry = { root, ll: null };
    this.layer.append(root);
    this.roots.set(root, entry);
    return {
      set: ll => { entry.ll = ll; this.place(entry); },
      remove: () => { root.remove(); this.roots.delete(root); },
    };
  }

  place(entry) {
    if (!entry.ll) return;
    const { x, y } = this.project(entry.ll);
    entry.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  scale() { return Math.pow(2, this.cam.z); }
  project(ll) {
    const [x, y] = world(ll), s = this.scale(), w = this.el.clientWidth, h = this.el.clientHeight;
    return { x: (x - this.cam.x) * s + w / 2 + this.cam.ox, y: (y - this.cam.y) * s + h / 2 + this.cam.oy };
  }

  render() {
    const s = this.scale(), w = this.el.clientWidth, h = this.el.clientHeight;
    const k = s / 2 ** Z0;   // zoom-15 pixels → screen pixels
    this.worldG.setAttribute('transform', `translate(${(w / 2 + this.cam.ox - (this.cam.x - ORIGIN[0]) * s).toFixed(2)} ${(h / 2 + this.cam.oy - (this.cam.y - ORIGIN[1]) * s).toFixed(2)}) scale(${k.toFixed(6)})`);
    for (const e of this.roots.values()) this.place(e);
    for (const fn of this.listeners) fn();
  }

  animate(to, duration) {
    cancelAnimationFrame(this.raf);
    if (!duration) { Object.assign(this.cam, to); this.render(); return; }
    const from = { ...this.cam }, t0 = performance.now();
    const step = now => {
      const k = ease(Math.min(1, (now - t0) / duration));
      for (const key of Object.keys(to)) this.cam[key] = from[key] + (to[key] - from[key]) * k;
      this.render();
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  fit(points, { padding, maxZoom, duration }) {
    const xy = points.map(world), xs = xy.map(p => p[0]), ys = xy.map(p => p[1]);
    const w = this.el.clientWidth, h = this.el.clientHeight;
    const bw = Math.max(1e-9, Math.max(...xs) - Math.min(...xs)), bh = Math.max(1e-9, Math.max(...ys) - Math.min(...ys));
    const z = Math.min(maxZoom, Math.log2(Math.min((w - padding.left - padding.right) / bw, (h - padding.top - padding.bottom) / bh)));
    this.animate({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, z,
      ox: (padding.left - padding.right) / 2, oy: (padding.top - padding.bottom) / 2 }, duration);
  }

  follow(center, { zoom, padding, duration }) {
    const [x, y] = world(center);
    this.animate({ x, y, z: zoom ?? this.cam.z, ox: (padding.left - padding.right) / 2, oy: (padding.top - padding.bottom) / 2 }, duration);
  }

  onMove(fn) { this.listeners.add(fn); }
  bearing() { return 0; }
  pitch() { return 0; }
  zoom() { return this.cam.z; }
  idle() { return Promise.resolve(); }
  camera() {
    const s = this.cam, lon = s.x / TILE * 360 - 180, n = Math.PI - 2 * Math.PI * s.y / TILE;
    return { center: [lon, 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))], zoom: s.z, pitch: 0, bearing: 0 };
  }
}
