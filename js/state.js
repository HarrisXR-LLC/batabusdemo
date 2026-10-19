// One plain state object, rebuilt from scratch on load and on Restart (plan 1·2 §3).
// Nothing is stored between visits. A tiny event bus lets modules react to changes.

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, detail) {
  for (const fn of listeners.get(event) || []) fn(detail);
}

function tripState() {
  return {
    step: null, destination: null, when: null, arriveBy: null, optionId: null, returnId: null, connectMin: null,
    booking: null,                       // { code, legs[] } once booked
    live: { phase: null, eta: null, jumped: false },
  };
}

function fresh() {
  return {
    story: { trip: 1, date: null, clock: 0, running: false },
    user: { signedIn: false, name: null, email: null, card: null, wallet: null },
    trips: { 1: tripState(), 2: tripState(), 3: tripState() },
    tour: { enabled: true, seen: new Set(), showing: false },
    ui: { sheetDetent: 'peek', modal: null, banner: null },
    step: null,
  };
}

export const state = fresh();

export function resetState() {
  const next = fresh();
  for (const key of Object.keys(next)) state[key] = next[key];
  emit('reset');
}
