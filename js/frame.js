// Phone vs framed mode, portrait-only handling and the 9:20 frame (plan 1·1 §6).
//   phone:  a touch screen whose short side is <= 500 CSS px; the app fills the viewport.
//           Held sideways, it shows "Turn your phone upright" (portrait only, user decision).
//   framed: everything else; a fixed 396 x 880 screen in a phone bezel, scaled to fit the window.
// ?frame=on / ?frame=off force a mode for testing.
import { clock } from './story.js';

const SCREEN = { w: 396, h: 880 };
const BEZEL = 12;
const CAPTION = 44;            // room under the device for the caption
const MAX_SCALE = 1.15;
const coarse = matchMedia('(pointer: coarse)');
let sideways = false;          // the story clock waits while the app is hidden behind "Turn your phone upright"

export function detectMode() {
  const force = new URLSearchParams(location.search).get('frame');
  if (force === 'on') return 'framed';
  if (force === 'off') return 'phone';
  return coarse.matches && Math.min(screen.width, screen.height) <= 500 ? 'phone' : 'framed';
}

function apply() {
  const body = document.body;
  const mode = detectMode();
  body.dataset.mode = mode;
  body.dataset.orient = innerWidth > innerHeight ? 'landscape' : 'portrait';
  if (mode === 'framed') {
    const k = Math.min(
      (innerHeight - 24 - CAPTION) / (SCREEN.h + BEZEL * 2),
      (innerWidth - 32) / (SCREEN.w + BEZEL * 2),
      MAX_SCALE,
    );
    body.style.setProperty('--k', Math.max(0.3, k).toFixed(4));
    // room for the QR card (196 px + a 56 px gap) beside the scaled device?
    body.dataset.side = innerWidth / 2 - (SCREEN.w / 2 + BEZEL) * Math.max(0.3, k) >= 56 + 196 + 24 ? 'on' : 'off';
  } else {
    body.style.removeProperty('--k');
    delete body.dataset.side;
  }
  const now = mode === 'phone' && body.dataset.orient === 'landscape';
  if (now !== sideways) { sideways = now; if (now) clock.hold(); else clock.release(); }
}

export function initFrame() {
  apply();
  addEventListener('resize', apply);
  addEventListener('orientationchange', apply);
  coarse.addEventListener('change', apply);
}
