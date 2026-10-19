// Sign-in and payment (plan 2·1 §5.1–5.2), reused by trips 2 and 3.
//   - Every field is read-only; only "DEMO · Auto fill" fills them (a short type-in, instant with reduced
//     motion). No password or puzzle (WCAG 3.3.8); once signed in, later trips skip it (3.3.7).
//   - "Or pay with": Apple Pay, Google Pay, PayPal, Cash App, Venmo, Zelle (Simple Icons, CC0), this
//     device's own wallet first.
//   - Mock confirmations, about 1 s each, always inside our app; never an imitation of the phone's own
//     payment screens. Nothing is sent or stored.
import * as ui from './ui.js';

export const DEMO_USER = { name: 'JOHN DOE', email: 'john.doe@example.com', phone: '(231) 555-0100' };
export const DEMO_CARD = { cardName: 'JOHN DOE', number: '1234 5678 9012 3456', exp: '12/30', cvc: '123', zip: '49684', last4: '3456' };
const BRANDS = [
  { slug: 'applepay', title: 'Apple Pay', kind: 'wallet' }, { slug: 'googlepay', title: 'Google Pay', kind: 'wallet' },
  { slug: 'paypal', title: 'PayPal', kind: 'app' }, { slug: 'cashapp', title: 'Cash App', kind: 'app' },
  { slug: 'venmo', title: 'Venmo', kind: 'app' }, { slug: 'zelle', title: 'Zelle', kind: 'app' },
];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const wait = ms => new Promise(r => setTimeout(r, ms));
const logo = slug => `./assets/brands/${slug}.svg`;

/** This device's wallet first: Google Pay on Android, Apple Pay otherwise. */
export function brands() {
  const android = /Android/i.test(navigator.userAgent);
  return android ? [BRANDS[1], BRANDS[0], ...BRANDS.slice(2)] : BRANDS.slice();
}
export const brand = slug => BRANDS.find(b => b.slug === slug);

// ---------- fields ----------
// Read-only (nothing is typed or sent), but each says what it holds (autocomplete, WCAG 1.3.5).

export function signinFields(user = null) {
  return `<div class="stack fields">
    ${ui.field({ label: 'Name', value: user?.name || '', attrs: 'data-fill="name" autocomplete="name"' })}
    ${ui.field({ label: 'Email', value: user?.email || '', attrs: 'data-fill="email" autocomplete="email"' })}
    ${ui.field({ label: 'Phone', value: user?.phone || '', attrs: 'data-fill="phone" autocomplete="tel"' })}
  </div>`;
}

export function cardFields(card = null) {
  const v = k => (card ? DEMO_CARD[k] : '');
  return `<div class="stack fields">
    ${ui.field({ label: 'Name on card', value: v('cardName'), attrs: 'data-fill="cardName" autocomplete="cc-name"' })}
    ${ui.field({ label: 'Card number', value: v('number'), attrs: 'data-fill="number" autocomplete="cc-number"' })}
    <div class="fields-3">${ui.field({ label: 'Expires', value: v('exp'), attrs: 'data-fill="exp" autocomplete="cc-exp"' })}${ui.field({ label: 'CVC', value: v('cvc'), attrs: 'data-fill="cvc" autocomplete="cc-csc"' })}${ui.field({ label: 'ZIP', value: v('zip'), attrs: 'data-fill="zip" autocomplete="postal-code"' })}</div>
  </div>`;
}

/** Fill read-only fields with a short type-in effect. Resolves when done. */
export async function autoFill(root, values) {
  const inputs = [...root.querySelectorAll('[data-fill]')].filter(i => values[i.dataset.fill] != null);
  if (reducedMotion.matches) { for (const i of inputs) i.value = values[i.dataset.fill]; }
  else {
    for (const i of inputs) {
      const text = values[i.dataset.fill], step = Math.max(1, Math.ceil(text.length / 8));
      for (let n = step; n < text.length + step; n += step) { i.value = text.slice(0, n); await wait(18); }
    }
  }
  ui.announce('Filled in with demo details.');
}

export function brandTiles() {
  return `<div class="brand-tiles" role="group" aria-label="Or pay with">${brands().map(b =>
    `<button type="button" class="brand-tile${b.kind === 'wallet' ? ' wide' : ''}" data-brand="${b.slug}" aria-label="Pay with ${b.title}"><img src="${logo(b.slug)}" alt=""></button>`).join('')}</div>`;
}

// ---------- mock confirmations ----------

/**
 * Card: spinner → check. Apple/Google Pay: a small in-app sheet (logo, amount, Confirm) → spinner → check.
 * PayPal, Cash App, Venmo, Zelle: "Opening Venmo…" → "Approved" → back. Resolves true when paid.
 */
export function confirmPayment(method, { amount, what }) {
  return new Promise(resolve => {
    const b = brand(method), opener = document.activeElement;
    const layer = document.getElementById('overlay-layer');
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    const id = ui.newId('pay');
    scrim.innerHTML = `<div class="modal pay-sheet" role="dialog" aria-modal="true" aria-labelledby="${id}"><div class="pay-body"></div></div>`;
    layer.append(scrim);
    const restore = ui.isolate(layer), dialog = scrim.firstElementChild, body = dialog.querySelector('.pay-body');
    scrim.addEventListener('mousedown', e => { if (!e.target.closest('button')) e.preventDefault(); });
    const finish = ok => { scrim.remove(); restore(); if (!ok && opener?.isConnected) opener.focus({ preventScroll: true }); resolve(ok); };
    const head = b ? `<img class="pay-logo" src="${logo(b.slug)}" alt="${b.title}">` : `<span class="modal-ic" aria-hidden="true">${ui.icon('card')}</span>`;
    const show = (html, { busy = false, done = false } = {}) => {
      body.innerHTML = `${head}${html}${busy ? '<span class="spinner" aria-hidden="true"></span>' : ''}${done ? `<span class="pay-check" aria-hidden="true">${ui.icon('check')}</span>` : ''}`;
    };
    const status = text => { ui.announce(text); return `<h2 id="${id}">${ui.esc(text)}</h2>`; };
    const run = async steps => {
      dialog.tabIndex = -1;
      dialog.focus({ preventScroll: true });          // the Confirm button is about to be replaced
      for (const [html, opts, ms] of steps) { show(html(), opts); await wait(ms); }
      finish(true);
    };

    const paying = [[() => status(`Paying ${amount}…`), { busy: true }, 1000], [() => status('Paid'), { done: true }, 700]];
    if (!b) run(paying);
    else if (b.kind === 'app') run([[() => status(`Opening ${b.title}…`), { busy: true }, 1000], [() => status('Approved'), { done: true }, 800]]);
    else {
      show(`<h2 id="${id}">${ui.esc(amount)}</h2><p>${ui.esc(what)}</p>
        <div class="stack">${ui.button({ label: 'Confirm', attrs: 'data-ok' })}${ui.button({ label: 'Cancel', kind: 'text', attrs: 'data-cancel' })}</div>`);
      dialog.querySelector('[data-ok]').addEventListener('click', () => run(paying));
      dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
      dialog.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); finish(false); } else ui.trapTab(dialog, e); });
      dialog.querySelector('[data-ok]').focus({ preventScroll: true });
    }
  });
}
