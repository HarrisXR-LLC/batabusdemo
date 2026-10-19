// Kit gallery (plan 1·2 §6, §8 step 4): every UI kit part on one sheet, for visual checks.
// Hidden QA page, never linked in the UI:
//   ?kit=1                       the gallery
//   ?kit=1&at=<section>          scroll to a section (buttons, inputs, fields, badges, options, timeline, vehicle, overlays, nav)
//   ?kit=1&tip=<case>            put the tutorial through its placements:
//       above  message above the search field, arrow down        below  auto on the clock chip, arrow up
//       left   message left of the ⓘ button, arrow right          right  message right of the Back button, arrow left
//       corner left of the bottom-right Next, buttons clamped    bottom auto on the main button, near the footer
//       none   no target: centered, no arrow
//   ?kit=1&show=pill|banner|modal  open an overlay part
import { state } from './state.js';
import { clock, storyDates } from './story.js';
import { tour } from './tour.js';
import * as ui from './ui.js';

const TIP_CASES = {
  above:  { target: '[data-kit="search"]', side: 'above', detent: 'half', text: 'Like a ride app: start with where you’re going.' },
  below:  { target: '[data-clock]', detent: 'peek', text: 'The story clock. Times are Traverse City time.' },
  left:   { target: '#about-btn', side: 'left', detent: 'peek', text: 'About this demo, any time.' },
  right:  { target: '[data-kit="back"]', side: 'right', detent: 'half', text: 'Go back one step.' },
  corner: { target: '[data-kit="next"]', side: 'left', detent: 'full', text: 'Drag, or tap Next, to see each step.' },
  bottom: { target: '[data-kit="main"]', detent: 'full', text: 'One main button per screen.' },
  none:   { target: null, detent: 'half', text: 'Tips like this will guide you. Tap OK.' },
};

function html() {
  const t = (a, b) => [a, b];
  return `<div class="kit">
  <div class="step-head">${ui.roundButton({ icon: 'left', label: 'Back', attrs: 'data-kit="back"' })}
    <div class="grow"><p class="eyebrow">QA</p><h1 tabindex="-1" data-step-heading>UI kit</h1></div></div>

  <section id="buttons"><h2 class="section-label">Buttons</h2><div class="stack">
    ${ui.button({ label: 'Book & pay $1.50' })}
    ${ui.button({ label: 'Add to Google Wallet', kind: 'secondary' })}
    ${ui.button({ label: 'Skip to 11:06 AM', kind: 'demo' })}
    ${ui.button({ label: 'Preview my Ride', kind: 'text', icon: 'play' })}
    <div class="wrap">${ui.roundButton({ icon: 'left', label: 'Back' })}${ui.roundButton({ icon: 'right', label: 'Next' })}${ui.roundButton({ icon: 'play', label: 'Play' })}</div>
  </div></section>

  <section id="inputs"><h2 class="section-label">Search, chips, rows</h2>
    ${ui.search({ attrs: 'data-kit="search"' })}
    <div class="chips">${ui.chip({ label: 'Now', icon: 'clock', menu: true })}${ui.chip({ label: 'Arrive by 8:30 AM', icon: 'stop', menu: true, selected: true })}</div>
    ${ui.chipRow([ui.chip({ label: 'Today', radio: true }), ui.chip({ label: 'Tomorrow', radio: true }), ui.chip({ label: 'Mon, Oct 26', radio: true, selected: true }), ui.chip({ label: 'Tue, Oct 27', radio: true })], 'Day', { fade: true })}
    ${ui.listRow({ icon: 'work', label: 'Work', sub: 'Grand Traverse Mall' })}
    ${ui.listRow({ icon: 'card', label: 'Card', value: '•••• 3456' })}
  </section>

  <section id="fields"><h2 class="section-label">Read-only fields</h2><div class="stack">
    ${ui.field({ label: 'Name on card', value: 'JOHN DOE' })}
    ${ui.field({ label: 'Card number', value: '1234 5678 9012 3456' })}
    <div class="fields-3">${ui.field({ label: 'Expires', value: '12/30' })}${ui.field({ label: 'CVC', value: '123' })}${ui.field({ label: 'ZIP', value: '' })}</div>
  </div></section>

  <section id="badges"><h2 class="section-label">Routes and room</h2>
    <div class="wrap">${ui.routeChip('07')}${ui.routeChip('Bayline')}${ui.routeChip('14')}${ui.routeChip('Link', { bg: '#507500', fg: '#FFFFFF' })}</div>
    <div class="wrap" style="margin-top:8px">${ui.roomBadge('plenty')}${ui.roomBadge('filling')}${ui.roomBadge('almost', 4)}${ui.badge({ text: 'Paid · $1.50', tone: 'ok', icon: 'check' })}</div>
  </section>

  <section id="options"><h2 class="section-label">Option cards</h2>
    ${ui.optionList([
      ui.optionCard({ id: 'a', times: t('11:13', '11:34 AM'), price: 'Free', name: 'Bayline', recommended: true, walkMin: 4, route: 'Bayline', room: { level: 'almost', seats: 4 }, selected: true }),
      ui.optionCard({ id: 'b', times: t('10:43', '11:04 AM'), price: 'Free', name: 'Bayline', walkMin: 4, route: 'Bayline', room: { level: 'filling' } }),
      ui.optionCard({ id: 'c', times: t('11:43 AM', '12:04 PM'), price: 'Free', late: true, note: 'Arrives after 11:45 AM' }),
    ])}
  </section>

  <section id="timeline"><h2 class="section-label">Segmented control, timeline</h2>
    ${ui.segmented({ items: [{ id: 'go', label: 'Going' }, { id: 'back', label: 'Return' }], selected: 'go', label: 'Trip' })}
    ${ui.timeline({ items: [
      { time: '11:06 AM', icon: 'walk', text: 'Walk to your stop', sub: 'Commons · 4 min', current: true },
      { time: '11:13 AM', icon: 'bus', text: 'Bayline to Union St' },
      { time: '11:34 AM', icon: 'walk', text: 'Walk to the fair' },
      { time: '11:37 AM', icon: 'pin', text: 'Fair · near the marina' },
    ] })}
    ${ui.timeline({ expanded: true, items: [
      { time: '8:35 AM', icon: 'van', text: 'Link van at your door', current: true },
      { time: '8:50 AM', icon: 'plane', text: 'Cherry Capital Airport' },
    ] })}
  </section>

  <section id="vehicle"><h2 class="section-label">Vehicle card, ETA</h2>
    ${ui.vehicleCard({ cls: 'full', route: '07', room: { level: 'plenty' } })}
    ${ui.bigEta({ value: '4 min', sub: 'Arrives 7:52 AM' })}
    <div style="margin-top:10px">${ui.vehicleCard({ cls: 'van', route: null, room: null })}</div>
  </section>

  <section id="overlays"><h2 class="section-label">Overlays</h2><div class="stack">
    ${ui.button({ label: 'Status pill', kind: 'secondary', attrs: 'data-show="pill"' })}
    ${ui.button({ label: 'Banner', kind: 'secondary', attrs: 'data-show="banner"' })}
    ${ui.button({ label: 'Modal', kind: 'secondary', attrs: 'data-show="modal"' })}
  </div></section>

  <section id="nav"><h2 class="section-label">Tips</h2>
    ${ui.button({ label: 'Show a tip', attrs: 'data-kit="main" data-show="tip"' })}
    <div class="between" style="margin-top:12px">${ui.roundButton({ icon: 'left', label: 'Back', attrs: 'data-kit="prev"' })}<span class="muted">Tip tests: ?tip=…</span>${ui.roundButton({ icon: 'right', label: 'Next', attrs: 'data-kit="next"' })}</div>
  </section>
</div>`;
}

const show = {
  pill: () => ui.statusPill('Your bus is on its way!'),
  banner: () => ui.banner({ title: 'Your bus is 5 min away', text: 'Route 07 · Meijer Park and Ride' }),
  modal: () => ui.modal({ icon: 'wallet', title: 'Coming soon in 2027!', text: 'Wallet passes are on the way.' }),
  tip: () => tour.show({ target: '[data-kit="main"]', text: 'One main button per screen.' }),
};

/** Render the gallery into the sheet. Resolves when it is settled (any requested tip is on screen). */
export async function start({ body, sheet }) {
  const params = new URLSearchParams(location.search);
  document.title = 'UI kit · bata go';
  clock.set('07:40', storyDates().trip1);
  body.innerHTML = html();
  for (const g of body.querySelectorAll('[role="radiogroup"]')) ui.radioGroup(g);
  for (const tl of body.querySelectorAll('.tl')) ui.wireTimeline(tl);
  body.addEventListener('click', e => {
    const el = e.target.closest('[data-show]');
    if (el) show[el.dataset.show]?.();
  });

  const tipCase = TIP_CASES[params.get('tip')];
  sheet.set(tipCase?.detent || params.get('sheet') || 'full');
  await new Promise(r => setTimeout(r, 340));   // let the sheet finish moving
  const at = params.get('at');
  const section = at && body.querySelector(`#${CSS.escape(at)}`);
  if (section) {   // scroll only the sheet (scrollIntoView could also shift the clipped screen)
    const k = body.getBoundingClientRect().height / body.clientHeight || 1;
    body.scrollTop += (section.getBoundingClientRect().top - body.getBoundingClientRect().top) / k - 4;
  }

  const overlay = params.get('show');
  if (overlay && overlay !== 'tip') show[overlay]?.();

  if (tipCase) {
    state.tour.enabled = true;
    await new Promise(resolve => { tour.show({ target: tipCase.target, side: tipCase.side, text: tipCase.text }, resolve); });
  }
}
