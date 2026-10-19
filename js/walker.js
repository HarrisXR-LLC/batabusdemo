// The walker and "you are here" (plan 1·4 §7): a stick-figure silhouette (one still frame) that slides
// along the dashed walking path, with a fading view triangle pointing the way you face. At rest it gets
// a soft ring pulse. Ink strokes over a white underlay, so it stands out on any map. 26 × 32 px, feet on
// the coordinate. Screen readers don't hear it: the sheet text says where you walk.
const S25 = Math.sin(25 * Math.PI / 180), C25 = Math.cos(25 * Math.PI / 180);
const FIGURE = 'M13.5 9.5l-1.3 9M12.2 18.5l-4.4 8.8M12.2 18.5l4.2 5 1 4.6M13.2 11.5l-4.6 4.2M13.2 11.5l4.6 2.6';

export class Walker {
  constructor(stage) {
    this.el = document.createElement('div');
    this.el.className = 'walker';
    this.el.innerHTML = `<div class="walker-ring"></div>
      <svg class="walker-cone" viewBox="-70 -70 140 140" aria-hidden="true"><defs>
        <linearGradient id="walker-cone-fade" x1="0" y1="0" x2="0" y2="-1" gradientUnits="objectBoundingBox">
          <stop offset="0" style="stop-color:var(--bata-blue);stop-opacity:.5"/><stop offset="1" style="stop-color:var(--bata-blue);stop-opacity:0"/></linearGradient></defs>
        <path d="M0 0L${(-60 * S25).toFixed(2)} ${(-60 * C25).toFixed(2)}A60 60 0 0 1 ${(60 * S25).toFixed(2)} ${(-60 * C25).toFixed(2)}Z" fill="url(#walker-cone-fade)"/></svg>
      <svg class="walker-fig" viewBox="0 0 26 32" aria-hidden="true">
        <g stroke="#fff" stroke-width="5.6" stroke-linecap="round" fill="none"><circle cx="14" cy="5" r="3.2" fill="#fff"/><path d="${FIGURE}"/></g>
        <g style="stroke:var(--g900)" stroke-width="2.8" stroke-linecap="round" fill="none"><circle cx="14" cy="5" r="3.2" style="fill:var(--g900)"/><path d="${FIGURE}"/></g></svg>`;
    this.cone = this.el.querySelector('.walker-cone');
    this.fig = this.el.querySelector('.walker-fig');
    this.marker = stage.marker(this.el, { z: 20 });
    this.stage = stage;
    this.marker.show(false);
  }

  /** Place the walker: at [lon, lat], facing `heading` (map degrees); moving hides the rest ring. */
  set({ at, heading = 90, moving = false }) {
    this.marker.set(at);
    this.marker.show(true);
    const r = (((heading - this.stage.bearing()) % 360) + 360) % 360;
    this.cone.style.transform = `rotate(${r.toFixed(1)}deg)`;
    this.fig.classList.toggle('west', r > 180);
    this.el.classList.toggle('moving', moving);
    this.heading = heading;
  }

  hide() { this.marker.show(false); }
  remove() { this.marker.remove(); }
}
