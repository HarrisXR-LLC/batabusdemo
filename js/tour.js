// Tutorial engine (plan 1·2 §7): the app dims except a spotlight on the target, a short white
// message with a soft halo sits on the dim, a white arrow points at the target, then OK.
// Placement rules come from the mockups (placeTip in mockups.html, rewritten):
//   above/below: message, then OK + Skip tips, as one stack on the far side of the arrow;
//   left/right:  the arrow runs level with the target, the message above that line, the buttons below;
//   clamp:       text and buttons slide to stay between the top bar and the footer; the arrow stays put;
//   no target:   the message sits centered with no arrow.
import { TIPS } from './steps.js';
import { state, emit, on } from './state.js';
import { clock } from './story.js';
import { esc, isolate, trapTab, firstFocusable } from './ui.js';

const PAD = 8;          // spotlight padding
const GAP = 10;         // gap at each end of the arrow
const EDGE = 18;        // distance kept from the screen edges
const ARROW_V = 66;     // arrow length, up/down
const ARROW_H = 54;     // arrow length, left/right
const STACK_GAP = 14;   // message → buttons (above/below)
const MSG_MAX = 310;    // message width, above/below
const SIDE_MIN = 170;   // narrowest message beside a target
const LINE_UP = 16, LINE_DOWN = 18;  // left/right: message bottom and buttons top, from the arrow line
const FADE = 150;
const ROT = { above: 0, below: 180, left: -90, right: 90 };   // the arrow SVG points down at 0°

let open = null;        // the tip on screen: { tip, target, els, resolve, cleanup[] }
let ticket = 0;

const wait = ms => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const tour = {
  /** Show a step's registered tips, in order. Resolves when they are all closed (or skipped). */
  async run(stepId, { onShown } = {}) {
    const tips = TIPS[stepId];
    if (!tips?.length || !state.tour.enabled || state.tour.seen.has(stepId)) return;
    state.tour.seen.add(stepId);
    for (const tip of tips) {
      if (!state.tour.enabled) break;
      if (await show(tip, onShown) === 'cancel') break;
    }
  },
  show: (tip, onShown) => show(tip, onShown),
  /** Close any tip without moving focus (the router is leaving the step). */
  cancel() { ticket++; close('cancel', false); },
  get active() { return !!open; },
};

// ---------- show / close ----------

async function show(tip, onShown) {
  close('cancel', false);
  const mine = ++ticket;
  if (tip.ready) await Promise.race([tip.ready(), wait(1500)]);   // map-targeted tips wait for the map (1·4)
  if (state.ui.sheetMoving) await new Promise(r => { const off = on('sheet-settled', () => { off(); r(); }); setTimeout(() => { off(); r(); }, 600); });
  await frame();
  if (mine !== ticket) return 'cancel';

  const layer = document.getElementById('tour-layer');
  const lastFocus = document.activeElement;
  layer.innerHTML = `<div class="tour-dim"></div><div class="tour-hole"></div>
    <div class="tour-arrow" aria-hidden="true"><svg></svg></div>
    <div class="tour-dialog" role="dialog" aria-modal="true" aria-label="Tip" aria-describedby="tour-msg">
      <p class="tour-msg" id="tour-msg">${esc(tip.text)}</p>
      <div class="tour-acts"><button type="button" class="tour-ok">OK</button><button type="button" class="tour-skip">Skip tips</button></div>
    </div>`;
  const els = {
    layer, dim: layer.querySelector('.tour-dim'), hole: layer.querySelector('.tour-hole'), arrow: layer.querySelector('.tour-arrow'),
    dialog: layer.querySelector('.tour-dialog'), msg: layer.querySelector('.tour-msg'), acts: layer.querySelector('.tour-acts'),
    ok: layer.querySelector('.tour-ok'), skip: layer.querySelector('.tour-skip'),
  };
  const target = typeof tip.target === 'string' ? document.querySelector(tip.target) : tip.target || null;

  return new Promise(resolve => {
    open = { tip, target, els, resolve, lastFocus, cleanup: [] };
    clock.hold();
    state.tour.showing = true;
    layer.classList.remove('leaving');
    layer.classList.add('on');
    open.cleanup.push(isolate(layer));

    // A tap on the dim does nothing, and doesn't take focus away from the tip.
    layer.onmousedown = e => { if (!e.target.closest('button')) e.preventDefault(); };
    els.ok.addEventListener('click', () => close('ok'));
    els.skip.addEventListener('click', () => { state.tour.enabled = false; close('skip'); });
    els.dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close('ok'); } else trapTab(els.dialog, e);
    });

    reveal(target);
    place();
    // Re-place on anything that can move the target: window size, the screen or target resizing, sheet detents.
    const again = () => requestAnimationFrame(place);
    addEventListener('resize', again);
    open.cleanup.push(() => removeEventListener('resize', again));
    const ro = new ResizeObserver(again);
    ro.observe(layer);
    if (target) ro.observe(target);
    open.cleanup.push(() => ro.disconnect());
    open.cleanup.push(on('sheet', again), on('sheet-settled', again));
    document.fonts.ready.then(again);
    // A target on the map (the walker, a stop) moves when the camera does: follow it while the tip is up.
    if (target?.closest('#map-layer')) {
      let last = '', raf = 0;
      const follow = () => {
        const r = target.getBoundingClientRect(), key = `${Math.round(r.left)},${Math.round(r.top)}`;
        if (key !== last) { last = key; place(); }
        raf = requestAnimationFrame(follow);
      };
      raf = requestAnimationFrame(follow);
      open.cleanup.push(() => cancelAnimationFrame(raf));
    }

    els.ok.focus({ preventScroll: true });
    emit('tour', true);
    onShown?.();
  });
}

function close(result, moveFocus = true) {
  if (!open) return;
  const { target, els, resolve, lastFocus, cleanup } = open;
  open = null;
  for (const fn of cleanup) fn();
  clock.release();
  state.tour.showing = false;
  const layer = els.layer;
  layer.classList.remove('on');
  layer.classList.add('leaving');
  setTimeout(() => { if (!open && layer.classList.contains('leaving')) { layer.classList.remove('leaving'); layer.innerHTML = ''; } }, FADE);
  if (moveFocus) {
    const to = (target?.isConnected && firstFocusable(target)) || (lastFocus?.isConnected && lastFocus) || null;
    to?.focus({ preventScroll: true });
  }
  emit('tour', false);
  resolve(result);
}

// ---------- placement ----------

/** If the target is cut off inside its sheet, scroll the sheet (never the page) to center it. */
function reveal(target) {
  const box = target?.closest('.sheet-body, [data-scroll]');
  if (!box) return;
  const t = target.getBoundingClientRect(), b = box.getBoundingClientRect(), k = b.height / box.clientHeight || 1;
  const margin = (PAD + 8) * k;
  if (t.top >= b.top + margin && t.bottom <= b.bottom - margin) return;
  box.scrollTop += (t.top + t.height / 2 - (b.top + b.height / 2)) / k;
}

const px = v => `${Math.round(v * 10) / 10}px`;
const put = (el, x, y) => { el.style.left = px(x); el.style.top = px(y); };

function place() {
  if (!open) return;
  const { tip, target, els } = open;
  const { layer, dim, hole, arrow, msg, acts } = els;
  const L = layer.getBoundingClientRect();
  const k = L.width / layer.offsetWidth || 1;              // framed mode scales the whole device
  const W = layer.offsetWidth, H = layer.offsetHeight;
  const local = r => ({ l: (r.left - L.left) / k, t: (r.top - L.top) / k, w: r.width / k, h: r.height / k });
  const bar = document.getElementById('topbar');
  const top0 = bar ? local(bar.getBoundingClientRect()).t + local(bar.getBoundingClientRect()).h + 8 : 12;
  const bot0 = H - 12;

  msg.style.maxWidth = ''; msg.style.textAlign = '';
  let r = target?.isConnected ? local(target.getBoundingClientRect()) : null;
  const visible = r && r.w > 0 && r.h > 0 && r.t + r.h > 0 && r.t < H && r.l + r.w > 0 && r.l < W;

  if (!visible) {   // centered, no arrow, full dim
    layer.dataset.side = 'none';
    dim.hidden = false; hole.hidden = true; arrow.hidden = true;
    msg.style.maxWidth = px(Math.min(MSG_MAX, W - EDGE * 2)); msg.style.textAlign = 'center';
    const mw = msg.offsetWidth, mh = msg.offsetHeight, aw = acts.offsetWidth, ah = acts.offsetHeight;
    const y = clamp((top0 + bot0) / 2 - (mh + STACK_GAP + ah) / 2, top0, bot0 - mh - STACK_GAP - ah);
    put(msg, (W - mw) / 2, y); put(acts, (W - aw) / 2, y + mh + STACK_GAP);
    return;
  }

  dim.hidden = true; hole.hidden = false; arrow.hidden = false;
  const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 12;
  const h = { l: r.l - PAD, t: r.t - PAD, w: r.w + PAD * 2, h: r.h + PAD * 2 };
  Object.assign(hole.style, { left: px(h.l), top: px(h.t), width: px(h.w), height: px(h.h), borderRadius: px(Math.min(radius + PAD, h.h / 2)) });
  const cx = h.l + h.w / 2, cy = h.t + h.h / 2;

  // Measure the above/below stack to decide the side.
  msg.style.maxWidth = px(Math.min(MSG_MAX, W - EDGE * 2)); msg.style.textAlign = 'center';
  let mw = msg.offsetWidth, mh = msg.offsetHeight;
  const aw = acts.offsetWidth, ah = acts.offsetHeight;
  const stack = mh + STACK_GAP + ah;
  const need = GAP + ARROW_V + GAP + stack;
  const roomAbove = h.t - top0, roomBelow = bot0 - (h.t + h.h);
  let side = tip.side;
  if (!side) {
    const fitA = roomAbove >= need, fitB = roomBelow >= need;
    if (fitA || fitB) side = fitA && fitB ? (roomAbove >= roomBelow ? 'above' : 'below') : fitA ? 'above' : 'below';
    else {
      const roomL = h.l - GAP - EDGE, roomR = W - (h.l + h.w) - GAP - EDGE;
      side = Math.max(roomL, roomR) >= SIDE_MIN ? (roomL >= roomR ? 'left' : 'right') : roomAbove >= roomBelow ? 'above' : 'below';
    }
  }
  layer.dataset.side = side;

  if (side === 'above' || side === 'below') {
    const x = w => clamp(cx - w / 2, EDGE, W - EDGE - w);
    const arrowTop = side === 'above' ? h.t - GAP - ARROW_V : h.t + h.h + GAP;
    const y = clamp(side === 'above' ? arrowTop - GAP - stack : arrowTop + ARROW_V + GAP, top0, bot0 - stack);
    put(msg, x(mw), y); put(acts, x(aw), y + mh + STACK_GAP);
    drawArrow(arrow, ARROW_V, cx, arrowTop + ARROW_V / 2, ROT[side]);
    return;
  }

  // left / right: the message above the arrow line, the buttons below it, both aligned to the arrow's end.
  // Near the top or bottom edge, both slide to the side of the line that has room (the arrow stays put).
  const edge = side === 'left' ? h.l - GAP : h.l + h.w + GAP;
  const room = side === 'left' ? edge - EDGE : W - EDGE - edge;
  msg.style.maxWidth = px(Math.max(SIDE_MIN, room));
  msg.style.textAlign = side === 'left' ? 'right' : 'left';
  mw = msg.offsetWidth; mh = msg.offsetHeight;
  let msgTop, actsTop;
  if (bot0 - cy < LINE_DOWN + ah) {            // no room below the line: message, then buttons, above it
    actsTop = cy - LINE_UP - ah;
    msgTop = Math.max(top0, actsTop - STACK_GAP - mh);
  } else if (cy - top0 < LINE_UP + mh) {       // no room above the line: both below it
    msgTop = Math.max(top0, cy + LINE_DOWN);
    actsTop = Math.min(bot0 - ah, msgTop + mh + STACK_GAP);
  } else {
    msgTop = cy - LINE_UP - mh;
    actsTop = cy + LINE_DOWN;
  }
  const x = w => (side === 'left' ? Math.max(EDGE, edge - w) : Math.min(edge, W - EDGE - w));
  put(msg, x(mw), msgTop); put(acts, x(aw), actsTop);
  drawArrow(arrow, ARROW_H, side === 'left' ? edge - ARROW_H / 2 : edge + ARROW_H / 2, cy, ROT[side]);
}

/** A straight shaft with a rounded cap and an open chevron head, centered on (x, y), rotated. */
function drawArrow(el, len, x, y, rot) {
  const svg = el.firstElementChild;
  if (svg.dataset.len !== String(len)) {
    svg.dataset.len = len;
    svg.setAttribute('viewBox', `0 0 24 ${len}`);
    svg.innerHTML = `<path d="M12 3V${len - 6}"/><path d="M4.5 ${len - 14.5}L12 ${len - 5}l7.5-9.5"/>`;
  }
  el.style.height = px(len);
  el.style.left = px(x - 12);
  el.style.top = px(y - len / 2);
  el.style.transform = `rotate(${rot}deg)`;
}
