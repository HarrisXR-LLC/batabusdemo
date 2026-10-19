// QR codes with the vendored qrcode-generator 1.4.4 (a classic script, added to the page on first use):
// the boarding pass (2·1) and, in framed mode, the caption's "open it on your phone" code (2·4).

let loading = null;
export function loadQR() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  loading ||= new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = './vendor/qrcode-generator-1.4.4/qrcode.js';
    s.onload = () => (window.qrcode ? ok(window.qrcode) : no(new Error('qrcode missing')));
    s.onerror = () => { loading = null; no(new Error('qrcode failed to load')); };
    document.head.append(s);
  });
  return loading;
}

/** An SVG string for text. opts: { cellSize, margin, scalable, title } (see createSvgTag). */
export async function qrSvg(text, opts = {}) {
  const q = (await loadQR())(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true, ...opts });
}

/** The page's own address without the query or "index.html": what a phone should open. */
export function pageUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

/**
 * Framed mode (desktop): a QR card beside the phone when the window has room, and a "Download QR (SVG)"
 * link in the caption for the landing page (2·4 §9). Phone mode never loads the library.
 */
export async function initFrameQR() {
  const card = document.getElementById('qr-card'), link = document.getElementById('qr-download');
  if (!card || !link || document.body.dataset.mode !== 'framed') return;
  try {
    const url = pageUrl();
    card.querySelector('.qr').innerHTML = await qrSvg(url);
    const file = await qrSvg(url, { cellSize: 10, margin: 40, scalable: false, title: `bata go demo: ${url}` });
    link.href = URL.createObjectURL(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${file}\n`], { type: 'image/svg+xml' }));
    card.querySelector('.qr').setAttribute('aria-label', `QR code that opens ${url}`);
    card.hidden = false;
    link.hidden = false;
  } catch (err) {
    console.warn('Caption QR unavailable:', err.message);
  }
}
