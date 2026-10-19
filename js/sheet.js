// The bottom sheet: three heights (peek / half / full), changed by dragging the handle or,
// without dragging (WCAG 2.5.7), by tapping it or using the arrow keys on it.
// Emits 'sheet' (detent name) on every change and 'sheet-settled' when the height transition ends
// (or at once with reduced motion, which has no transition). state.ui.sheetMoving is true in between.
import { state, emit } from './state.js';

const DETENTS = ['peek', 'half', 'full'];
const HEIGHT = { peek: 0.30, half: 0.52, full: 0.86 };   // share of the screen height
const LABEL = { peek: 'small', half: 'half height', full: 'full height' };

export function initSheet(sheet) {
  const handle = sheet.querySelector('.sheet-handle');
  const screenEl = sheet.parentElement;
  let drag = null;

  let settleTimer = 0;
  const settle = () => {
    clearTimeout(settleTimer);
    if (!state.ui.sheetMoving) return;
    state.ui.sheetMoving = false;
    emit('sheet-settled', sheet.dataset.detent);
  };
  const set = name => {
    const moving = sheet.dataset.detent !== name && !sheet.classList.contains('dragging');
    sheet.dataset.detent = name;
    sheet.style.setProperty('--sheet-h', `${HEIGHT[name] * 100}%`);
    handle.setAttribute('aria-label', `Resize panel (now ${LABEL[name]})`);
    state.ui.sheetDetent = name;
    if (moving) {
      state.ui.sheetMoving = true;
      clearTimeout(settleTimer);
      const ms = parseFloat(getComputedStyle(sheet).transitionDuration) * 1000 || 0;
      settleTimer = setTimeout(settle, ms ? ms + 80 : 0);   // a backstop if transitionend never comes
    }
    emit('sheet', name);
  };
  sheet.addEventListener('transitionend', e => { if (e.target === sheet && e.propertyName === 'height') settle(); });
  const step = dir => set(DETENTS[Math.max(0, Math.min(DETENTS.length - 1, DETENTS.indexOf(sheet.dataset.detent) + dir))]);

  handle.addEventListener('click', () => {
    if (drag?.moved) return;
    const i = DETENTS.indexOf(sheet.dataset.detent);
    set(DETENTS[(i + 1) % DETENTS.length]);
  });
  handle.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { step(1); e.preventDefault(); }
    if (e.key === 'ArrowDown') { step(-1); e.preventDefault(); }
  });

  handle.addEventListener('pointerdown', e => {
    drag = { y: e.clientY, h: sheet.getBoundingClientRect().height, moved: false };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    sheet.classList.add('dragging');
    const total = screenEl.getBoundingClientRect().height;
    sheet.style.setProperty('--sheet-h', `${Math.max(0.18, Math.min(0.9, (drag.h + dy) / total)) * 100}%`);
  });
  const end = () => {
    if (!drag) return;
    if (drag.moved) {
      const share = sheet.getBoundingClientRect().height / screenEl.getBoundingClientRect().height;
      const nearest = DETENTS.reduce((a, b) => (Math.abs(HEIGHT[b] - share) < Math.abs(HEIGHT[a] - share) ? b : a));
      sheet.classList.remove('dragging');
      set(nearest);
    }
    setTimeout(() => { drag = null; }, 0);  // let the click handler see drag.moved first
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);

  set(sheet.dataset.detent || 'peek');
  return { set, get: () => sheet.dataset.detent };
}
