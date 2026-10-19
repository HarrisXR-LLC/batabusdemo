// Shared rider pieces (plan 2·1 §5.3–5.5), reused by trips 2 and 3:
//   - Where's my ride: vehicle card, the big ETA and the status pill, live on the story clock. Polite
//     announcements at the moments that matter (on its way → 5 min → 2 min → arriving → here), never every
//     second, and the "Your bus is 5 min away" banner when it crosses 5 min;
//   - the boarding pass (QR from the vendored qrcode-generator, loaded on first use) and the Wallet modal;
//   - on board: the stops-left list and "Your stop is next".
import { on, state } from './state.js';
import { DATA, stopLabel } from './data.js';
import { rideStatus } from './engine.js';
import { formatTime, formatDate } from './story.js';
import { qrSvg } from './qr.js';
import * as ui from './ui.js';

// ---------- Where's my ride ----------

export function rideCard(option) {
  return `<div class="ride-card" data-ride>
    ${ui.vehicleCard({ cls: option.cls, route: option.kind === 'bus' ? option.routeShort : null, room: option.room })}
    <div class="eta"><span class="eta-big tab" data-eta-big></span><span class="eta-sub tab" data-eta-sub></span></div>
  </div>`;
}

/**
 * Keep a ride card live on the story clock. Returns a cleanup function.
 * onChange(status) runs whenever the state changes (screens use it to swap their main button).
 */
export function liveRide(root, option, { where = '', onChange = () => {} } = {}) {
  const big = root.querySelector('[data-eta-big]'), sub = root.querySelector('[data-eta-sub]');
  const noun = option.kind === 'link' ? 'ride' : 'bus';
  let last = null, first = true;
  const render = t => {
    const s = rideStatus(option, t);
    if (big.textContent !== s.big) big.textContent = s.big;
    const subText = s.sub || '';
    if (sub.textContent !== subText) sub.textContent = subText;
    ui.statusPill(s.pill);
    const key = `${s.state}|${s.minutes ?? ''}`;
    if (key === last) return;
    const prev = last ? last.split('|')[0] : null;
    last = key;
    if (!first) {
      if (s.state === 'near' && prev === 'onway') ui.banner({ title: `Your ${noun} is ${s.minutes} min away`, text: where });
      else if (s.state === 'near' && s.minutes === 2) ui.announce(`Your ${noun} is 2 min away.`);
      else if (s.state === 'arriving') ui.announce(`Your ${noun} is arriving.`);
      else if (s.state === 'here') ui.announce(`Your ${noun} is here.${s.sub ? ` ${s.sub}.` : ''}`);
    }
    if (prev !== s.state) onChange(s);
    first = false;
  };
  const off = on('clock', render);
  render(state.story.clock);
  return () => { off(); ui.statusPill(null); };
}

// ---------- the boarding pass and the Wallet modal ----------

export function passCard({ option, code, date, fareText, from = null, to = null, room = null }) {
  const route = option.kind === 'bus' ? ui.routeChip(option.routeShort) : '';
  from ??= option.kind === 'bus' ? stopLabel(option.board) : 'Your door';
  to ??= option.kind === 'bus' ? stopLabel(option.alight) : '';
  const leaves = option.kind === 'bus' ? option.depart : option.here, word = option.kind === 'bus' ? 'Leaves' : 'Pickup';
  return `<div class="pass">
    <div class="pass-top">${route}<span class="pass-name">${ui.esc(option.kind === 'bus' ? DATA.routes[option.route].long : 'Link')}</span>${ui.badge({ text: fareText, tone: 'ok', icon: 'check' })}</div>
    <p class="pass-trip">${ui.esc(from)} <span aria-hidden="true">→</span><span class="sr-only">to</span> ${ui.esc(to)}</p>
    <p class="muted tab">${ui.esc(formatDate(date))} · ${word} ${formatTime(leaves)}</p>
    ${room ? `<p class="pass-room">${ui.roomBadge(room.level, room.seats)}</p>` : ''}
    <div class="pass-qr" role="img" aria-label="Pass QR code, trip ${ui.esc(code.split('').join(' '))}"></div>
    <p class="pass-code tab" aria-label="Trip code ${ui.esc(code.split('').join(' '))}">${ui.esc(code)}</p>
    <p class="muted pass-hint">Show this to your driver</p>
  </div>`;
}

/** Draw the pass QR (not a real ticket). If the library can't load, the pass shows the code only. */
export async function drawQR(el, text) {
  try {
    el.innerHTML = await qrSvg(text);
  } catch (err) {
    console.warn('QR unavailable, showing the code only:', err.message);
    el.hidden = true;
  }
}

export function walletButtons() {
  return `<div class="wallet-row">${ui.button({ label: 'Add to Apple Wallet', kind: 'secondary', attrs: 'data-wallet' })}${ui.button({ label: 'Add to Google Wallet', kind: 'secondary', attrs: 'data-wallet' })}</div>`;
}

export function wireWallet(root) {
  for (const b of root.querySelectorAll('[data-wallet]')) b.addEventListener('click', e => {
    e.preventDefault();
    ui.modal({ icon: 'wallet', title: 'Coming soon in 2027!', text: 'Wallet passes are on the way.' });
  });
}

// ---------- on board ----------

/** The stops still ahead, with times; the stop you get off at is last and marked. */
export function stopsLeft(option) {
  const dep = Object.values(DATA.story[option.leg].svc).flatMap(s => s.deps).find(d => d.trip === option.trip);
  return [...dep.via.map(([id, t]) => ({ id, t, name: stopLabel(id), last: false })), { id: option.alight, t: option.rideArrive, name: stopLabel(option.alight), last: true }];
}

export function stopsList(stops) {
  return `<ol class="stops-left">${stops.map(s => `<li class="stop-row${s.last ? ' yours' : ''}" data-at="${s.t}">
    <span class="stop-dot" aria-hidden="true"></span><span class="stop-name">${ui.esc(s.name)}</span><span class="stop-time tab">${formatTime(s.t)}</span></li>`).join('')}</ol>`;
}

/**
 * Strike passed stops and show a short window (the stop just passed, the next three, yours);
 * say "Your stop is next" once, one stop before. Returns a cleanup function.
 */
export function liveStops(root, stops, { onArrive = () => {} } = {}) {
  let told = false, arrived = false;
  const lastVia = stops.length > 1 ? stops[stops.length - 2].t : null;
  const rows = [...root.querySelectorAll('.stop-row')];
  const render = t => {
    const next = Math.max(0, rows.findIndex(li => t < +li.dataset.at));
    rows.forEach((li, i) => {
      const yours = li.classList.contains('yours');
      li.classList.toggle('passed', t >= +li.dataset.at && !yours);
      li.hidden = !yours && (i < next - 1 || i > next + 2);
    });
    if (!told && lastVia != null && t >= lastVia) { told = true; ui.banner({ title: 'Your stop is next', text: stops.at(-1).name }); }
    if (!arrived && t >= stops.at(-1).t) { arrived = true; onArrive(); }
  };
  const off = on('clock', render);
  render(state.story.clock);
  return off;
}
