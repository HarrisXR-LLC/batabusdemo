// The prelude pages (mockup B2 "Chapter title, calmer", approved 2026-10-19): the Welcome note, a
// "Trip Demo N of 3" page before each trip, and the "Thank you" page at the end. Each is a full page in the
// sheet (page mode: it covers the map, under the top bar), and its lines fade in one after another.
// The scope of each trip is its last bullet: Trip Demo 1 is the pilot proposal; 2 and 3 are future upgrades.
// All the words live here, in short Simplified Technical English sentences.
import * as ui from './ui.js';

const PILOT = '<span class="hl pilot">pilot</span>', FUTURE = '<span class="hl vision">future upgrades</span>';
const SCOPE = { pilot: ['scope pilot', 'Part of the pilot proposal.'], vision: ['scope vision', 'A future upgrade. Not in the pilot.'] };
export const TRIPS = {
  1: { title: 'Book now', scope: 'pilot', lines: ['Your car is in the shop. You are new to BATA.', 'You find your bus, then book and pay in one tap.', 'You watch your bus come on the live map.'] },
  2: { title: 'Book ahead', scope: 'vision', lines: ['It is July 4, and downtown is busy.', 'In the morning, you book a ride to the fair and back.', 'You see when a bus is almost full.'] },
  3: { title: 'Plan ahead', scope: 'vision', lines: ['Your flight is at 11:00 AM next week.', 'You book a Link van to the airport, 7 days ahead.', 'You preview each step before you go.'] },
};
const NOTE = ['This is an interactive demo.', `It shows the ${PILOT} and ${FUTURE}.`, 'It is designed for riders on a phone.'];
const THANKS = ['Riders know which bus to take, and when to leave.', 'They watch their bus come to them, live.',
  'One easy first trip makes the bus a real choice.', 'Riders who trust the bus tell family and friends.'];
const CONTACT = { name: 'Aaron Harris · HarrisXR', email: 'aaron@harrisxr.com', phone: '616-216-8641', tel: '+16162168641' };

// ---------- the fade-in: each line rises into place in turn; tips wait until it's done ----------
const STEP_MS = 70, START_MS = 150, RISE_MS = 500;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let revealUntil = 0;
/** Resolves once the page's lines are in place, so a tip's spotlight lands where the button stops. */
export const revealed = () => new Promise(r => setTimeout(r, Math.max(0, revealUntil - performance.now())));
const rv = (k, cls = '') => `class="rv${cls ? ` ${cls}` : ''}" style="--k:${k}"`;
const bullets = (items, from) => `<ul class="plist">${items.map((it, k) => {
  const [cls, html] = Array.isArray(it) ? it : ['', it];
  return `<li ${rv(from + k, cls)}><span>${html}</span></li>`;   // one span: highlighted words stay inline
}).join('')}</ul>`;
const start = (label, k) => `<div ${rv(k, 'actions')}>${ui.button({ label, attrs: 'data-primary' })}</div>`;

/** Fill the sheet with a page and put the sheet in page mode until the step leaves. Returns the cleanup. */
function page(ctx, html, lastK) {
  const screen = document.getElementById('screen');
  ctx.body.innerHTML = `<div class="prelude">${html}</div>`;
  screen.dataset.page = '';
  revealUntil = reduced.matches ? 0 : performance.now() + START_MS + lastK * STEP_MS + RISE_MS;
  return () => { delete screen.dataset.page; };
}

export function welcomePage(ctx) {
  return page(ctx, `<p ${rv(1, 'p-mark')} aria-hidden="true">bata<span class="dot"></span><span class="go">go</span></p>
    <h1 tabindex="-1" data-step-heading ${rv(2)}>Your bus, made simple.</h1>
    <div ${rv(3, 'p-note')}><p class="p-label">Note</p>${bullets(NOTE, 4)}</div>${start('Start', 7)}`, 7);
}

export function tripPage(ctx, n) {
  const t = TRIPS[n];
  return page(ctx, `<div ${rv(1, 'p-sect')} aria-hidden="true"><span class="p-num">${n}</span><p class="eyebrow">Trip Demo ${n} of 3</p></div>
    <h1 tabindex="-1" data-step-heading ${rv(2, 'p-title')}><span class="sr-only">Trip Demo ${n} of 3: </span>${t.title}</h1><div ${rv(2, 'p-rule')}></div>
    ${bullets([...t.lines, SCOPE[t.scope]], 3)}${start('Start', 8)}`, 8);
}

export function thanksPage(ctx) {
  return page(ctx, `<h1 tabindex="-1" data-step-heading ${rv(1, 'p-thanks')}>Thank you</h1><div ${rv(2, 'p-rule')}></div>${bullets(THANKS, 3)}
    <div ${rv(7, 'p-contact')}><p class="p-ask">Let’s talk about your riders</p><p class="p-name">${CONTACT.name}</p>
      <p class="p-row">${ui.icon('mail', 'i s')}<a href="mailto:${CONTACT.email}">${CONTACT.email}</a></p>
      <p class="p-row">${ui.icon('phone', 'i s')}<span>${CONTACT.phone} · <a href="sms:${CONTACT.tel}" aria-label="Text ${CONTACT.phone}">Text</a> or <a href="tel:${CONTACT.tel}" aria-label="Call ${CONTACT.phone}">call</a></span></p></div>
    ${start('Restart', 8)}`, 8);
}
