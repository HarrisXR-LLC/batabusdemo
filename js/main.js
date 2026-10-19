// Boot (plan 1·1 §5.5, 1·2–1·4): the shell (frame, sheet, clock chip, UI kit), BATA's data, the map
// with its vehicles and walker, then the demo flow (router). Hidden QA pages: ?kit=1 (UI kit gallery),
// ?selftest=1 (trip engine checks); they skip the map.
import { APP_VERSION } from './config.js';
import { on } from './state.js';
import { initFrame } from './frame.js';
import { initSheet } from './sheet.js';
import { bindClockDisplays } from './story.js';
import { initUI, modal, esc } from './ui.js';
import { router } from './router.js';
import { loadData } from './data.js';
import { initMap } from './map.js';
import { initScenes } from './scene.js';
import { initFrameQR } from './qr.js';
import './trips/trip1.js';
import './trips/trip2.js';
import './trips/trip3.js';

async function boot() {
  for (const el of document.querySelectorAll('[data-version]')) el.textContent = `V${APP_VERSION}`;
  initFrame();
  const sheet = initSheet(document.getElementById('sheet'));
  initUI(document.getElementById('screen'));
  on('minute', bindClockDisplays());

  document.getElementById('about-btn').addEventListener('click', () => modal({
    icon: 'info', title: 'About this demo', text: `A concept by HarrisXR. Not made or run by BATA. V${APP_VERSION}`,
  }));

  const body = document.querySelector('.sheet-body');
  const q = new URLSearchParams(location.search);
  try {
    await Promise.all([loadData(), document.fonts.ready]);
  } catch (err) {
    console.error(err);
    body.innerHTML = `<h1 tabindex="-1">Couldn’t load the bus data</h1><p class="muted">Check your connection, then reload the page.</p>
      <p class="muted tab">${esc(err.message)}</p>`;
    window.__ready = true;
    return;
  }
  if (q.has('kit')) await (await import('./kit.js')).start({ body, sheet });
  else if (q.has('selftest')) await (await import('./selftest.js')).start({ body, sheet });
  else {
    // The map starts after the data on purpose: started together, it slows the first screen (2·4 §5).
    const stage = initMap({ container: document.getElementById('map-layer'), screen: document.getElementById('screen'), sheet: document.getElementById('sheet') });
    const scenes = initScenes(stage);
    await router.start({ body, sheet });
    // Captures wait for the map's first tiles (or the simplified map), at most ~9 s.
    await Promise.race([scenes.then(() => stage.idle()), new Promise(r => setTimeout(r, 9000))]);
  }
  // Framed mode only: the caption's QR (its library loads after everything else).
  await initFrameQR();
  // QA screenshots (tools/capture.mjs) wait for this flag: the first step (and its tip) is on screen.
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
}

boot();
