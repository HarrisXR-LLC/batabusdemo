// Preview my Ride (plan 2·3 §5), on every trip, before and after booking: a calm, step-by-step look at
// what will happen. The key moments come from the same engine option as the timeline and the live trip,
// so all three always agree. The map shows only your vehicle and your path at that moment.
//   - A scrubber with a dot per moment: drag (snaps on release), tap a dot, Back / Next (2.5.7), or the keys
//     ← → Home End on the slider. role="slider" with aria-valuetext; each change is announced politely.
//   - Trip 3 has its own step (t3.preview). Elsewhere it opens over the current screen and Done brings it back.
import { DATA, stopLabel } from './data.js';
import { clock, formatTime, formatShort, formatDate } from './story.js';
import { router } from './router.js';
import { scenePreview } from './scene.js';
import * as ui from './ui.js';

const SIDE = { full: 'Look for this bus', medium: 'Look for this bus', van: 'Look for this van' };
const stopLL = id => [DATA.stops[id].lon, DATA.stops[id].lat];
const place = name => DATA.places[name];

/**
 * The key moments of one leg. dest: { from, to: place names, toLabel, fromLabel ('home'), end?: { title, where } }
 * Each moment: { t, label (under its dot), time, title, where, side (a vehicle class to show), focus: [[lon, lat]…], zoom }
 */
export function moments(o, dest) {
  const m = [];
  const add = (t, title, where = '', extra = {}) => m.push({ t, label: formatShort(t), time: formatTime(t), title, where, ...extra });
  if (o.kind === 'link') {
    const path = DATA.paths[o.path].coords;
    add(o.here, 'Link picks you up at your door', 'Wait at your front door', { side: 'van', focus: [place(dest.from)], zoom: 17 });
    add(Math.round((o.pickupEnd + o.rideArrive) / 2), 'On your way', 'Door to door, no stops to watch', { focus: path });
    add(o.arrive, `Drop-off at ${dest.toLabel}`, '', { focus: [path.at(-1), place(dest.to)], zoom: 16.5 });
  } else {
    const atStop = o.leaveBy + o.walkMin, board = stopLabel(o.board);
    add(o.leaveBy, `Leave ${dest.fromLabel || 'home'}`, `Walk ${o.walkMin} min to ${board}`, { focus: [place(dest.from), stopLL(o.board)] });
    if (o.here <= atStop) add(atStop, `At ${board}`, `Your bus is waiting · leaves ${formatTime(o.depart)}`, { side: o.cls, focus: [stopLL(o.board)], zoom: 17.5 });
    else {
      add(atStop, `At ${board}`, 'Wait at the stop', { focus: [stopLL(o.board)], zoom: 17.5 });
      add(o.here, o.here < o.depart ? 'Your bus arrives' : `Board ${o.name}`, o.here < o.depart ? `It waits here until ${formatTime(o.depart)}` : 'Show your pass', { side: o.cls, focus: [stopLL(o.board)], zoom: 17 });
    }
    if (o.depart > Math.max(atStop, o.here) + 0.01) add(o.depart, 'Your bus leaves', `${o.name} to ${stopLabel(o.alight)}`, { focus: [stopLL(o.board), stopLL(o.alight)] });
    add(o.rideArrive, `Get off at ${stopLabel(o.alight)}`, '', { focus: [stopLL(o.alight), place(dest.to)], zoom: 17 });
    add(o.arrive, dest.toLabel, dest.arriveNote || '', { focus: [stopLL(o.alight), place(dest.to)], zoom: 17 });
  }
  if (dest.end) m.push({ t: o.arrive, label: '✓', time: '✓', title: dest.end.title, where: dest.end.where || '', focus: m.at(-1).focus, zoom: m.at(-1).zoom, end: true });
  return m;
}

/**
 * Show a preview in the sheet. spec: { date, legs: [{ id, label, leg (engine leg), option, moments }], selected?,
 * asStep?, sheet, body, onDone? }. Returns a cleanup function.
 */
export function openPreview(spec) {
  const { body, sheet } = spec;
  const overlay = !spec.asStep;
  let leg = spec.legs.find(l => l.id === spec.selected) || spec.legs[0], i = 0;
  const before = overlay ? { detent: sheet.get(), scroll: body.scrollTop } : null;
  if (overlay) { for (const el of body.children) el.dataset.pvHidden = el.hidden ? 'keep' : '1', el.hidden = true; clock.hold(); }
  else body.innerHTML = '';          // as its own step (t3.preview) it replaces the previous screen
  const root = document.createElement('div');
  root.className = 'pv';
  root.innerHTML = `<div class="pv-head"><h1 tabindex="-1" data-step-heading>Preview · ${ui.esc(formatDate(spec.date))}</h1>${ui.button({ label: 'Done', kind: 'text', attrs: 'data-done' })}</div>
    ${spec.legs.length > 1 ? ui.segmented({ items: spec.legs.map(l => ({ id: l.id, label: l.label })), selected: leg.id, label: 'Leg' }) : ''}
    <div class="pv-step" aria-live="off"><div class="pv-text"><p class="pv-time tab"></p><p class="pv-title"></p><p class="muted pv-where"></p></div>
      <figure class="pv-side" hidden><img alt=""><figcaption class="muted"></figcaption></figure></div>
    <div class="scrub">${ui.roundButton({ icon: 'left', label: 'Back', attrs: 'data-prev' })}<div class="track"></div>${ui.roundButton({ icon: 'right', label: 'Next', attrs: 'data-next' })}</div>`;
  body.append(root);
  sheet.set('half');
  body.scrollTop = 0;
  const $ = s => root.querySelector(s);
  const track = $('.track');
  const pct = (k, n) => (n < 2 ? 50 : 6 + k * 88 / (n - 1));

  function drawTrack() {
    const n = leg.moments.length;
    // each dot's tap target fills the space to its neighbors, up to 48px (Back/Next and the keys reach every moment too)
    const gap = n > 1 ? (track.clientWidth || 240) * 0.88 / (n - 1) : 48;
    track.style.setProperty('--dot-w', `${Math.floor(Math.min(48, gap - 1))}px`);
    track.innerHTML = `<div class="bar"></div>${leg.moments.map((m, k) => `<button type="button" class="dotp" data-k="${k}" tabindex="-1" style="left:${pct(k, n)}%" aria-label="${ui.esc(`${m.time}, ${m.title}`)}"></button>
      <span class="tlab tab" style="left:${pct(k, n)}%" aria-hidden="true">${ui.esc(m.label)}</span>`).join('')}
      <div class="thumb" role="slider" tabindex="0" aria-label="Trip step" aria-valuemin="1" aria-valuemax="${n}"></div>`;
  }

  function show(k, { announce = true, ease = true } = {}) {
    const n = leg.moments.length;
    i = Math.max(0, Math.min(n - 1, k));
    const m = leg.moments[i], thumb = track.querySelector('.thumb');
    $('.pv-time').textContent = m.time === '✓' ? '' : m.time;
    $('.pv-time').hidden = m.time === '✓';
    $('.pv-title').textContent = m.title;
    $('.pv-where').textContent = m.where;
    const fig = $('.pv-side');
    fig.hidden = !m.side;
    if (m.side) { fig.querySelector('img').src = `./assets/sprites/${m.side}-side.svg`; fig.querySelector('figcaption').textContent = SIDE[m.side]; }
    thumb.style.left = `${pct(i, n)}%`;
    thumb.setAttribute('aria-valuenow', i + 1);
    thumb.setAttribute('aria-valuetext', `${m.time === '✓' ? '' : `${m.time}, `}${m.title}`);
    for (const d of track.querySelectorAll('.dotp')) d.classList.toggle('on', +d.dataset.k <= i);
    $('[data-prev]').disabled = i === 0;
    $('[data-next]').disabled = i === n - 1;
    if (announce) ui.announce(`${m.time === '✓' ? '' : `${m.time}, `}${m.title}`);
    scenePreview({ leg: leg.leg, option: leg.option, t: m.t, focus: m.focus, zoom: m.zoom, ease });
  }

  // drag the thumb (or press on the track); on release it snaps to the nearest moment
  let drag = null;
  track.addEventListener('pointerdown', e => {
    if (e.target.closest('.dotp')) return;
    const r = track.getBoundingClientRect();
    drag = { r };
    track.setPointerCapture(e.pointerId);
    move(e);
  });
  const xToK = (x, r) => { const n = leg.moments.length, p = ((x - r.left) / r.width) * 100; return Math.round(((p - 6) / 88) * (n - 1)); };
  const move = e => {
    if (!drag) return;
    const r = drag.r, p = Math.max(6, Math.min(94, ((e.clientX - r.left) / r.width) * 100));
    track.querySelector('.thumb').style.left = `${p}%`;
  };
  track.addEventListener('pointermove', move);
  const end = e => { if (!drag) return; const k = xToK(e.clientX, drag.r); drag = null; show(k); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', () => { drag = null; show(i, { announce: false }); });
  track.addEventListener('click', e => { const d = e.target.closest('.dotp'); if (d) show(+d.dataset.k); });
  track.addEventListener('keydown', e => {
    if (!e.target.matches('.thumb')) return;
    const n = leg.moments.length, to = { ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1, Home: 0, End: n - 1 }[e.key];
    if (to == null) return;
    e.preventDefault();
    show(to);
  });
  $('[data-prev]').addEventListener('click', () => show(i - 1));
  $('[data-next]').addEventListener('click', () => show(i + 1));
  const seg = root.querySelector('.seg');
  if (seg) ui.radioGroup(seg, id => { leg = spec.legs.find(l => l.id === id); drawTrack(); show(0); });

  function close() {
    scenePreview(null);
    root.remove();
    if (overlay) {
      clock.release();
      for (const el of body.children) { el.hidden = el.dataset.pvHidden === 'keep'; delete el.dataset.pvHidden; }
      sheet.set(before.detent);
      // Draw the screen again (focus, live parts, the map scene) exactly where the story is.
      const cur = router.current;
      if (cur) router.go(cur.id, { history: 'none', clockAt: null, keepClock: true });
    }
    spec.onDone?.();
  }
  $('[data-done]').addEventListener('click', e => { e.preventDefault(); close(); });

  drawTrack();
  show(0, { announce: false, ease: false });
  if (overlay) $('[data-step-heading]').focus({ preventScroll: true });
  return () => { if (root.isConnected) { scenePreview(null); root.remove(); if (overlay) clock.release(); } };
}
