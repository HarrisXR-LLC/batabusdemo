// Story engine: trip dates and the story clock, always in Traverse City time (plan 1·2 §4).
//   Trip 1: the viewer's today (a Saturday or Sunday becomes the coming Monday), 7:40 AM.
//   Trip 2: Sunday, July 4, 2027.
//   Trip 3: booked on trip 1's date; travel 7 days later (the same weekday next week).
// Dates are plain 'YYYY-MM-DD' calendar strings; times are minutes since midnight.
import { CONFIG } from './config.js';
import { state, emit } from './state.js';

const TZ = CONFIG.timeZone;

// ---------- dates ----------

/** Today's calendar date in Traverse City, whatever time zone the device is in. ?today= overrides it (QA). */
export function traverseToday(now = new Date()) {
  const forced = new URLSearchParams(location.search).get('today');
  if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) return forced;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const toUTC = date => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fromUTC = dt => dt.toISOString().slice(0, 10);

export function addDays(date, days) {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUTC(dt);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function weekday(date) { return toUTC(date).getUTCDay(); }

/** Trip 1's date: today, or the coming Monday when today is a weekend. */
export function trip1Date(today = traverseToday()) {
  const wd = weekday(today);
  return wd === 6 ? addDays(today, 2) : wd === 0 ? addDays(today, 1) : today;
}

export function storyDates(today = traverseToday()) {
  const t1 = trip1Date(today);
  return { trip1: t1, trip2: CONFIG.story.trip2.date, trip3book: t1, trip3travel: addDays(t1, CONFIG.story.trip3.daysAhead) };
}

// ---------- formatting ----------

/** 'HH:MM' or 'HH:MM:SS' to minutes since midnight. */
export const toMinutes = hhmm => { const [h, m, s = 0] = hhmm.split(':').map(Number); return h * 60 + m + s / 60; };

/** "7:40 AM" from minutes since midnight. */
export function formatTime(minutes) {
  const total = Math.floor(minutes);
  const h24 = Math.floor(total / 60) % 24, m = total % 60;
  return `${((h24 + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** A time range as option cards show it: ['8:00', '8:07 AM'], or ['11:43 AM', '12:04 PM'] across noon. */
export function formatRange(from, to) {
  const a = formatTime(from), b = formatTime(to);
  return a.slice(-2) === b.slice(-2) ? [a.slice(0, -3), b] : [a, b];
}

/** "7:40" for the framed status bar. */
export function formatShort(minutes) { return formatTime(minutes).replace(/ [AP]M$/, ''); }

/** "Sun, Jul 4" or "Mon, Oct 26" for a calendar date. */
export function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(toUTC(date));
}

/** "Today" / "Tomorrow" relative to trip 1's story today, otherwise the short date. */
export function dayLabel(date, storyToday = storyDates().trip1) {
  if (date === storyToday) return 'Today';
  if (date === addDays(storyToday, 1)) return 'Tomorrow';
  return formatDate(date);
}

// ---------- clock ----------
// The clock moves only when a screen says so. hold()/release() pause it while a tip is showing.

let rate = 0, until = Infinity, last = 0, frame = 0, holds = 0, lastMinute = -1;

function tick(ts) {
  frame = 0;
  if (!rate || holds) { last = 0; return; }
  if (last) state.story.clock = Math.min(until, state.story.clock + ((ts - last) / 1000) * rate);
  last = ts;
  publish();
  if (state.story.clock >= until) { clock.pause(); return; }
  frame = requestAnimationFrame(tick);
}

function publish(force = false) {
  const minute = Math.floor(state.story.clock);
  emit('clock', state.story.clock);
  if (force || minute !== lastMinute) { lastMinute = minute; emit('minute', minute); }
}

export const clock = {
  now: () => state.story.clock,
  /** Jump to a time (and optionally a date): 'HH:MM' or minutes. */
  set(time, date = state.story.date) {
    state.story.clock = typeof time === 'string' ? toMinutes(time) : time;
    state.story.date = date;
    publish(true);
  },
  /** Run at `storyMinutesPerSecond` (1 story minute ≈ 5 real seconds while walking → 0.2),
   *  stopping at `stopAt` ('HH:MM' or minutes) if given. */
  run(storyMinutesPerSecond, stopAt = Infinity) {
    rate = storyMinutesPerSecond;
    until = typeof stopAt === 'string' ? toMinutes(stopAt) : stopAt;
    state.story.running = rate > 0;
    last = 0;
    if (!frame && rate && !holds) frame = requestAnimationFrame(tick);
  },
  pause() { rate = 0; until = Infinity; state.story.running = false; if (frame) { cancelAnimationFrame(frame); frame = 0; } },
  hold() { holds++; last = 0; },
  release() { holds = Math.max(0, holds - 1); if (!holds && rate && !frame) frame = requestAnimationFrame(tick); },
  get held() { return holds > 0; },
};

// ---------- clock chip + framed status bar ----------

export function bindClockDisplays(root = document) {
  const chip = root.querySelector('[data-clock]');
  const short = root.querySelector('[data-clock-short]');
  // "Sun, Jul 4": the weekday sits in its own span, dropped when the chip doesn't fit ("11:06 AM · Jul 4")
  // on a narrow screen or with large text; if it still doesn't fit (wider text spacing), it wraps onto two
  // lines, so the time and date are never cut off (app.css .clock.tight / .wrap; WCAG 1.4.10, 1.4.12)
  let fitFrame = 0;
  const fit = () => {
    const over = () => chip.scrollWidth > chip.clientWidth + 1;
    chip.classList.remove('tight', 'wrap');
    if (over()) chip.classList.add('tight');
    if (over()) chip.classList.add('wrap');
  };
  const render = () => {
    if (state.story.date == null) return;
    if (chip) {
      const time = formatTime(state.story.clock), [, wd, rest] = dayLabel(state.story.date).match(/^(\w{3}, )?(.*)$/);
      if (chip.textContent !== `${time} · ${wd || ''}${rest}`) {
        chip.textContent = `${time} · `;
        if (wd) chip.append(Object.assign(document.createElement('span'), { className: 'ck-wd', textContent: wd }));
        chip.append(rest);
      }
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(fit);   // measure once the layout has settled, on every new screen too
    }
    if (short) short.textContent = formatShort(state.story.clock);
  };
  if (chip) addEventListener('resize', fit);
  return render;
}
