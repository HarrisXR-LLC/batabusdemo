// Router (plan 1·2 §5): walks the steps in order (Trip 1 → Trip 2 → Trip 3 → Restart) and renders
// each into the sheet. After rendering: focus the heading → run the step's tip → start its clock.
//
// History: every step pushes an entry, so the browser Back and the Android back gesture step back
// one screen, but only within the current trip (the story stays consistent). Entries from an
// earlier run (before a Restart or a reload) are skipped over in one jump.
//
// Phase 2 replaces placeholders with registerStep(id, { render(ctx) → cleanup?, complete?(state) }).
// `complete` sets the state a finished step leaves behind; ?step= deep links use it to fast-forward.
//
// QA deep links (never linked in the UI): ?step=<id>  ?today=YYYY-MM-DD  ?tips=on|off  ?clock=HH:MM
import { STEPS, STEP_INDEX } from './steps.js';
import { state, emit, on, resetState } from './state.js';
import { clock, storyDates, toMinutes } from './story.js';
import { tour } from './tour.js';
import { button, roundButton, esc } from './ui.js';

const TRIP_NAMES = { 1: 'Trip 1 · Book now', 2: 'Trip 2 · Book ahead', 3: 'Trip 3 · Plan ahead' };
const params = new URLSearchParams(location.search);
const screens = new Map();
let body = null, sheet = null, dates = null, current = null, cleanup = null, seq = 0, runId = '', runs = 0;

export function registerStep(id, screen) { screens.set(id, screen); }

const stepAt = i => STEPS[i] || null;
const nextOf = step => stepAt(STEP_INDEX.get(step.id) + 1);
const newRun = () => `${Date.now().toString(36)}.${++runs}`;
const tipsWanted = () => params.get('tips') !== 'off';

// ---------- history ----------

function entry(step, mode) {
  const prev = history.state?.app === 'bata-go' && history.state.run === runId ? history.state : null;
  const fresh = mode === 'replace' || !prev;
  return {
    app: 'bata-go', run: runId, step: step.id, trip: step.trip,
    n: fresh ? 0 : prev.n + 1,                                            // entries before this one, in this run
    tripDepth: fresh || prev.trip !== step.trip ? 0 : prev.tripDepth + 1, // entries before this one, in this trip
  };
}

export function canGoBack() {
  const s = history.state;
  return s?.app === 'bata-go' && s.run === runId && s.tripDepth > 0;
}

function onPopState(e) {
  const s = e.state;
  if (s?.app !== 'bata-go') return;
  if (s.run !== runId) { history.go(-(s.n + 1)); return; }        // an earlier run: jump past all of it
  if (s.trip !== current.trip) { history.forward(); return; }      // never back into an earlier trip
  if (s.step !== current.id) go(s.step, { history: 'none' });
}

// ---------- rendering ----------

function placeholder(step) {
  const eyebrow = step.id === 'welcome' || step.id === 'end' ? '' : TRIP_NAMES[step.trip];
  return `<div class="step-head">
      ${canGoBack() ? roundButton({ icon: 'left', label: 'Back', attrs: 'data-back' }) : ''}
      <div class="grow">${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h1 tabindex="-1" data-step-heading>${esc(step.title)}</h1></div>
    </div>
    <p class="muted">Placeholder · <span class="tab">${esc(step.id)}</span></p>
    <div class="actions">
      ${step.primary === null ? '' : button({ label: step.primary ?? 'Next', attrs: 'data-primary' })}
      ${step.demo ? button({ label: step.demo, kind: 'demo', attrs: 'data-demo' }) : ''}
    </div>`;
}

function render(step) {
  const screen = screens.get(step.id);
  body.scrollTop = 0;
  if (screen?.render) {
    cleanup = screen.render({ step, body, sheet, state, next, back, canGoBack: canGoBack() }) || null;
  } else {
    body.innerHTML = placeholder(step);
  }
}

/** Show a step. history: 'push' (default) | 'replace' | 'none' (already moved by Back/Forward). */
export async function go(id, { history: mode = 'push', clockAt = null, keepClock = false } = {}) {
  const step = stepAt(STEP_INDEX.get(id));
  if (!step) throw new Error(`Unknown step: ${id}`);
  const mine = ++seq;

  tour.cancel();
  clock.pause();
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;

  current = step;
  state.step = step.id;
  state.story.trip = step.trip;
  state.trips[step.trip].step = step.id;
  if (!keepClock) clock.set(clockAt || step.at[1], dates[step.at[0]]);   // keepClock: redraw where the story is (after a preview)
  if (mode === 'push') history.pushState(entry(step, 'push'), '');
  else if (mode === 'replace') history.replaceState(entry(step, 'replace'), '');

  render(step);
  body.querySelector('[data-step-heading]')?.focus({ preventScroll: true });
  emit('step', step);

  let settled = false;
  const settle = () => { if (!settled && mine === seq) { settled = true; emit('settled', step.id); } };
  await tour.run(step.id, { onShown: settle });
  settle();
  if (mine !== seq) return;

  if (step.run) {   // live parts: the clock runs until the next step's story time
    const nxt = nextOf(step);
    const stopAt = nxt && dates[nxt.at[0]] === state.story.date ? toMinutes(nxt.at[1]) : Infinity;
    clock.run(step.run, stopAt);
  }
}

export function next() {
  if (!current) return;
  if (current.id === 'end') { restart(); return; }
  const nxt = nextOf(current);
  if (nxt) go(nxt.id);
}

export function back() { if (canGoBack()) history.back(); }

/** A demo control: jump the clock (e.g. "Jump to 30 s"), or skip ahead to the next step. */
function demo(btn) {
  if (current.jumpTo) {
    clock.set(current.jumpTo);
    btn.disabled = true;
    return;
  }
  next();
}

/** Restart: a clean state, tips back on, the map camera back to its start (1·4), then welcome. No reload. */
export function restart() {
  tour.cancel();
  clock.pause();
  resetState();
  state.tour.enabled = tipsWanted();
  dates = storyDates();
  runId = newRun();
  if (params.has('step')) {   // drop the QA deep link so a reload starts from the top
    params.delete('step');
    const q = params.toString();
    history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`);
  }
  emit('restart');
  go('welcome', { history: 'push' });
}

/** Fast-forward the state to just before `id`, as if the earlier steps had been played. */
function prepareFor(id) {
  const target = STEP_INDEX.get(id);
  for (let i = 0; i < target; i++) {
    const s = STEPS[i];
    state.trips[s.trip].step = s.id;
    state.tour.seen.add(s.id);
    screens.get(s.id)?.complete?.(state);
  }
}

/** Start the demo. Resolves once the first step has settled (its tip is on screen, or it has none). */
export function start({ body: bodyEl, sheet: sheetCtl }) {
  body = bodyEl;
  sheet = sheetCtl;
  dates = storyDates();
  runId = newRun();
  state.tour.enabled = tipsWanted();

  body.addEventListener('click', e => {
    if (e.defaultPrevented) return;
    const el = e.target.closest('[data-primary], [data-demo], [data-back]');
    if (!el || !body.contains(el)) return;
    if (el.hasAttribute('data-primary')) next();
    else if (el.hasAttribute('data-demo')) demo(el);
    else back();
  });
  addEventListener('popstate', onPopState);

  const wanted = params.get('step');
  const first = wanted && STEP_INDEX.has(wanted) ? wanted : 'welcome';
  prepareFor(first);
  return new Promise(resolve => {
    const off = on('settled', () => { off(); resolve(); });
    // ?clock=HH:MM (QA) starts the first step at that story time, e.g. ?step=t1.ride&clock=07:48 for M3.
    const at = /^\d{2}:\d{2}(:\d{2})?$/.test(params.get('clock') || '') ? params.get('clock') : null;
    go(first, { history: 'replace', clockAt: at });
  });
}

export const router = { start, go, next, back, restart, canGoBack, registerStep, get current() { return current; }, get dates() { return dates; } };
