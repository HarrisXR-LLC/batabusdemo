// Shared trip-screen builders (2·1, reused in 2·2 and 2·3): the step header, screen registration,
// option cards, the trip timeline's items, and the five live ride screens every trip plays
// (Where's my ride → walk → at the stop → the pass → on board).
import { registerStep } from '../router.js';
import { state, on } from '../state.js';
import { formatTime } from '../story.js';
import { stopLabel } from '../data.js';
import * as ui from '../ui.js';
import * as ride from '../ride.js';
import { openPreview } from '../preview.js';

/** The quiet "Preview my Ride" text button (plan 2·3 §5.1) and its wiring. */
export const previewButton = () => ui.button({ label: 'Preview my Ride', kind: 'text', icon: 'play', attrs: 'data-preview' });
export function wirePreview(ctx, spec) {
  ctx.body.querySelector('[data-preview]')?.addEventListener('click', e => { e.preventDefault(); openPreview({ ...spec(), sheet: ctx.sheet, body: ctx.body }); });
}

export const stopName = stopLabel;

/** The usual step header: optional round Back, eyebrow, the focusable heading (visually hidden if srOnly). */
export function head(ctx, title, { eyebrow = '', srOnly = false } = {}) {
  return `<div class="step-head${srOnly ? ' sr-only' : ''}">
    ${ctx.canGoBack && !srOnly ? ui.roundButton({ icon: 'left', label: 'Back', attrs: 'data-back' }) : ''}
    <div class="grow">${eyebrow ? `<p class="eyebrow">${ui.esc(eyebrow)}</p>` : ''}<h1 tabindex="-1" data-step-heading>${ui.esc(title)}</h1></div>
  </div>`;
}

/** Register a screen; it sets the sheet height first. render returns an optional cleanup. */
export function screen(id, { detent = 'half', render, complete }) {
  registerStep(id, { render: ctx => { ctx.sheet.set(detent); return render(ctx); }, complete });
}

/** Run fn once when the story clock reaches minute t (deferred, never mid-render). Returns a cleanup function. */
export function onClockAt(t, fn) {
  let done = false;
  const check = now => { if (!done && now >= t - 1e-6) { done = true; setTimeout(fn, 0); } };
  const off = on('clock', check);
  check(state.story.clock);
  return () => { done = true; off(); };
}

export function optionCards(opts, selectedId, { label = 'Ways to get there', linkRoom = false } = {}) {
  return ui.optionList(opts.map(o => ui.optionCard({
    id: o.id, times: o.times, price: o.fare, name: o.name, recommended: o.recommended, selected: o.id === selectedId,
    walkMin: o.kind === 'bus' ? o.walkMin : null, route: o.kind === 'bus' ? o.routeShort : null,
    room: o.late || (o.kind === 'link' && !linkRoom) ? null : o.room,
    extra: o.kind === 'link' ? `<span class="opt-extra">${ui.icon('van', 'i s')}Door to door</span>` : '',
    late: o.late, note: o.note,
  })), label);
}

/**
 * A leg's timeline items: leave → board → get off → arrive (bus), or pickup → arrive (Link).
 * `text` is the collapsed "Next: …" line; `list` (if given) is the shorter line in the expanded list.
 * t is the story time on the trip's own date (−Infinity before the travel day): done items are ticked.
 */
export function legItems(o, { leave = 'Leave by', from = 'home', toText, toIcon = 'pin' }, t = -Infinity) {
  const items = o.kind === 'bus' ? [
    { at: o.leaveBy + o.walkMin, icon: 'walk', time: formatTime(o.leaveBy), text: `${leave} ${formatTime(o.leaveBy)}`, list: `Leave ${from} · walk ${o.walkMin} min`, sub: `Walk ${o.walkMin} min to ${stopName(o.board)}` },
    { at: Math.max(o.depart, o.here + 0.5), icon: 'bus', time: formatTime(o.depart), text: `${o.name} at ${stopName(o.board)}`, sub: `Leaves ${formatTime(o.depart)}` },
    { at: o.rideArrive, icon: 'stop', time: formatTime(o.rideArrive), text: `Get off at ${stopName(o.alight)}` },
    { at: o.arrive, icon: toIcon, time: formatTime(o.arrive), text: toText },
  ] : [
    { at: o.pickupEnd, icon: 'van', time: formatTime(o.here), text: `Link pickup ${formatTime(o.here)}`, list: 'Link at your door', sub: 'Wait at your front door' },
    { at: o.arrive, icon: toIcon, time: formatTime(o.arrive), text: toText },
  ];
  let now = false;
  return items.map(it => {
    const done = t >= it.at - 1e-6;
    const state = done ? 'done' : now ? 'todo' : 'now';
    if (!done) now = true;
    return { time: it.time, icon: it.icon, text: it.text, list: it.list, sub: it.sub, state };
  });
}

/**
 * The five live ride screens for one leg. cfg:
 *   ids       { ride, walk, stop, board, onboard } (any may be left out)
 *   option    () => the engine option you booked
 *   timeline  () => { legs, selected } for ui.tripTimeline (Where's my ride)
 *   fareText  option => "Paid · $1.50" | "Free"
 *   code, date () => the booking code and the travel date; passRoom: show the room badge on the pass
 *   labels    the main buttons' labels can be overridden: { ride: 'Start walking' }
 *   preview   () => a Preview my Ride spec (preview.js); shows the quiet "Preview my Ride" button
 * A Link leg uses { stop, board, onboard }: the van comes to your door, so there's no walk.
 */
export function rideSteps(cfg) {
  const { ids, option } = cfg;
  const where = o => `${o.name} · ${o.kind === 'bus' ? stopName(o.board) : 'Your door'}`;

  if (ids.ride) screen(ids.ride, {
    detent: 'half',
    render: ctx => {
      const o = option(), tl = cfg.timeline();
      ctx.body.innerHTML = `${head(ctx, 'Where’s my ride', { srOnly: true })}${ride.rideCard(o)}
        ${ui.tripTimeline(tl)}
        <div class="actions">${ui.button({ label: cfg.labels?.ride || 'Start walking', attrs: 'data-primary' })}${cfg.preview ? previewButton() : ''}</div>`;
      if (cfg.preview) wirePreview(ctx, cfg.preview);
      const offTl = ui.wireTripTimeline(ctx.body.querySelector('.trip-tl'));
      const offLive = ride.liveRide(ctx.body, o, { where: where(o) });
      return () => { offTl(); offLive(); };
    },
  });

  if (ids.walk) screen(ids.walk, {
    detent: 'peek',
    render: ctx => {
      const o = option();
      ctx.body.innerHTML = `${head(ctx, 'Walk to your stop', { srOnly: true })}${ride.rideCard(o)}
        <div class="actions">${ui.button({ label: 'I’m at the stop', attrs: 'data-primary' })}</div>`;
      const offLive = ride.liveRide(ctx.body, o, { where: where(o) });
      const off = onClockAt(o.leaveBy + o.walkMin, () => ctx.next());   // you reach the stop
      return () => { offLive(); off(); };
    },
  });

  if (ids.stop) screen(ids.stop, {
    detent: 'half',
    render: ctx => {
      const o = option();
      ctx.body.innerHTML = `${head(ctx, 'At the stop', { srOnly: true })}${ride.rideCard(o)}
        <p class="muted ride-wait">${ui.esc(o.kind === 'link' ? 'Wait at your front door' : stopName(o.board))}</p>
        <div class="actions" data-acts></div>`;
      const acts = ctx.body.querySelector('[data-acts]');
      const show = here => {
        acts.innerHTML = here ? ui.button({ label: 'Board', attrs: 'data-primary' }) : ui.button({ label: 'Jump to 30 s', kind: 'demo', attrs: 'data-demo' });
      };
      show(false);
      return ride.liveRide(ctx.body, o, { where: where(o), onChange: s => { if (s.state === 'here') show(true); } });
    },
  });

  if (ids.board) screen(ids.board, {
    detent: 'full',
    render: ctx => {
      const o = option(), code = cfg.code(), date = cfg.date();
      ctx.body.innerHTML = `${head(ctx, 'Your pass', { eyebrow: cfg.eyebrow || '' })}
        ${ride.passCard({ option: o, code, date, fareText: cfg.fareText(o), room: cfg.passRoom ? o.room : null, ...(cfg.passEnds?.(o) || {}) })}
        ${ride.walletButtons()}
        <div class="actions">${ui.button({ label: 'I’m on board', attrs: 'data-primary' })}</div>`;
      ride.drawQR(ctx.body.querySelector('.pass-qr'), `BATADEMO|${code}|${o.trip || o.id}|${date}`);
      ride.wireWallet(ctx.body);
    },
  });

  if (ids.onboard) screen(ids.onboard, {
    detent: 'peek',
    render: ctx => {
      const o = option();
      if (o.kind === 'link') {   // door to door: the drop-off and a live ETA; arriving moves on
        ctx.body.innerHTML = `${head(ctx, `Drop-off: ${cfg.dropOff || 'your stop'}`, { eyebrow: `On board · arrives ${formatTime(o.arrive)}` })}
          <p class="muted"><span data-left></span></p>`;
        const left = ctx.body.querySelector('[data-left]');
        const tick = t => { const m = Math.max(0, Math.ceil(o.rideArrive - t - 1e-9)); const s = m ? `${m} min to go` : 'Arriving'; if (left.textContent !== s) left.textContent = s; };
        const offTick = on('clock', tick);
        tick(state.story.clock);
        const off = onClockAt(o.rideArrive, () => ctx.next());
        return () => { offTick(); off(); };
      }
      const stops = ride.stopsLeft(o);
      ctx.body.innerHTML = `${head(ctx, `Get off at ${stopName(o.alight)}`, { eyebrow: `On board · arrives ${formatTime(o.rideArrive)}` })}
        ${ride.stopsList(stops)}`;
      let moved = false;
      const off = ride.liveStops(ctx.body, stops, { onArrive: () => setTimeout(() => { if (!moved) { moved = true; ctx.next(); } }, 0) });
      return () => { moved = true; off(); };
    },
  });
}
