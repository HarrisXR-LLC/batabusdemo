// Trip 1 · Book now (plan 2·1): from Welcome to "You're here" on real Route 07 times.
// 7:40 book at 123 Sesame Street → 7:46 leave → 7:50 at Meijer Park and Ride → 7:52 your bus is here
// → 8:00 leaves → 8:05 Grand Traverse Mall North Entrance → 8:07 at work, 23 min early.
// Every screen renders into the sheet; the map scene for each step comes from scene.js. The live ride
// screens (Where's my ride → walk → stop → pass → on board) are shared: common.js rideSteps().
import { router } from '../router.js';
import { state } from '../state.js';
import { formatTime, toMinutes } from '../story.js';
import { serviceFor } from '../data.js';
import { options as engineOptions, tripCode, cancelBy, formatFare } from '../engine.js';
import { CONFIG } from '../config.js';
import { TIPS } from '../steps.js';
import { mapSettled } from '../map.js';
import * as ui from '../ui.js';
import * as pay from '../pay.js';
import { moments } from '../preview.js';
import { head as baseHead, screen, stopName, optionCards, legItems, rideSteps, previewButton, wirePreview } from './common.js';

const EYEBROW = 'Trip 1 · Book now';
const trip = () => state.trips[1];
const list = () => engineOptions('trip1', { service: serviceFor(router.dates.trip1) });
const recommended = () => list().find(o => o.recommended);
const chosen = () => list().find(o => o.id === trip().optionId) || recommended();
const arriveBy = toMinutes(CONFIG.requests.trip1.arriveBy);
const head = (ctx, title, opts = {}) => baseHead(ctx, title, { eyebrow: EYEBROW, ...opts });
/** Preview my Ride (quiet in trip 1: no tip). */
const previewSpec = () => ({ date: router.dates.trip1, legs: [{ id: 'go', label: 'Going', leg: 'trip1', option: chosen(),
  moments: moments(chosen(), { from: 'home123', to: 'work', toLabel: 'Work', arriveNote: `${arriveBy - chosen().arrive} min early` }) }] });

// ---------- Welcome, Home, Destination ----------

screen('welcome', {
  detent: 'half',
  render: ({ body }) => {
    body.innerHTML = `<div class="welcome">
      <p class="welcome-mark" aria-hidden="true">bata<span class="dot"></span><span class="go">go</span></p>
      <h1 tabindex="-1" data-step-heading>Your bus, made simple.</h1>
      <p class="muted">Three short trips show how it works.</p>
      <div class="actions">${ui.button({ label: 'Start', attrs: 'data-primary' })}</div></div>`;
  },
});

screen('t1.home', {
  detent: 'peek',
  render: ctx => {
    ctx.body.innerHTML = `${head(ctx, 'Where to?', { srOnly: true })}
      <button type="button" class="search search-btn" data-search data-primary>${ui.icon('search')}<span>Where to?</span></button>
      <div class="chips"><span class="chip static">${ui.icon('clock', 'i s')}Now</span><span class="chip static sel">${ui.icon('stop', 'i s')}Arrive by ${formatTime(arriveBy)}</span></div>
      ${ui.listRow({ icon: 'work', label: 'Work', sub: 'Grand Traverse Mall', attrs: 'data-place="work"' })}`;
    ctx.body.querySelector('[data-place="work"]').addEventListener('click', () => { trip().destination = 'work'; router.go('t1.options'); });
  },
});

screen('t1.destination', {
  detent: 'full',
  render: ctx => {
    ctx.body.innerHTML = `${head(ctx, 'Where to?')}
      ${ui.search({ placeholder: 'Search a place' })}
      <h2 class="section-label">Saved</h2>
      <div class="place-list">
        ${ui.listRow({ icon: 'work', label: 'Work', sub: 'Grand Traverse Mall', attrs: 'data-place="work" data-match="work grand traverse mall"' })}
        ${ui.listRow({ icon: 'home', label: 'Home', sub: '123 Sesame Street · You’re here', chevron: false, attrs: 'aria-disabled="true" data-match="home 123 sesame street"' })}
      </div>
      <p class="muted empty-hint" hidden>No match. Try “Work”.</p>`;
    const input = ctx.body.querySelector('input'), hint = ctx.body.querySelector('.empty-hint');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      let any = false;
      for (const row of ctx.body.querySelectorAll('[data-match]')) { const show = !q || row.dataset.match.includes(q); row.hidden = !show; any ||= show; }
      hint.hidden = any;
    });
    ctx.body.querySelector('[data-place="work"]').addEventListener('click', () => { trip().destination = 'work'; ctx.next(); });
  },
  complete: s => { s.trips[1].destination = 'work'; },
});

// ---------- Options and Review ----------

screen('t1.options', {
  detent: 'half',
  render: ctx => {
    const opts = list(), sel = chosen();
    trip().optionId = sel.id;
    ctx.body.innerHTML = `<div class="dest-head">${ctx.canGoBack ? ui.roundButton({ icon: 'left', label: 'Back', attrs: 'data-back' }) : ''}
        <div><h1 tabindex="-1" data-step-heading>Grand Traverse Mall</h1><p class="muted">Arrive by ${formatTime(arriveBy)} · Today</p></div></div>
      ${optionCards(opts, sel.id)}
      <div class="actions">${ui.button({ label: '', attrs: 'data-choose' })}</div>`;
    const btn = ctx.body.querySelector('[data-choose]');
    const label = () => { const o = list().find(x => x.id === trip().optionId); btn.querySelector('span').textContent = `Choose ${o.name} · ${o.fare}`; };
    const group = ui.radioGroup(ctx.body.querySelector('.opts'), id => { trip().optionId = id; label(); });
    label();
    btn.addEventListener('click', async () => {
      if (chosen().kind === 'link') {   // the demo rides Link in trip 3; trip 1 is the bus
        await ui.modal({ icon: 'van', title: 'Link comes in trip 3', text: 'This trip shows the bus.' });
        group.set(recommended().id);
        return;
      }
      ctx.next();
    });
  },
  complete: s => { s.trips[1].optionId = recommended().id; },
});

screen('t1.review', {
  detent: 'half',
  render: ctx => {
    const o = chosen();
    ctx.body.innerHTML = `${head(ctx, 'Review')}
      <ul class="review-list">
        <li><span class="row-ic">${ui.icon('walk')}</span><span class="grow"><span class="t">Leave by ${formatTime(o.leaveBy)}</span><span class="s">Walk ${o.walkMin} min to ${ui.esc(stopName(o.board))}</span></span></li>
        <li><span class="row-ic">${ui.icon('bus')}</span><span class="grow"><span class="t tab">${o.times.join(' → ')}</span><span class="s">${ui.routeChip(o.routeShort)} to Grand Traverse Mall</span></span></li>
        <li><span class="row-ic">${ui.icon('card')}</span><span class="grow"><span class="t">Payment</span><span class="s">${state.user.card ? `Card ${state.user.card}` : 'Card or wallet, next'}</span></span></li>
      </ul>
      <div class="actions">${ui.button({ label: `Book & pay · ${o.fare}`, attrs: 'data-book' })}${previewButton()}</div>
      <p class="fine">Same fare as on the bus.</p>`;
    wirePreview(ctx, previewSpec);
    ctx.body.querySelector('[data-book]').addEventListener('click', () => (state.user.signedIn ? router.go('t1.pay') : ctx.next()));
  },
});

// ---------- Sign in and Pay ----------

screen('t1.signin', {
  detent: 'full',
  render: ctx => {
    const done = state.user.signedIn;
    ctx.body.innerHTML = `${head(ctx, 'Sign in')}
      <p class="muted">Demo only. No real details needed.</p>
      ${pay.signinFields(done ? pay.DEMO_USER : null)}
      <div class="actions">${ui.button({ label: 'Auto fill', kind: 'demo', attrs: 'data-autofill' })}${ui.button({ label: 'Continue', attrs: `data-continue${done ? '' : ' disabled'}` })}</div>`;
    const fill = ctx.body.querySelector('[data-autofill]'), go = ctx.body.querySelector('[data-continue]');
    fill.addEventListener('click', async () => {
      fill.disabled = true;
      await pay.autoFill(ctx.body, pay.DEMO_USER);
      Object.assign(state.user, { signedIn: true, ...pay.DEMO_USER });
      go.disabled = false;
      go.focus({ preventScroll: true });
    });
    go.addEventListener('click', () => ctx.next());
  },
  complete: s => { Object.assign(s.user, { signedIn: true, ...pay.DEMO_USER }); },
});

async function book(ctx, method) {
  const o = chosen();
  const ok = await pay.confirmPayment(method === 'card' ? null : method, { amount: o.fare, what: `bata go · ${o.name}` });
  if (!ok) return;
  trip().booking = { code: tripCode(), optionId: o.id, method, paidCents: o.fareCents };
  if (method === 'card') state.user.card = `•••• ${pay.DEMO_CARD.last4}`;
  else state.user.wallet = method;
  ctx.next();
}

screen('t1.pay', {
  detent: 'full',
  render: ctx => {
    const o = chosen(), filled = !!state.user.card;
    ctx.body.innerHTML = `<div class="title-row">${ctx.canGoBack ? ui.roundButton({ icon: 'left', label: 'Back', attrs: 'data-back' }) : ''}
        <h1 class="grow" tabindex="-1" data-step-heading>Pay</h1><span class="amount tab">${o.fare}</span></div>
      <p class="muted">${ui.esc(`${o.name} · ${formatTime(o.depart)} · ${stopName(o.board)}`)}</p>
      <div class="label-row"><h2 class="section-label">Card</h2><span data-filled ${filled ? '' : 'hidden'}>${ui.badge({ text: '(DEMO) Auto filled', tone: 'ok', icon: 'check' })}</span></div>
      ${pay.cardFields(filled)}
      <div class="actions">${ui.button({ label: 'Auto fill', kind: 'demo', attrs: `data-autofill${filled ? ' hidden' : ''}` })}</div>
      <h2 class="section-label">Or pay with</h2>
      ${pay.brandTiles()}
      <div class="actions">${ui.button({ label: `Pay ${o.fare}`, attrs: `data-pay${filled ? '' : ' disabled'}` })}</div>
      <p class="fine">Same fare as on the bus.</p>`;
    const fill = ctx.body.querySelector('[data-autofill]'), payBtn = ctx.body.querySelector('[data-pay]');
    fill.addEventListener('click', async () => {
      fill.disabled = true;
      await pay.autoFill(ctx.body, pay.DEMO_CARD);
      fill.hidden = true;
      ctx.body.querySelector('[data-filled]').hidden = false;
      payBtn.disabled = false;
      payBtn.focus({ preventScroll: true });
    });
    payBtn.addEventListener('click', () => book(ctx, 'card'));
    for (const t of ctx.body.querySelectorAll('[data-brand]')) t.addEventListener('click', () => book(ctx, t.dataset.brand));
  },
  complete: s => {
    s.trips[1].booking = { code: 'K7P-4QX', optionId: recommended().id, method: 'card', paidCents: recommended().fareCents };
    s.user.card = `•••• ${pay.DEMO_CARD.last4}`;
  },
});

// ---------- Booked ----------

screen('t1.booked', {
  detent: 'half',
  render: ctx => {
    const o = chosen(), b = trip().booking;
    ctx.body.innerHTML = `<div class="done-head"><span class="done-check" aria-hidden="true">${ui.icon('check')}</span>
        <div><h1 tabindex="-1" data-step-heading>You’re booked</h1><p class="muted">${formatTime(o.depart)} · ${ui.esc(stopName(o.board))}</p></div></div>
      <div class="code-row"><span class="muted">Trip code</span><span class="code tab">${ui.esc(b?.code || '')}</span></div>
      <p class="fine">Cancel by ${formatTime(cancelBy(o))}</p>
      <div class="actions">${ui.button({ label: 'Where’s my ride', attrs: 'data-primary' })}${previewButton()}</div>`;
    wirePreview(ctx, previewSpec);
  },
});

rideSteps({
  ids: { ride: 't1.ride', walk: 't1.walk', stop: 't1.stop', board: 't1.board', onboard: 't1.onboard' },
  option: chosen,
  timeline: () => ({ legs: [{ id: 'go', label: 'Going', items: legItems(chosen(), { toText: 'At work', toIcon: 'work' }, state.story.clock) }] }),
  fareText: o => `Paid · ${o.fare}`,
  code: () => trip().booking?.code || '',
  date: () => router.dates.trip1,
  preview: previewSpec,
});

// ---------- You're here ----------

screen('t1.arrived', {
  detent: 'half',
  render: ctx => {
    const o = chosen(), early = arriveBy - o.arrive;
    ctx.body.innerHTML = `${head(ctx, 'You’re here', { eyebrow: EYEBROW })}
      <p class="big-time"><strong class="tab">${formatTime(o.arrive)}</strong> <span>${early > 0 ? `${early} min early` : 'On time'}</span></p>
      <p class="muted">${ui.esc(`${o.name} · ${formatFare(o.fareCents)} · ${o.doorToDoor} min door to door`)}</p>
      <div class="actions">${ui.button({ label: 'Next: Trip 2', attrs: 'data-primary' })}</div>`;
  },
});

// ---------- tips: real targets (plan 2·1 §4); the walker tip waits for the map ----------
Object.assign(TIPS, {
  'welcome': [{ target: '[data-primary]', text: 'Tips like this will guide you. Tap OK.' }],
  't1.home': [{ target: '[data-search]', text: 'Like a ride app: start with where you’re going.' }],
  't1.destination': [{ target: '[data-place="work"]', text: 'Pick a place. Your usual spots are saved.' }],
  't1.options': [{ target: '.opt[aria-checked="true"]', text: 'Real BATA times. Our pick says Recommended.' }],
  't1.review': [{ target: '[data-book]', text: 'One tap books and pays. Same fare as on the bus.' }],
  't1.signin': [{ target: '[data-autofill]', text: 'Demo: tap Auto fill. No real details needed.' }],
  't1.pay': [{ target: '.brand-tiles', text: 'Pay your way: card, wallet, Cash App, Venmo or Zelle.' }],
  't1.booked': [{ target: '[data-primary]', text: 'Done. Now just catch your bus.' }],
  't1.ride': [{ target: '.veh-card', text: 'See your bus live, like a rideshare.' }],
  't1.walk': [{ target: '.walker-fig', text: 'Walk to your stop. Your bus time stays live.', ready: mapSettled }],
  't1.stop': [{ target: '[data-demo]', text: 'Demo: skip ahead to watch it arrive.' }],
  't1.board': [{ target: '.pass-qr', text: 'Show your pass to the driver. That’s it.' }],
  't1.onboard': [{ target: '.stops-left', text: 'Ride along. We’ll tell you when to get off.' }],
  't1.arrived': [{ target: '[data-primary]', text: 'Next: book ahead for later in the day.' }],
});
