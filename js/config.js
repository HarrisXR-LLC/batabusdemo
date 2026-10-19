// Story settings, trip-engine settings and flags (plan 1·1 §5.5; values from 1·2 §4 and 1·3 §7).
// The pretend places and routed paths live in data/bata.json (built by tools/build_bata_data.py).
export const APP_VERSION = '0.1.2';

export const CONFIG = {
  timeZone: 'America/Detroit',   // every time shown is Traverse City time
  story: {
    trip1: { clock: '07:40' },                      // today (a weekend becomes the coming Monday)
    trip2: { date: '2027-07-04', clock: '09:30' },  // Sunday, July 4, 2027
    trip3: { clock: '19:00', daysAhead: 7, flight: '11:00' },   // booked on trip 1's date for 7 days later; the flight
  },

  engine: {
    walkSpeed: 1.2,        // m/s: a little slower than most planners, kind to slower walkers; minutes are rounded
    stopBufferMin: 2,      // be at the stop 2 min before the bus gets there
    linkPickupMin: 2,      // a Link van waits 2 min at your door
    linkSlotMin: 15,       // Link pickups are offered every 15 min
    linkLeadMin: 5,        // the soonest Link pickup is 5 min from now (on a 5-min grid)
    linkCushionMin: 10,    // for an arrive-by Link trip, plan to arrive 10 min early (traffic, a shared ride)
    cancelLeadMin: 5,      // "Cancel by" = departure − 5 min
    showPlentyOfRoom: true, // false: show the room badge only when a bus is filling up (2·1 Q3)
    // Illustrative room levels (not BATA data, 1·3 §7.5), by story leg and departure time.
    room: {
      trip1: { default: ['plenty'] },
      trip2: { default: ['filling'], '11:13': ['almost', 4] },   // July 4: busy
      trip2back: { default: ['plenty'], '19:00': ['filling'] },
    },
  },

  // What each trip asks the engine for (1·3 §7.2). Times are story times; Phase 2 may pass the live clock.
  requests: {
    trip1: { leg: 'trip1', walkTo: 'walk1', walkFrom: 'walk1b', now: '07:40', arriveBy: '08:30', buses: 2, late: 0, link: { path: 'link1', count: 1 } },
    trip2: { leg: 'trip2', walkTo: 'walk2', walkFrom: 'walk2b', now: '09:30', arriveBy: '11:45', buses: 2, late: 1 },
    trip2back: { leg: 'trip2back', walkTo: 'walk2r', walkFrom: 'walk2h', leaveAfter: '18:45', buses: 3, late: 0 },
    trip3: { arriveBy: '09:00', link: { path: 'link3', approach: 'link3a', count: 2 } },
  },

  tips: { showEveryTime: true },  // user decision: tips show every time the demo starts
};
