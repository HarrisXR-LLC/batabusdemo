// Trip 2 · Book ahead, same day (plan 2·2): on Sunday, July 4, 2027, at 9:30 AM, book the free Bayline
// out to the fair near the marina and the ride back that evening, in one go; then ride both legs.
//   Going: leave 77 Sesame Street 11:07 → Commons 11:13 → Union St 11:31 → the fair 11:34 ("Almost full")
//   Return: leave the fair 6:45 PM → Hall St 6:52 (the bus has waited since 6:49) → 7:00 → Commons 7:07 → home 7:11
// Tips only for what's new. The live ride screens are shared with trip 1 (common.js rideSteps()).
import { router } from '../router.js';
import { state } from '../state.js';
import { formatTime, formatDate, toMinutes } from '../story.js';
import { serviceFor } from '../data.js';
import { options as engineOptions, tripCode } from '../engine.js';
import { CONFIG } from '../config.js';
import { TIPS } from '../steps.js';
import * as ui from '../ui.js';
import { rideCard, liveRide } from '../ride.js';
import { moments } from '../preview.js';
import { head as baseHead, screen, stopName, optionCards, legItems, rideSteps, previewButton, wirePreview } from './common.js';

const EYEBROW = 'Trip 2 · Book ahead';
const trip = () => state.trips[2];
const service = () => serviceFor(router.dates.trip2);
const going = () => engineOptions('trip2', { service: service() });
const back = () => engineOptions('trip2back', { service: service() });
const pick = (list, id) => list.find(o => o.id === id) || list.find(o => o.recommended);
const goChosen = () => pick(going(), trip().optionId);
const backChosen = () => pick(back(), trip().returnId);
const arriveBy = toMinutes(CONFIG.requests.trip2.arriveBy);
const leaveAfter = toMinutes(CONFIG.requests.trip2back.leaveAfter);
const day = () => formatDate(router.dates.trip2);
const head = (ctx, title, opts = {}) => baseHead(ctx, title, { eyebrow: EYEBROW, ...opts });

/** Both legs for the timeline; done steps are ticked at the story time (the trip's own day). */
const legs = () => [
  { id: 'go', label: 'Going', items: legItems(goChosen(), { toText: 'Fair', toIcon: 'pin' }, state.story.clock) },
  { id: 'back', label: 'Return', items: legItems(backChosen(), { from: 'the fair', toText: 'Home', toIcon: 'home' }, state.story.clock) },
];

/** Preview my Ride (quiet in trip 2: no tip): Going | Return. */
const previewSpec = (selected = 'go') => () => ({ date: router.dates.trip2, selected, legs: [
  { id: 'go', label: 'Going', leg: 'trip2', option: goChosen(), moments: moments(goChosen(), { from: 'home77', to: 'fair', toLabel: 'Fair' }) },
  { id: 'back', label: 'Return', leg: 'trip2back', option: backChosen(), moments: moments(backChosen(), { from: 'fair', to: 'home77', toLabel: 'Home', fromLabel: 'the fair' }) },
] });

/** The demo follows the Recommended buses (the story's times are set around them). */
async function keepRecommended(group, list) {
  const rec = list.find(o => o.recommended);
  await ui.modal({ icon: 'bus', title: `Let’s take the ${formatTime(rec.depart).replace(/ [AP]M$/, '')}`, text: 'The demo follows the Recommended bus.' });
  group.set(rec.id);
}

// ---------- Intro, Home, Destination ----------

screen('t2.intro', {
  detent: 'half',
  render: ctx => {
    ctx.body.innerHTML = `${head(ctx, 'Trip 2 · Book ahead', { eyebrow: '' })}
      <p class="muted">${ui.esc(`${day()}, 2027 · Downtown is busy.`)}</p>
      <div class="actions">${ui.button({ label: 'Start', attrs: 'data-primary' })}</div>`;
  },
});

screen('t2.home', {
  detent: 'peek',
  render: ctx => {
    ctx.body.innerHTML = `${head(ctx, 'Where to?', { srOnly: true })}
      <button type="button" class="search search-btn" data-search data-primary>${ui.icon('search')}<span>Where to?</span></button>
      <div class="chips"><span class="chip static">${ui.icon('cal', 'i s')}Today</span><span class="chip static sel">${ui.icon('stop', 'i s')}Arrive by ${formatTime(arriveBy)}</span></div>`;
  },
});

screen('t2.destination', {
  detent: 'full',
  render: ctx => {
    ctx.body.innerHTML = `${head(ctx, 'Where to?')}
      ${ui.search({ placeholder: 'Search a place' })}
      <h2 class="section-label">Suggested</h2>
      <div class="place-list">
        ${ui.listRow({ icon: 'pin', label: 'Fair', sub: 'Near the marina', attrs: 'data-place="fair" data-match="fair near the marina 4th of july"' })}
        ${ui.listRow({ icon: 'home', label: 'Home', sub: '77 Sesame Street · You’re here', chevron: false, attrs: 'aria-disabled="true" data-match="home 77 sesame street"' })}
      </div>
      <p class="muted empty-hint" hidden>No match. Try “fair”.</p>`;
    const input = ctx.body.querySelector('input'), hint = ctx.body.querySelector('.empty-hint');
    const filter = () => {
      const q = input.value.trim().toLowerCase();
      let any = false;
      for (const row of ctx.body.querySelectorAll('[data-match]')) { const show = !q || row.dataset.match.includes(q); row.hidden = !show; any ||= show; }
      hint.hidden = any;
    };
    input.value = 'fair';            // the search is already typed: "fair" finds the fair
    filter();
    input.addEventListener('input', filter);
    ctx.body.querySelector('[data-place="fair"]').addEventListener('click', () => { trip().destination = 'fair'; ctx.next(); });
  },
  complete: s => { s.trips[2].destination = 'fair'; },
});

// ---------- Options (M5), Ride back, Review ----------

screen('t2.options', {
  detent: 'full',
  render: ctx => {
    const list = going(), sel = goChosen();
    trip().optionId = sel.id;
    ctx.body.innerHTML = `<div class="dest-head">${ctx.canGoBack ? ui.roundButton({ icon: 'left', label: 'Back', attrs: 'data-back' }) : ''}
        <div><h1 tabindex="-1" data-step-heading>Fair · near the marina</h1><p class="muted">Arrive by ${formatTime(arriveBy)} · ${ui.esc(day())}</p></div></div>
      ${optionCards(list, sel.id)}
      <div class="actions">${ui.button({ label: '', attrs: 'data-choose' })}</div>`;
    const btn = ctx.body.querySelector('[data-choose]');
    const label = () => { const o = list.find(x => x.id === trip().optionId); btn.querySelector('span').textContent = `Choose ${o.times[0]} · ${o.fare}`; };
    const group = ui.radioGroup(ctx.body.querySelector('.opts'), id => { trip().optionId = id; label(); });
    label();
    btn.addEventListener('click', () => (goChosen().recommended ? ctx.next() : keepRecommended(group, list)));
  },
  complete: s => { s.trips[2].optionId = going().find(o => o.recommended).id; },
});

screen('t2.return', {
  detent: 'half',
  render: ctx => {
    const list = back();
    ctx.body.innerHTML = `${head(ctx, 'Ride back')}
      ${ui.listRow({ icon: 'plus', label: 'Add a ride back', sub: 'To 77 Sesame Street, tonight', chevron: false, attrs: 'data-add' })}
      <div data-back-options hidden>
        <div class="chips"><span class="chip static sel">${ui.icon('clock', 'i s')}Leave after ${formatTime(leaveAfter)}</span></div>
        ${optionCards(list, backChosen().id, { label: 'Ways back' })}
        <div class="actions">${ui.button({ label: '', attrs: 'data-choose' })}</div>
      </div>`;
    const add = ctx.body.querySelector('[data-add]'), box = ctx.body.querySelector('[data-back-options]');
    const btn = ctx.body.querySelector('[data-choose]');
    const label = () => { const o = list.find(x => x.id === trip().returnId); btn.querySelector('span').textContent = `Add the ${formatTime(o.depart)} ride back`; };
    const open = () => {
      trip().returnId ||= list.find(o => o.recommended).id;
      add.hidden = true; box.hidden = false; label();
      ctx.sheet.set('full');
      box.querySelector('.opt[aria-checked="true"]')?.focus({ preventScroll: true });
    };
    const group = ui.radioGroup(box.querySelector('.opts'), id => { trip().returnId = id; label(); });
    add.addEventListener('click', open);
    if (trip().returnId) open();   // coming Back here: the ride back is already added
    btn.addEventListener('click', () => (backChosen().recommended ? ctx.next() : keepRecommended(group, list)));
  },
  complete: s => { s.trips[2].returnId = back().find(o => o.recommended).id; },
});

const legRow = (label, o, from, to) => `<li><span class="row-ic">${ui.icon('bus')}</span><span class="grow">
  <span class="t tab">${ui.esc(label)} · ${o.times.join(' → ')}</span><span class="s">${ui.routeChip(o.routeShort)} ${ui.esc(from)} to ${ui.esc(to)}</span></span></li>`;

screen('t2.review', {
  detent: 'half',
  render: ctx => {
    const go = goChosen(), bk = backChosen();
    ctx.body.innerHTML = `${head(ctx, 'Review')}
      <ul class="review-list">
        ${legRow('Going', go, 'Commons', 'Union St')}
        ${legRow('Return', bk, 'Hall St', 'Commons')}
        <li><span class="row-ic">${ui.icon('ticket')}</span><span class="grow"><span class="t">Total</span><span class="s">Both rides</span></span><span class="opt-price free">Free</span></li>
      </ul>
      <div class="actions">${ui.button({ label: 'Book · Free', attrs: 'data-book' })}${previewButton()}</div>
      <p class="fine">Booking holds your spot.</p>`;
    wirePreview(ctx, previewSpec());
    ctx.body.querySelector('[data-book]').addEventListener('click', () => {
      // Free: no Pay step. You're already signed in from trip 1.
      trip().booking = { code: tripCode(), optionId: go.id, returnId: bk.id, method: 'free', paidCents: 0 };
      ui.announce('Booked. Both rides are free.');
      ctx.next();
    });
  },
  complete: s => { s.trips[2].booking = { code: 'B7X-4KM', optionId: going().find(o => o.recommended).id, returnId: back().find(o => o.recommended).id, method: 'free', paidCents: 0 }; },
});

// ---------- Booked (M6) and waiting ----------

screen('t2.booked', {
  detent: 'full',
  render: ctx => {
    ctx.body.innerHTML = `<div class="done-head"><span class="done-check" aria-hidden="true">${ui.icon('check')}</span>
        <div><h1 tabindex="-1" data-step-heading>You’re booked</h1><p class="muted">${ui.esc(day())} · Bayline · Free</p></div></div>
      <p class="muted booked-note">Booking holds your spot.</p>
      ${ui.tripTimeline({ legs: legs(), selected: 'go', expanded: true })}
      <div class="code-row"><span class="muted">Trip code</span><span class="code tab">${ui.esc(trip().booking?.code || '')}</span></div>
      <div class="actions">${ui.button({ label: 'Where’s my ride', attrs: 'data-primary' })}${previewButton()}</div>`;
    wirePreview(ctx, previewSpec());
    return ui.wireTripTimeline(ctx.body.querySelector('.trip-tl'));
  },
});

screen('t2.skip', {
  detent: 'half',
  render: ctx => {
    const o = goChosen();
    ctx.body.innerHTML = `${head(ctx, 'Where’s my ride', { srOnly: true })}${rideCard(o)}
      ${ui.tripTimeline({ legs: legs(), selected: 'go' })}
      <div class="actions">${ui.button({ label: 'Skip to 11:06 AM', kind: 'demo', attrs: 'data-demo' })}${previewButton()}</div>`;
    wirePreview(ctx, previewSpec());
    const offTl = ui.wireTripTimeline(ctx.body.querySelector('.trip-tl'));
    const offLive = liveRide(ctx.body, o, { where: `Bayline · ${stopName(o.board)}` });
    return () => { offTl(); offLive(); };
  },
});

// ---------- the going leg, live (shared screens) ----------

rideSteps({
  ids: { ride: 't2.ride', walk: 't2.walk', stop: 't2.stop', board: 't2.board', onboard: 't2.onboard' },
  option: goChosen,
  timeline: () => ({ legs: legs(), selected: 'go' }),
  preview: previewSpec('go'),
  fareText: () => 'Free',
  passRoom: true,
  code: () => trip().booking?.code || '',
  date: () => router.dates.trip2,
});

// ---------- At the fair → skip to the evening ----------

screen('t2.arrived', {
  detent: 'half',
  render: ctx => {
    const o = goChosen(), early = arriveBy - o.arrive;
    ctx.body.innerHTML = `${head(ctx, 'You’re at the fair')}
      <p class="big-time"><strong class="tab">${formatTime(o.arrive)}</strong> <span>${early > 0 ? `${early} min early` : 'On time'}</span></p>
      ${ui.tripTimeline({ legs: legs(), selected: 'back' })}
      <div class="actions">${ui.button({ label: 'Skip to 6:44 PM', kind: 'demo', attrs: 'data-demo' })}</div>`;
    return ui.wireTripTimeline(ctx.body.querySelector('.trip-tl'));
  },
});

// ---------- the ride back, live (shared screens) ----------

rideSteps({
  ids: { ride: 't2.rideBack', walk: 't2.walkBack', stop: 't2.stopBack', board: 't2.boardBack', onboard: 't2.onboardBack' },
  option: backChosen,
  timeline: () => ({ legs: legs(), selected: 'back' }),
  preview: previewSpec('back'),
  fareText: () => 'Free',
  passRoom: true,
  code: () => trip().booking?.code || '',
  date: () => router.dates.trip2,
});

// ---------- Home ----------

screen('t2.home2', {
  detent: 'full',
  render: ctx => {
    const o = backChosen();
    ctx.body.innerHTML = `${head(ctx, 'Home')}
      <p class="big-time"><strong class="tab">${formatTime(o.arrive)}</strong> <span>Both rides done</span></p>
      ${ui.tripTimeline({ legs: legs(), selected: 'back', expanded: true })}
      <div class="actions">${ui.button({ label: 'Next: Trip 3', attrs: 'data-primary' })}</div>`;
    return ui.wireTripTimeline(ctx.body.querySelector('.trip-tl'));
  },
});

// ---------- tips: only what's new in trip 2 (plan 2·2 §4) ----------
Object.assign(TIPS, {
  't2.intro': [{ target: '[data-primary]', text: 'Next: book a trip for later today.' }],
  't2.options': [{ target: '.opt[aria-checked="true"] .badge.amber', text: 'Busy day? You’ll see when a bus is nearly full.' }],
  't2.return': [{ target: '[data-add]', text: 'Add your ride back now. Done and out of the way.' }],
  't2.review': [{ target: '[data-book]', text: 'Bayline is free. Booking still holds your spot.' }],
  't2.booked': [{ target: '.trip-tl .seg', text: 'Both trips are here. Tap to switch.' }],
  't2.skip': [{ target: '[data-demo]', text: 'Demo: skip ahead to your trip.' }],
  't2.arrived': [{ target: '[data-demo]', text: 'Demo: skip to your ride back.' }],
  't2.home2': [{ target: '[data-primary]', text: 'Next: plan a big trip a week ahead.' }],
});
