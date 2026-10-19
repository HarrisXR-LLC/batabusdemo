// Trip Demo 3 · A flight, a week ahead (plan 2·3): on trip 1's date at 7:00 PM, say "I'm here", pick Cherry
// Capital Airport and next week's date, arrive by 9:00 AM for an 11:00 flight, and book a Link van to your
// door ($6, the saved card, one tap). Preview my Ride before and after booking. On the travel day the van
// comes to you (8:35), drives 12.4 min on real streets, and drops you at 8:50: 2 h 10 min before the flight.
// Then the Thank you page and Restart. Tips only for what's new.
import { router } from '../router.js';
import { state } from '../state.js';
import { formatTime, formatDate, addDays, toMinutes } from '../story.js';
import { serviceFor } from '../data.js';
import { options as engineOptions, tripCode } from '../engine.js';
import { CONFIG } from '../config.js';
import { TIPS } from '../steps.js';
import * as ui from '../ui.js';
import * as pay from '../pay.js';
import { openPreview, moments } from '../preview.js';
import { tripPage, thanksPage } from '../prelude.js';
import { head as baseHead, screen, optionCards, legItems, rideSteps, previewButton, wirePreview } from './common.js';

const EYEBROW = 'Trip Demo 3 · Plan ahead';
const trip = () => state.trips[3];
const list = () => engineOptions('trip3', { service: serviceFor(router.dates.trip3travel) });
const recommended = () => list().find(o => o.recommended);
const chosen = () => list().find(o => o.id === trip().optionId) || recommended();
const arriveBy = toMinutes(CONFIG.requests.trip3.arriveBy);
const flight = toMinutes(CONFIG.story.trip3.flight);
const travelDay = () => formatDate(router.dates.trip3travel);
const head = (ctx, title, opts = {}) => baseHead(ctx, title, { eyebrow: EYEBROW, ...opts });
const beforeFlight = o => { const m = flight - o.arrive; return `${Math.floor(m / 60)} h ${m % 60} min before your flight`; };
const DEST = o => ({ from: 'home123', to: 'airport', toLabel: 'Cherry Capital Airport', end: { title: beforeFlight(o), where: 'Time to spare' } });

/** The trip's one leg: the timeline is all to come until the travel day. */
const legs = () => {
  const t = state.story.date === router.dates.trip3travel ? state.story.clock : -Infinity;
  return [{ id: 'go', label: 'Going', items: legItems(chosen(), { toText: 'Cherry Capital Airport', toIcon: 'plane' }, t) }];
};
const previewSpec = () => ({ date: router.dates.trip3travel, legs: [{ id: 'go', label: 'Going', leg: 'trip3', option: chosen(), moments: moments(chosen(), DEST(chosen())) }] });

/** The demo follows the story's choices (the travel day is set around them). */
async function keep(title, text, reset) { await ui.modal({ icon: 'cal', title, text }); reset(); }

/** The airport header (M7): "I'm here · 123 Sesame Street". */
const airportHead = ctx => `<div class="dest-head">${ctx.canGoBack ? ui.roundButton({ icon: 'left', label: 'Back', attrs: 'data-back' }) : ''}
  <span class="row-ic" aria-hidden="true"><svg class="i filled" aria-hidden="true"><use href="./assets/icons.svg#i-plane"/></svg></span>
  <div><h1 tabindex="-1" data-step-heading>Cherry Capital Airport</h1><p class="muted here-line">${ui.icon('here', 'i s')}I’m here · 123 Sesame Street</p></div></div>`;

// ---------- Intro, Home ("I'm here"), Destination ----------

screen('t3.intro', { detent: 'full', render: ctx => tripPage(ctx, 3) });   // the Trip Demo 3 prelude (js/prelude.js)

screen('t3.home', {
  detent: 'peek',
  render: ctx => {
    const set = !!trip().pickup;
    ctx.body.innerHTML = `${head(ctx, 'Where to?', { srOnly: true })}
      <div class="chips"><button type="button" class="chip${set ? ' sel' : ''}" data-here aria-pressed="${set}">${ui.icon(set ? 'check' : 'here', 'i s')}<span>${set ? 'I’m here · 123 Sesame Street' : 'I’m here'}</span></button></div>
      <button type="button" class="search search-btn" data-search data-primary>${ui.icon('search')}<span>Where to?</span></button>`;
    const chip = ctx.body.querySelector('[data-here]');
    chip.addEventListener('click', () => {   // the pickup is where you are (simulated: no location prompt)
      trip().pickup = 'home123';
      chip.classList.add('sel');
      chip.setAttribute('aria-pressed', 'true');
      chip.innerHTML = `${ui.icon('check', 'i s')}<span>I’m here · 123 Sesame Street</span>`;
      ui.announce('Pickup: 123 Sesame Street.');
      ctx.body.querySelector('[data-search]').focus({ preventScroll: true });
    });
  },
  complete: s => { s.trips[3].pickup = 'home123'; },
});

screen('t3.destination', {
  detent: 'full',
  render: ctx => {
    ctx.body.innerHTML = `${head(ctx, 'Where to?')}
      ${ui.search({ placeholder: 'Search a place' })}
      <h2 class="section-label">Suggested</h2>
      <div class="place-list">
        ${ui.listRow({ icon: 'plane', label: 'Cherry Capital Airport', sub: 'Traverse City', attrs: 'data-place="airport" data-match="cherry capital airport tvc flight"' })}
        ${ui.listRow({ icon: 'work', label: 'Work', sub: 'Grand Traverse Mall', chevron: false, attrs: 'aria-disabled="true" data-match="work grand traverse mall"' })}
      </div>
      <p class="muted empty-hint" hidden>No match. Try “airport”.</p>`;
    const input = ctx.body.querySelector('input'), hint = ctx.body.querySelector('.empty-hint');
    const filter = () => {
      const q = input.value.trim().toLowerCase();
      let any = false;
      for (const row of ctx.body.querySelectorAll('[data-match]')) { const show = !q || row.dataset.match.includes(q); row.hidden = !show; any ||= show; }
      hint.hidden = any;
    };
    input.value = 'airport';
    filter();
    input.addEventListener('input', filter);
    for (const svg of ctx.body.querySelectorAll('[data-place="airport"] svg.i')) svg.classList.add('filled');
    ctx.body.querySelector('[data-place="airport"]').addEventListener('click', () => { trip().destination = 'airport'; ctx.next(); });
  },
  complete: s => { s.trips[3].destination = 'airport'; },
});

// ---------- When (up to 7 days ahead) and Arrive by (M7) ----------

const MONTH = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' });
const dayChips = selected => {
  const today = router.dates.trip3book, out = [];
  for (let d = 0; d <= CONFIG.story.trip3.daysAhead; d++) {
    const date = addDays(today, d), wd = formatDate(date).split(',')[0];
    const label = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${wd} ${+date.slice(8)}`;
    // the name starts with what the chip shows, so voice control can say "Wed 21" (2.5.3)
    const name = d < 2 ? `${label}, ${formatDate(date)}` : `${label} ${MONTH.format(new Date(`${date}T12:00:00Z`))}`;
    out.push(ui.chip({ label, radio: true, selected: d === selected, attrs: `data-day="${d}" aria-label="${ui.esc(name)}"` }));
  }
  return ui.chipRow(out, 'Day', { fade: true });
};

screen('t3.when', {
  detent: 'half',
  render: ctx => {
    const days = CONFIG.story.trip3.daysAhead;
    trip().day ??= days;
    ctx.body.innerHTML = `${airportHead(ctx)}
      <h2 class="section-label">When</h2>${dayChips(trip().day)}
      <p class="muted when-line" data-when></p>
      <div class="actions">${ui.button({ label: 'Next', attrs: 'data-next-step' })}</div>`;
    const row = ctx.body.querySelector('.chips'), line = ctx.body.querySelector('[data-when]');
    const label = () => { line.textContent = formatDate(addDays(router.dates.trip3book, trip().day)); };
    ui.radioGroup(row, () => { trip().day = +ctx.body.querySelector('[role="radio"][aria-checked="true"]').dataset.day; label(); });
    row.scrollLeft = row.scrollWidth;                 // next week's date is at the end of the row (M7)
    label();
    ctx.body.querySelector('[data-next-step]').addEventListener('click', () => {
      if (trip().day === days) return ctx.next();
      keep(`Let’s book ${travelDay()}`, 'The demo plans a week ahead.', () => row.querySelector(`[data-day="${days}"]`).click());
    });
  },
  complete: s => { s.trips[3].day = CONFIG.story.trip3.daysAhead; },
});

screen('t3.arriveBy', {
  detent: 'half',
  render: ctx => {
    trip().arriveBy ??= arriveBy;
    const times = [arriveBy - 60, arriveBy - 30, arriveBy, arriveBy + 30];
    const hh = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    ctx.body.innerHTML = `${airportHead(ctx)}
      <h2 class="section-label">When</h2><p class="when-picked">${ui.esc(travelDay())}</p>
      <h2 class="section-label">Arrive by</h2>
      ${ui.chipRow(times.map(m => ui.chip({ label: formatTime(m), radio: true, selected: m === trip().arriveBy, attrs: `data-time="${hh(m)}"` }))
        .concat(ui.chip({ label: 'Other time', radio: true, selected: !times.includes(trip().arriveBy), attrs: 'data-time="other"' })), 'Arrive by')}
      <div class="field other-time" hidden><label for="t3-time">Arrive by</label><input id="t3-time" type="time" step="300" value="${hh(trip().arriveBy)}"></div>
      <p class="muted">Flight at ${formatTime(flight)}.</p>
      <div class="actions">${ui.button({ label: 'Find rides', attrs: 'data-next-step' })}</div>`;
    const row = ctx.body.querySelector('.chips'), other = ctx.body.querySelector('.other-time'), input = other.querySelector('input');
    ui.radioGroup(row, () => {
      const t = ctx.body.querySelector('[data-time][aria-checked="true"]').dataset.time;
      other.hidden = t !== 'other';
      trip().arriveBy = t === 'other' ? toMinutes(input.value || '09:00') : toMinutes(t);
    });
    input.addEventListener('change', () => { if (input.value) trip().arriveBy = toMinutes(input.value); });
    ctx.body.querySelector('[data-next-step]').addEventListener('click', () => {
      if (trip().arriveBy === arriveBy) return ctx.next();
      keep(`Let’s use ${formatTime(arriveBy)}`, `Two hours before an ${formatTime(flight)} flight.`, () => row.querySelector(`[data-time="${hh(arriveBy)}"]`).click());
    });
  },
  complete: s => { s.trips[3].arriveBy = arriveBy; },
});

// ---------- Options, Review, Preview (before booking) ----------

screen('t3.options', {
  detent: 'half',
  render: ctx => {
    const opts = list(), sel = chosen();
    trip().optionId = sel.id;
    ctx.body.innerHTML = `<div class="dest-head">${ctx.canGoBack ? ui.roundButton({ icon: 'left', label: 'Back', attrs: 'data-back' }) : ''}
        <div><h1 tabindex="-1" data-step-heading>Cherry Capital Airport</h1><p class="muted">Arrive by ${formatTime(arriveBy)} · ${ui.esc(travelDay())}</p></div></div>
      ${optionCards(opts, sel.id, { linkRoom: true })}
      <div class="actions">${ui.button({ label: '', attrs: 'data-choose' })}</div>`;
    const btn = ctx.body.querySelector('[data-choose]');
    const label = () => { btn.querySelector('span').textContent = `Choose ${chosen().times[0]} pickup · ${chosen().fare}`; };
    const group = ui.radioGroup(ctx.body.querySelector('.opts'), id => { trip().optionId = id; label(); });
    label();
    btn.addEventListener('click', () => (chosen().recommended ? ctx.next()
      : keep(`Let’s take the ${recommended().times[0]} pickup`, 'The demo follows the Recommended ride.', () => group.set(recommended().id))));
  },
  complete: s => { s.trips[3].optionId = recommended().id; },
});

async function book(ctx) {
  const o = chosen();
  const ok = await pay.confirmPayment(null, { amount: '$6.00', what: 'bata go · Link' });
  if (!ok) return;
  trip().booking = { code: tripCode(), optionId: o.id, method: 'card', paidCents: o.fareCents };
  state.user.card ||= `•••• ${pay.DEMO_CARD.last4}`;
  router.go('t3.booked');            // Preview (the next step) is only for looking first
}

screen('t3.review', {
  detent: 'half',
  render: ctx => {
    const o = chosen();
    ctx.body.innerHTML = `${head(ctx, 'Review')}
      <ul class="review-list">
        <li><span class="row-ic">${ui.icon('van')}</span><span class="grow"><span class="t">Pickup ${formatTime(o.here)} at your door</span><span class="s">${ui.esc(travelDay())} · 123 Sesame Street</span></span></li>
        <li><span class="row-ic"><svg class="i filled" aria-hidden="true"><use href="./assets/icons.svg#i-plane"/></svg></span><span class="grow"><span class="t">Drop-off ${formatTime(o.arrive)}</span><span class="s">Cherry Capital Airport</span></span></li>
        <li><span class="row-ic">${ui.icon('card')}</span><span class="grow"><span class="t">Card ${ui.esc(state.user.card || `•••• ${pay.DEMO_CARD.last4}`)}</span><span class="s">Saved</span></span></li>
      </ul>
      <div class="actions">${ui.button({ label: 'Book & pay · $6.00', attrs: 'data-book' })}${previewButton()}</div>`;
    ctx.body.querySelector('[data-preview]').addEventListener('click', e => { e.preventDefault(); ctx.next(); });   // → t3.preview
    ctx.body.querySelector('[data-book]').addEventListener('click', () => book(ctx));
  },
});

screen('t3.preview', {
  detent: 'half',
  render: ctx => openPreview({ ...previewSpec(), asStep: true, sheet: ctx.sheet, body: ctx.body,
    onDone: () => (ctx.canGoBack ? ctx.back() : router.go('t3.review')) }),
});

// ---------- Booked, then the travel day ----------

screen('t3.booked', {
  detent: 'half',
  render: ctx => {
    ctx.body.innerHTML = `<div class="done-head"><span class="done-check" aria-hidden="true">${ui.icon('check')}</span>
        <div><h1 tabindex="-1" data-step-heading>You’re booked</h1><p class="muted">${ui.esc(travelDay())} · Link · Paid $6.00</p></div></div>
      ${ui.tripTimeline({ legs: legs() })}
      <div class="code-row"><span class="muted">Trip code</span><span class="code tab">${ui.esc(trip().booking?.code || '')}</span></div>
      <div class="actions">${ui.button({ label: 'Skip to trip day', kind: 'demo', attrs: 'data-demo' })}${previewButton()}</div>`;
    wirePreview(ctx, previewSpec);
    return ui.wireTripTimeline(ctx.body.querySelector('.trip-tl'));
  },
  complete: s => { s.trips[3].booking = { code: 'L6R-9TW', optionId: recommended().id, method: 'card', paidCents: recommended().fareCents }; },
});

// Where's my ride (the van comes to your door: Jump to 30 s, then Board) → the pass → on board
rideSteps({
  ids: { stop: 't3.link', board: 't3.pass', onboard: 't3.onboard' },
  option: chosen,
  fareText: () => 'Paid · $6.00',
  code: () => trip().booking?.code || '',
  date: () => router.dates.trip3travel,
  passEnds: () => ({ from: '123 Sesame Street', to: 'Cherry Capital Airport' }),
  dropOff: 'Cherry Capital Airport',
});

screen('t3.arrived', {
  detent: 'half',
  render: ctx => {
    const o = chosen();
    ctx.body.innerHTML = `${head(ctx, 'You’re at the airport')}
      <p class="big-time"><strong class="tab">${formatTime(o.arrive)}</strong> <span>${ui.esc(beforeFlight(o))}</span></p>
      <p class="muted">Cherry Capital Airport · Link · $6.00</p>
      <div class="actions">${ui.button({ label: 'Finish', attrs: 'data-primary' })}</div>`;
  },
});

// ---------- The end ----------

screen('end', { detent: 'full', render: ctx => thanksPage(ctx) });   // "Thank you", the benefits, the contact card, Restart

// ---------- tips: only what's new in trip 3 (plan 2·3 §4) ----------
// (No tips on the Trip Demo 3 prelude or the Thank you page: they speak for themselves.)
Object.assign(TIPS, {
  't3.home': [{ target: '[data-here]', text: 'Tap I’m here. We’ll pick you up where you are.' }],
  't3.when': [{ target: `[data-day="${CONFIG.story.trip3.daysAhead}"]`, text: 'Book up to 7 days ahead.' }],
  't3.arriveBy': [{ target: '[data-time="09:00"]', side: 'left', text: 'Flight at 11:00? Arrive by 9:00, two hours early.' }],
  't3.options': [{ target: '.opt[aria-checked="true"]', text: 'A Link van picks you up at home. No walking.' }],
  't3.review': [{ target: '[data-preview]', text: 'Nervous? Preview every step first.' }],
  't3.preview': [{ target: '.scrub .thumb', side: 'right', text: 'Drag, or tap Next, to see each step.' }],
  't3.link': [{ target: '.veh-card', text: 'Watch your van come to you.' }],
});
