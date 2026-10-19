// UI kit (plan 1·2 §6): Apple × Uber parts every screen reuses.
// Builders return HTML strings (text is always escaped); the parts that need script are wired by
// the functions below them. Every control is >= 48px, has a focus ring and an accessible name.
import { state, on } from './state.js';
import { CONFIG } from './config.js';

const ICONS = './assets/icons.svg';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let screenEl = null;

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const icon = (name, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="${ICONS}#i-${name}"/></svg>`;
let uid = 0;
export const newId = prefix => `${prefix}-${++uid}`;

// ---------- buttons ----------

/** kind: primary | secondary | demo | text. Demo controls get the dashed look and a "DEMO ·" prefix (§5.2). */
export function button({ label, kind = 'primary', icon: ic = null, attrs = '' }) {
  const text = kind === 'demo' ? `<span class="demo-tag">DEMO</span> · ${esc(label)}` : esc(label);
  return `<button type="button" class="btn ${kind}" ${attrs}>${ic ? icon(ic, 'i s') : ''}<span>${text}</span></button>`;
}

/** A 48px round icon button (Back, Next, Play). */
export function roundButton({ icon: ic, label, attrs = '' }) {
  return `<button type="button" class="round" aria-label="${esc(label)}" ${attrs}>${icon(ic)}</button>`;
}

// ---------- search, chips, rows, fields ----------

/** A real input for typing destinations. `attrs` go on the pill, `inputAttrs` on the input. */
export function search({ placeholder = 'Where to?', attrs = '', inputAttrs = '' } = {}) {
  const id = newId('search');
  return `<div class="search" ${attrs}>${icon('search')}<label class="sr-only" for="${id}">${esc(placeholder)}</label>
    <input id="${id}" type="search" placeholder="${esc(placeholder)}" autocomplete="off" enterkeyhint="search" ${inputAttrs}></div>`;
}

/** A pill chip. `menu` adds a chevron (it opens a picker); `radio` makes it one choice in a radioGroup. */
export function chip({ label, icon: ic = null, selected = false, menu = false, radio = false, attrs = '' }) {
  const role = radio ? `role="radio" aria-checked="${selected}" tabindex="-1"` : '';
  const lead = (radio ? icon('check', 'i s chip-check') : '') + (ic ? icon(ic, 'i s chip-ic') : '');
  return `<button type="button" class="chip${selected ? ' sel' : ''}" ${role} ${attrs}>${lead}<span>${esc(label)}</span>${menu ? icon('down', 'i s') : ''}</button>`;
}

/** A single-choice chip row; `fade` for a row that scrolls sideways (M7). */
export function chipRow(chips, label, { fade = false } = {}) {
  return `<div class="chips${fade ? ' fade' : ''}" role="radiogroup" aria-label="${esc(label)}">${chips.join('')}</div>`;
}

/** Icon · label (and a second line) · value · chevron. A button when it does something. */
export function listRow({ icon: ic, label, sub = '', value = '', chevron = true, attrs = '' }) {
  return `<button type="button" class="row" ${attrs}><span class="row-ic">${icon(ic)}</span>
    <span class="row-text"><span class="row-t">${esc(label)}</span>${sub ? `<span class="row-s">${esc(sub)}</span>` : ''}</span>
    ${value ? `<span class="row-v tab">${esc(value)}</span>` : ''}${chevron ? icon('right', 'i s row-chev') : ''}</button>`;
}

/** Read-only field with a lock: filled only by "(DEMO) Auto fill". */
export function field({ label, value = '', attrs = '' }) {
  const id = newId('field');
  return `<div class="field"><label for="${id}">${esc(label)}</label>
    <input id="${id}" class="tab" value="${esc(value)}" readonly aria-readonly="true" tabindex="0" ${attrs}>${icon('lock', 'i s')}</div>`;
}

// ---------- chips that carry meaning: routes, room, badges ----------

const ROUTE_KEYS = { '07': '07', 'Bayline': 'bayline', '14': '14' };
/** A route chip in its GTFS color. Unknown routes may pass { bg, fg }. */
export function routeChip(route, colors = null) {
  const style = colors ? ` style="--rc:${esc(colors.bg)};--rc-ink:${esc(colors.fg)}"` : '';
  return `<span class="routechip" data-route="${esc(ROUTE_KEYS[route] || 'other')}"${style}><span class="sr-only">Route </span>${esc(route)}</span>`;
}

export function badge({ text, tone = 'plain', icon: ic = null, attrs = '' }) {
  return `<span class="badge ${tone}" ${attrs}>${ic ? icon(ic, 'i s') : ''}${esc(text)}</span>`;
}

/** Room on the bus: text always present, never color alone. level: plenty | filling | almost | reserved (Link). */
export function roomBadge(level, seats = null, attrs = '') {
  if (level === 'reserved') return badge({ text: 'Booked for you', tone: 'ok', icon: 'check', attrs });
  if (level === 'plenty' && CONFIG.engine.showPlentyOfRoom === false) return '';
  const text = level === 'almost' ? `Almost full · ${seats} seats left` : level === 'filling' ? 'Filling up' : 'Plenty of room';
  return badge({ text, tone: level === 'plenty' ? 'plain' : level === 'almost' ? 'amber strong' : 'amber', icon: 'users', attrs });
}

// ---------- option cards and segmented control (radio groups) ----------

/**
 * One trip option. times: ['11:13', '11:34 AM'] (already formatted). "(Recommended)" is a suffix.
 * late: true greys the times and shows `note` in amber instead of the meta row; otherwise `note` is a small badge ("Last bus").
 */
export function optionCard({ id, times, price, name = '', recommended = false, walkMin = null, route = null, room = null, late = false, note = '', selected = false, extra = '' }) {
  const meta = late
    ? `<span class="opt-meta late-note">${icon('clock', 'i s')}${esc(note)}</span>`
    : `<span class="opt-meta">${walkMin != null ? `${icon('walk', 'i s')}<span class="tab">${walkMin} min</span><span class="sr-only"> walk</span>` : ''}${route ? routeChip(route) : ''}${extra}${room ? roomBadge(room.level, room.seats) : ''}${note ? badge({ text: note }) : ''}</span>`;
  return `<div class="opt${late ? ' late' : ''}" role="radio" aria-checked="${selected}" tabindex="-1" data-id="${esc(id)}">
    <span class="opt-top"><span class="opt-times tab">${esc(times[0])} <span aria-hidden="true">→</span><span class="sr-only">to</span> ${esc(times[1])}</span><span class="opt-price tab${/^free$/i.test(price) ? ' free' : ''}">${esc(price)}</span></span>
    ${name ? `<span class="opt-name">${esc(name)}${recommended ? ' <span class="rec">(Recommended)</span>' : ''}</span>` : ''}${meta}</div>`;
}

export function optionList(cards, label = 'Trip options') {
  return `<div class="opts" role="radiogroup" aria-label="${esc(label)}">${cards.join('')}</div>`;
}

/** Apple-style segmented control, e.g. Going | Return. */
export function segmented({ items, selected, label }) {
  return `<div class="seg" role="radiogroup" aria-label="${esc(label)}">${items.map(it =>
    `<div class="seg-item" role="radio" aria-checked="${it.id === selected}" tabindex="-1" data-id="${esc(it.id)}">${esc(it.label)}</div>`).join('')}</div>`;
}

/**
 * Radio-group behavior for option cards, segments and chip rows: one tab stop, arrow keys move
 * and select, Space/Enter select, click selects. Returns { get, set }.
 */
export function radioGroup(group, onChange = () => {}) {
  const items = () => [...group.querySelectorAll('[role="radio"]')];
  const select = (el, focus = false) => {
    for (const it of items()) {
      const on = it === el;
      it.setAttribute('aria-checked', on);
      it.tabIndex = on ? 0 : -1;
      it.classList.toggle('sel', on);
    }
    if (focus) el.focus();
    onChange(el.dataset.id, el);
  };
  const checked = () => items().find(it => it.getAttribute('aria-checked') === 'true');
  (checked() || items()[0]).tabIndex = 0;
  group.addEventListener('click', e => { const el = e.target.closest('[role="radio"]'); if (el && group.contains(el)) select(el); });
  group.addEventListener('keydown', e => {
    const list = items(), i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const move = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (move) select(list[(i + move + list.length) % list.length], true);
    else if (e.key === 'Home') select(list[0], true);
    else if (e.key === 'End') select(list[list.length - 1], true);
    else if (e.key === ' ' || e.key === 'Enter') select(list[i]);
    else return;
    e.preventDefault();
  });
  return { get: () => checked()?.dataset.id ?? null, set: id => { const el = items().find(it => it.dataset.id === id); if (el) select(el); } };
}

// ---------- timeline ----------

/**
 * Vertical trip steps: time · icon · one line, the current one highlighted.
 * Collapsed, it is one "Next: …" row that expands the list (aria-expanded).
 */
export function timeline({ items, expanded = false }) {
  const id = newId('tl');
  const cur = items.find(it => it.current) || items[0];
  return `<div class="tl">
    <button type="button" class="row tl-toggle" aria-expanded="${expanded}" aria-controls="${id}">
      <span class="row-ic">${icon(cur.icon)}</span>
      <span class="row-text"><span class="row-t">Next: ${esc(cur.text)}</span>${cur.sub ? `<span class="row-s">${esc(cur.sub)}</span>` : ''}</span>${icon('down', 'i s row-chev')}</button>
    <ol class="tl-list" id="${id}"${expanded ? '' : ' hidden'}>${items.map(it => `
      <li class="tl-st${it.current ? ' now' : ''}"${it.current ? ' aria-current="step"' : ''}><span class="tl-dot">${icon(it.icon, 'i s')}</span>
        <span><span class="tl-time tab">${esc(it.time)}</span><span class="tl-what">${esc(it.text)}</span></span></li>`).join('')}</ol></div>`;
}

export function wireTimeline(el) {
  const toggle = el.querySelector('.tl-toggle'), list = el.querySelector('.tl-list');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', open);
    list.hidden = !open;
  });
}

/**
 * A trip's timeline (plan 2·2 §5.2): one leg, or Going | Return. Collapsed, one "Next: …" row; expanded,
 * an ordered list per leg with done steps ticked and the current one highlighted. Screen readers hear
 * "11:13 AM, Bayline at Silver Dr …" for each item.
 * legs: [{ id, label, items: [{ time, icon, text, sub?, state: 'done' | 'now' | 'todo' }] }]
 */
export function tripTimeline({ legs, selected = legs[0].id, expanded = false }) {
  const id = newId('tl');
  const nextOf = leg => leg.items.find(it => it.state !== 'done');
  const line = leg => { const n = nextOf(leg); return n ? { t: `Next: ${n.text}`, s: n.sub || '' } : { t: 'All done', s: `${leg.label || 'Trip'} complete` }; };
  const cur = line(legs.find(l => l.id === selected));
  const lists = legs.map(leg => { const n = line(leg); return `<ol class="tl-list" data-leg="${esc(leg.id)}" data-next="${esc(n.t)}" data-next-sub="${esc(n.s)}"${leg.id === selected ? '' : ' hidden'}>${leg.items.map(it => `
    <li class="tl-st ${it.state}"${it.state === 'now' ? ' aria-current="step"' : ''}><span class="tl-dot">${icon(it.state === 'done' ? 'check' : it.icon, 'i s')}</span>
      <span><span class="tl-time tab">${it.state === 'done' ? '<span class="sr-only">Done: </span>' : ''}${esc(it.time)}</span><span class="sr-only">, </span><span class="tl-what">${esc(it.list || it.text)}</span></span></li>`).join('')}</ol>`; }).join('');
  return `<div class="tl trip-tl">
    ${legs.length > 1 ? segmented({ items: legs.map(l => ({ id: l.id, label: l.label })), selected, label: 'Leg' }) : ''}
    <button type="button" class="row tl-toggle" aria-expanded="${expanded}" aria-controls="${id}">
      <span class="row-ic">${icon(legs.find(l => l.id === selected).items.find(it => it.state !== 'done')?.icon || 'check')}</span>
      <span class="row-text"><span class="row-t" data-next-t>${esc(cur.t)}</span><span class="row-s" data-next-s>${esc(cur.s)}</span></span>${icon('down', 'i s row-chev')}</button>
    <div class="tl-lists" id="${id}"${expanded ? '' : ' hidden'}>${lists}</div></div>`;
}

/** Wire a trip timeline: tap to expand, Going | Return to switch, the sheet at full height expands it. Returns a cleanup. */
export function wireTripTimeline(el) {
  const toggle = el.querySelector('.tl-toggle'), box = el.querySelector('.tl-lists');
  const setOpen = open => { toggle.setAttribute('aria-expanded', open); box.hidden = !open; };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  const seg = el.querySelector('.seg');
  if (seg) radioGroup(seg, id => {
    for (const ol of el.querySelectorAll('.tl-list')) ol.hidden = ol.dataset.leg !== id;
    const ol = el.querySelector(`.tl-list[data-leg="${CSS.escape(id)}"]`);
    el.querySelector('[data-next-t]').textContent = ol.dataset.next;
    el.querySelector('[data-next-s]').textContent = ol.dataset.nextSub;
  });
  return on('sheet', name => { if (name === 'full') setOpen(true); });   // drag the sheet up: the full list (2.5.7: tap works too)
}

// ---------- vehicle card, ETA ----------

const CLASS_NAMES = { full: 'Full-size bus', medium: 'Medium bus', van: 'Link van' };
/** Vehicle side view (the class's side sprite, sized by width), route chip, class name and room. */
export function vehicleCard({ cls = 'full', route = null, room = null, art = '' }) {
  const side = `<img class="veh-side" src="./assets/sprites/${esc(cls)}-side.svg" alt="">`;
  return `<div class="veh-card"><div class="veh-art sprite" data-cls="${esc(cls)}" aria-hidden="true">${art || side}</div>
    <div class="veh-info"><span class="veh-name">${route ? routeChip(route) : ''}<span>${esc(CLASS_NAMES[cls] || cls)}</span></span>${room ? roomBadge(room.level, room.seats) : ''}</div></div>`;
}

export function bigEta({ value, sub = '' }) {
  return `<div class="eta"><span class="eta-big tab">${esc(value)}</span>${sub ? `<span class="eta-sub tab">${esc(sub)}</span>` : ''}</div>`;
}

// ---------- screen-reader announcements ----------

let announcer = null;
/** Polite announcement (status pill, banner). Same text twice still announces. */
export function announce(text) {
  if (!announcer) return;
  announcer.textContent = '';
  setTimeout(() => { announcer.textContent = text; }, 60);
}

// ---------- layers: inert background, focus trap ----------

const layers = [];
function applyInert() {
  const top = layers[layers.length - 1];
  for (const child of screenEl.children) {
    if (child.id === 'demo-footer' || child.id === 'announcer') continue;
    child.inert = !!top && !top.contains(child) && child !== top;
  }
}
/** Make everything in the screen except `el` (and the footer) inert. Returns a restore function. */
export function isolate(el) {
  layers.push(el);
  applyInert();
  return () => { const i = layers.lastIndexOf(el); if (i >= 0) layers.splice(i, 1); applyInert(); };
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
export const firstFocusable = el => (el.matches?.(FOCUSABLE) ? el : el.querySelector?.(FOCUSABLE)) || null;

/** Keep Tab inside `container`. */
export function trapTab(container, e) {
  if (e.key !== 'Tab') return;
  const list = [...container.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
  if (!list.length) return;
  const first = list[0], last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
}

// ---------- status pill ----------

let pill = null;
/** The glass pill over the map ("Your bus is on its way!"). Pass null to hide it. */
export function statusPill(text) {
  if (!text) { pill?.remove(); pill = null; return; }
  if (!pill) {
    pill = document.createElement('div');
    pill.className = 'pill glass';
    document.getElementById('overlay-layer').append(pill);
  }
  if (pill.dataset.text !== text) {
    pill.dataset.text = text;
    pill.innerHTML = `<span class="live-dot" aria-hidden="true"></span><span>${esc(text)}</span>`;
    announce(text);
  }
}

// ---------- banner ----------

let bannerEl = null, bannerTimer = 0;
/** An iOS-style notification from the top. Hides after 4 s, unless a tip is up or reduced motion is on. */
export function banner({ title, text }) {
  hideBanner(true);
  bannerEl = document.createElement('button');
  bannerEl.type = 'button';
  bannerEl.className = 'banner glass';
  bannerEl.setAttribute('aria-label', `${title}. ${text}. Dismiss`);
  bannerEl.innerHTML = `<span class="banner-glyph" aria-hidden="true"><span>b</span></span>
    <span class="banner-text"><span class="banner-t">${esc(title)}</span><span class="banner-s">${esc(text)}</span></span>`;
  bannerEl.addEventListener('click', () => hideBanner());
  document.getElementById('overlay-layer').append(bannerEl);
  requestAnimationFrame(() => bannerEl?.classList.add('in'));
  state.ui.banner = { title, text };
  announce(`${title}. ${text}`);
  scheduleBannerHide();
}
function scheduleBannerHide() {
  clearTimeout(bannerTimer);
  if (bannerEl && !state.tour.showing && !reducedMotion.matches) bannerTimer = setTimeout(() => hideBanner(), 4000);
}
export function hideBanner(now = false) {
  clearTimeout(bannerTimer);
  const el = bannerEl;
  bannerEl = null; state.ui.banner = null;
  if (!el) return;
  if (now || reducedMotion.matches) { el.remove(); return; }
  el.classList.remove('in');
  setTimeout(() => el.remove(), 320);
}

// ---------- modal ----------

/** A centered alert: icon, title, one line, one button. Resolves when closed. */
export function modal({ icon: ic = 'info', title, text, button: label = 'OK' }) {
  return new Promise(resolve => {
    const opener = document.activeElement;
    const tid = newId('modal-t'), did = newId('modal-d');
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="${tid}" aria-describedby="${did}">
      <span class="modal-ic" aria-hidden="true">${icon(ic)}</span><h2 id="${tid}">${esc(title)}</h2><p id="${did}">${esc(text)}</p>
      ${button({ label, attrs: 'data-close' })}</div>`;
    const layer = document.getElementById('overlay-layer');
    layer.append(scrim);
    const restore = isolate(layer);
    const dialog = scrim.firstElementChild;
    state.ui.modal = title;
    const close = () => {
      scrim.remove(); restore(); state.ui.modal = null;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      resolve();
    };
    scrim.addEventListener('mousedown', e => { if (!e.target.closest('button')) e.preventDefault(); });   // keep focus in the modal
    dialog.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else trapTab(dialog, e); });
    dialog.querySelector('[data-close]').addEventListener('click', close);
    dialog.querySelector('[data-close]').focus({ preventScroll: true });
  });
}

// ---------- init ----------

export function initUI(screen) {
  screenEl = screen;
  announcer = document.createElement('div');
  announcer.className = 'sr-only';
  announcer.setAttribute('aria-live', 'polite');
  announcer.id = 'announcer';
  screen.append(announcer);
  on('tour', showing => { if (showing) clearTimeout(bannerTimer); });   // a tip pins the banner until tapped
  on('reset', () => { statusPill(null); hideBanner(true); });
}
