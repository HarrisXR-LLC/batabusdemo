// Trip engine self-test (plan 1·3 §8 step 4): ?selftest=1. Table-driven, no test framework.
// Checks the option lists of 1·3 §7.2, legs, fares, room, Where's my ride states, positions and the
// vehicle counts against fixed dates, then shows the real option cards. window.__selftest has the results.
import { DATA, serviceFor, vehiclesAt, stop, place, distance } from './data.js';
import { options, walkMinutes, linkMinutes, totalFare, formatFare, tripCode, cancelBy, rideStatus, vehicleAt, jumpTime } from './engine.js';
import { formatTime, storyDates, toMinutes, clock } from './story.js';
import { palette } from './map.js';
import * as ui from './ui.js';

const MON = '2026-10-19', FRI = '2026-10-23', SUN = '2027-07-04';
const label = o => `${o.name} · ${o.times.join(' → ')} · ${o.fare}${o.recommended ? ' (Recommended)' : ''}${o.late ? ' · late' : ''}${o.last ? ' · last bus' : ''}`;
const T = s => toMinutes(s);
const near = (p, [lon, lat], m) => distance([p.lon, p.lat], [lon, lat]) <= m;
const angle = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

function cases() {
  const svc = { mon: serviceFor(MON), fri: serviceFor(FRI), sun: serviceFor(SUN) };
  const t1 = options('trip1', { service: svc.mon }), t1f = options('trip1', { service: svc.fri });
  const t2 = options('trip2', { service: svc.sun }), t2b = options('trip2back', { service: svc.sun });
  const t3 = options('trip3', { service: serviceFor(storyDates(MON).trip3travel) });
  const [bus1] = t1, [bus2] = t2, [back2] = t2b, [van3] = t3;
  const st = (o, t) => { const s = rideStatus(o, typeof t === 'string' ? T(t) : t); return [s.state, s.big, s.sub, s.pill].filter(Boolean).join(' | '); };
  const yourBlock = [bus1.trip];

  return [
    ['Options (1·3 §7.2)', [
      ['Trip 1 · Mon · now 7:40, arrive by 8:30', t1.map(label), ['Route 07 · 8:00 → 8:07 AM · $1.50 (Recommended)', 'Link van · 7:45 → 7:52 AM · $6']],
      ['Trip 1 · Fri (service 2)', t1f.map(label), ['Route 07 · 8:00 → 8:07 AM · $1.50 (Recommended)', 'Link van · 7:45 → 7:52 AM · $6']],
      ['Trip 2 going · arrive by 11:45 AM', t2.map(label), ['Bayline · 11:13 → 11:34 AM · Free (Recommended)', 'Bayline · 10:43 → 11:04 AM · Free', 'Bayline · 11:43 AM → 12:04 PM · Free · late']],
      ['Trip 2 return · leave after 6:45 PM', t2b.map(label), ['Bayline · 7:00 → 7:11 PM · Free (Recommended)', 'Bayline · 7:30 → 7:41 PM · Free', 'Bayline · 8:00 → 8:11 PM · Free · last bus']],
      ['Trip 3 · arrive by 9:00 AM', t3.map(label), ['Link van · 8:35 → 8:50 AM · $6 (Recommended)', 'Link van · 8:20 → 8:35 AM · $6']],
      ['Trip 2 late option note', t2[2].note, 'Arrives 12:04 PM'],
    ]],
    ['Legs and extras (§7.1, §7.4, §7.5, §7.5a)', [
      ['Walk minutes (1.2 m/s)', ['walk1', 'walk1b', 'walk2', 'walk2b', 'walk2r', 'walk2h'].map(walkMinutes).join(' '), '4 2 4 3 7 4'],
      ['Link minutes door to door (2 + drive)', [linkMinutes('link1'), linkMinutes('link3')].join(' '), '7 15'],
      ['Trip 1 bus: leave by · at the stop · cancel by', [bus1.leaveBy, bus1.here, cancelBy(bus1)].map(formatTime).join(' · '), '7:46 AM · 7:52 AM · 7:55 AM'],
      ['Trip 1 bus trips (Mon, Fri)', `${bus1.trip} ${t1f[0].trip}`, '07B-732 07B-733'],
      ['Trip 2 return walk to Hall St', `${walkMinutes('walk2r')} min, leave ${formatTime(back2.leaveBy)}`, '7 min, leave 6:45 PM'],
      ['Fares: trip 1 · trip 2 (both ways) · trip 3', [formatFare(totalFare(bus1)), formatFare(totalFare(bus2, back2)), formatFare(totalFare(van3), { exact: true })].join(' · '), '$1.50 · Free · $6.00'],
      ['Room levels', [bus1, bus2, t2[1], back2, van3].map(o => o.room.level + (o.room.seats ? ` ${o.room.seats}` : '')).join(' · '), 'plenty · almost 4 · filling · filling · reserved'],
      ['Trip codes: XXX-XXX, no look-alikes (500 made)', Array.from({ length: 500 }, tripCode).every(c => /^[ACDEFGHJKMNPQRTUVWXY34679]{3}-[ACDEFGHJKMNPQRTUVWXY34679]{3}$/.test(c)), true],
    ]],
    ["Where's my ride (§7.6)", [
      ['Trip 1 · 7:25', st(bus1, '07:25'), 'scheduled | Arrives 7:52 AM | Not on the road yet'],
      ['Trip 1 · 7:40', st(bus1, '07:40'), 'onway | Arrives 7:52 AM | Your bus is on its way!'],
      ['Trip 1 · 7:48', st(bus1, '07:48'), 'near | 4 min | Arrives 7:52 AM | Your bus is on its way!'],
      ['Trip 1 · 7:50 (at the stop)', st(bus1, '07:50'), 'near | 2 min | Arrives 7:52 AM | Your bus is on its way!'],
      ['Trip 1 · Jump to 30 s', `${formatTime(jumpTime(bus1))} ${st(bus1, jumpTime(bus1))}`, '7:51 AM arriving | Arriving | Your bus is arriving'],
      ['Trip 1 · 7:52', st(bus1, '07:52'), 'here | Here | Leaves 8:00 AM | Your bus is here'],
      ['Trip 1 · 8:00 · 8:05', `${rideStatus(bus1, T('08:00')).state} · ${rideStatus(bus1, T('08:05')).state}`, 'riding · arrived'],
      ['Trip 2 · 11:06 · 11:10 · 11:13', ['11:06', '11:10', '11:13'].map(t => st(bus2, t)).join(' / '),
        'onway | Arrives 11:13 AM | Your bus is on its way! / near | 3 min | Arrives 11:13 AM | Your bus is on its way! / here | Here | Your bus is here'],
      ['Trip 2 return · 6:45 · 6:50', ['18:45', '18:50'].map(t => st(back2, t)).join(' / '),
        'near | 4 min | Arrives 6:49 PM | Your bus is on its way! / here | Here | Leaves 7:00 PM | Your bus is here'],
      ['Trip 3 · 8:25 · 8:27 · 8:31', ['08:25', '08:27', '08:31'].map(t => st(van3, t)).join(' / '),
        'scheduled | Arrives 8:35 AM | Not on the road yet / onway | Arrives 8:35 AM | Your ride is on its way! / near | 4 min | Arrives 8:35 AM | Your ride is on its way!'],
      ['Trip 3 · 8:35 · 8:40 · 8:50', ['08:35', '08:40', '08:50'].map(t => st(van3, t)).join(' / '),
        'here | Here | Leaves 8:37 AM | Your ride is here / riding | Arrives 8:50 AM / arrived | Arrived 8:50 AM'],
    ]],
    ['Vehicles (§3.4, §4.2)', [
      ['Your bus at 7:48 (mockup [-85.64606, 44.72485], 359°)', (p => near(p, [-85.64606, 44.72485], 5) && angle(p.heading, 359) < 10 && p.moving)(vehicleAt(bus1, T('07:48'))), true],
      ['Your bus waits at Meijer 7:55', (p => near(p, [stop('8413814').lon, stop('8413814').lat], 40) && !p.moving)(vehicleAt(bus1, T('07:55'))), true],
      ['Your bus is not on the road at 7:20', vehicleAt(bus1, T('07:20')).onRoad, false],
      ['Your van: on its way 8:30, at your door 8:36, at the airport 8:50', [
        vehicleAt(van3, T('08:30')).moving,
        near(vehicleAt(van3, T('08:36')), place('home123'), 60),
        near(vehicleAt(van3, T('08:50')), place('airport'), 120),
      ].join(' '), 'true true true'],
      ['On the road · Mon 7:40 · 7:48 · Sun 9:30 · Mon 7:00 PM', [vehiclesAt('1', T('07:40')), vehiclesAt('1', T('07:48')), vehiclesAt('4', T('09:30')), vehiclesAt('1', T('19:00'))].map(v => v.length).join(' · '), '19 · 19 · 3 · 12'],
      ['Others at 7:40, without your bus (mockup M1: 18)', vehiclesAt('1', T('07:40'), { exclude: yourBlock }).length, 18],
      ['Vehicle classes on the road at 7:40', [...new Set(vehiclesAt('1', T('07:40')).map(v => v.cls))].sort().join(' '), 'full medium'],
      ["Trip 3's travel day keeps trip 1's weekday (Fri → service 2)", serviceFor(storyDates(FRI).trip3travel), '2'],
    ]],
    ['Map colors (2·4)', [
      // a stray comment once hid green and ink: the Link line and the walk dashes vanished without an error
      ['Every map color is set (street and simplified map)', Object.entries(palette()).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v)).map(([k]) => k).join(' '),
        'land water waterway park wood residential building road casing path label blue green ink'],
    ]],
  ];
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const show = v => (Array.isArray(v) ? v.join(' / ') : String(v));

export async function start({ body, sheet }) {
  document.title = 'Self-test · bata go';
  clock.set('07:40', MON);
  const groups = cases();
  const results = groups.flatMap(([group, rows]) => rows.map(([name, got, want]) => ({ group, name, got, want, ok: same(got, want) })));
  const passed = results.filter(r => r.ok).length;
  const svc = serviceFor(MON);
  const card = o => ui.optionCard({ id: o.id, times: o.times, price: o.fare, name: o.name, recommended: o.recommended, late: o.late,
    note: o.note, walkMin: o.kind === 'bus' ? o.walkMin : null, route: o.kind === 'bus' ? o.routeShort : null, room: o.late ? null : o.room, selected: o.recommended });

  body.innerHTML = `<div class="selftest">
    <p class="eyebrow">QA · ${DATA.feed.publisher} feed ${DATA.feed.version}</p>
    <h1 tabindex="-1" data-step-heading>Engine self-test</h1>
    <p class="st-sum ${passed === results.length ? 'ok' : 'bad'}" role="status">${passed} of ${results.length} passed</p>
    ${groups.map(([group]) => `<h2 class="section-label">${ui.esc(group)}</h2><ul class="st-list">${results.filter(r => r.group === group).map(r => `
      <li class="st-row ${r.ok ? 'ok' : 'bad'}">${ui.icon(r.ok ? 'check' : 'close', 'i s')}<span class="sr-only">${r.ok ? 'Pass' : 'Fail'}: </span>
        <span><span class="st-name">${ui.esc(r.name)}</span>${r.ok ? '' : `<span class="st-diff">got ${ui.esc(show(r.got))}<br>want ${ui.esc(show(r.want))}</span>`}</span></li>`).join('')}</ul>`).join('')}
    <h2 class="section-label">Trip 1 options (as cards)</h2>${ui.optionList(options('trip1', { service: svc }).map(card))}
    <h2 class="section-label">Trip 2 options</h2>${ui.optionList(options('trip2', { service: '4' }).map(card))}
    <h2 class="section-label">Trip 2 ride back</h2>${ui.optionList(options('trip2back', { service: '4' }).map(card))}
    <h2 class="section-label">Trip 3 options</h2>${ui.optionList(options('trip3', { service: svc }).map(card))}
  </div>`;
  for (const g of body.querySelectorAll('[role="radiogroup"]')) ui.radioGroup(g);
  sheet.set('full');
  window.__selftest = { passed, failed: results.length - passed, results: results.map(({ group, name, ok, got, want }) => ({ group, name, ok, got: show(got), want: show(want) })) };
  await new Promise(r => setTimeout(r, 340));
}
