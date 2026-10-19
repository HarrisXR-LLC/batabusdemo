// Every step of the demo in order, with its story time and draft tips (plan 1·2 §5.1, §7.3).
// Phase 1 renders each step as a placeholder; Phase 2 registers the real screens
// (router.registerStep) and may refine targets and wording. Tip texts are the Phase 2 drafts.
//
//   at:      [date key, 'HH:MM'] set on entry (date keys from story.storyDates())
//   primary: main button label (default "Next"); null when the main action is a demo skip
//   demo:    a demo control ("DEMO · …"), dashed, never mistaken for a real feature;
//            it skips to the next step, or with jumpTo ('HH:MM:SS') only moves the clock
//   run:     story minutes per real second while on the step (live parts)

const S = (id, title, at, extra = {}) => ({ id, title, at, trip: id === 'welcome' ? 1 : id === 'end' ? 3 : Number(id[1]), ...extra });

export const STEPS = [
  S('welcome', 'Welcome', ['trip1', '07:40'], { primary: 'Start' }),

  S('t1.intro', 'Trip Demo 1 · Book now', ['trip1', '07:40'], { primary: 'Start' }),   // the prelude pages (js/prelude.js)
  S('t1.home', 'Where to?', ['trip1', '07:40']),
  S('t1.destination', 'Destination', ['trip1', '07:40']),
  S('t1.options', 'Options', ['trip1', '07:41']),
  S('t1.review', 'Review', ['trip1', '07:41']),
  S('t1.signin', 'Sign in', ['trip1', '07:41']),
  S('t1.pay', 'Pay', ['trip1', '07:41']),
  S('t1.booked', 'Booked', ['trip1', '07:42']),
  S('t1.ride', "Where's my ride", ['trip1', '07:42']),
  S('t1.walk', 'Walking', ['trip1', '07:46'], { run: 0.2 }),
  S('t1.stop', 'At the stop', ['trip1', '07:50'], { primary: 'Board', demo: 'Jump to 30 s', jumpTo: '07:51:30', run: 0.2 }),
  S('t1.board', 'Boarding pass', ['trip1', '07:52'], { primary: "I'm on board" }),
  S('t1.onboard', 'On board', ['trip1', '08:00'], { run: 0.2 }),
  S('t1.arrived', "You're here", ['trip1', '08:07'], { primary: 'Next: Trip Demo 2' }),

  S('t2.intro', 'Trip Demo 2 · Book ahead', ['trip2', '09:30'], { primary: 'Start' }),
  S('t2.home', 'Where to?', ['trip2', '09:30']),
  S('t2.destination', 'Destination', ['trip2', '09:30']),
  S('t2.options', 'Options', ['trip2', '09:31']),
  S('t2.return', 'Ride back', ['trip2', '09:31']),
  S('t2.review', 'Review', ['trip2', '09:31']),
  S('t2.booked', 'Booked', ['trip2', '09:32']),
  S('t2.skip', 'Booked', ['trip2', '09:32'], { primary: null, demo: 'Skip to 11:06 AM' }),
  S('t2.ride', "Where's my ride", ['trip2', '11:06']),
  S('t2.walk', 'Walking', ['trip2', '11:07'], { run: 0.2 }),
  S('t2.stop', 'At the stop', ['trip2', '11:11'], { primary: 'Board', demo: 'Jump to 30 s', jumpTo: '11:12:30', run: 0.2 }),
  S('t2.board', 'Boarding pass', ['trip2', '11:13'], { primary: "I'm on board" }),
  S('t2.onboard', 'On board', ['trip2', '11:13'], { run: 0.8 }),   // 18 story minutes in about 22 s
  S('t2.arrived', 'At the fair', ['trip2', '11:34'], { primary: null, demo: 'Skip to 6:44 PM' }),
  S('t2.rideBack', "Where's my ride", ['trip2', '18:44']),
  S('t2.walkBack', 'Walking', ['trip2', '18:45'], { run: 0.35 }),  // 7 min to Hall St in about 20 s
  S('t2.stopBack', 'At the stop', ['trip2', '18:52'], { primary: 'Board' }),   // the bus has waited there since 6:49
  S('t2.boardBack', 'Boarding pass', ['trip2', '18:52'], { primary: "I'm on board" }),
  S('t2.onboardBack', 'On board', ['trip2', '19:00'], { run: 0.3 }),
  S('t2.home2', 'Home', ['trip2', '19:11'], { primary: 'Next: Trip Demo 3' }),

  S('t3.intro', 'Trip Demo 3 · Plan ahead', ['trip3book', '19:00'], { primary: 'Start' }),
  S('t3.home', 'Where to?', ['trip3book', '19:00']),
  S('t3.destination', 'Destination', ['trip3book', '19:00']),
  S('t3.when', 'When', ['trip3book', '19:01']),
  S('t3.arriveBy', 'Arrive by', ['trip3book', '19:01']),
  S('t3.options', 'Options', ['trip3book', '19:01']),
  S('t3.review', 'Review', ['trip3book', '19:02']),
  S('t3.preview', 'Preview my Ride', ['trip3book', '19:02']),
  S('t3.booked', 'Booked', ['trip3book', '19:03'], { primary: null, demo: 'Skip to trip day' }),
  S('t3.link', "Where's my ride", ['trip3travel', '08:25'], { run: 0.4, demo: 'Jump to 30 s', jumpTo: '08:34:30' }),
  S('t3.pass', 'Your pass', ['trip3travel', '08:35'], { primary: "I'm on board" }),
  S('t3.onboard', 'On board', ['trip3travel', '08:37'], { run: 0.6 }),     // the van waits 2 min at your door, then goes
  S('t3.arrived', 'At the airport', ['trip3travel', '08:50'], { primary: 'Finish' }),

  S('end', 'Thank you', ['trip3travel', '08:50'], { primary: 'Restart' }),
];

export const STEP_INDEX = new Map(STEPS.map((s, i) => [s.id, i]));

// Draft tips (Phase 2 docs). Placeholder screens point them at the main button or demo control.
const main = '[data-primary]', demo = '[data-demo]';
export const TIPS = {
  'welcome': [{ target: main, text: 'Tips like this will guide you. Tap OK.' }],
  't1.home': [{ target: main, text: 'Like a ride app: start with where you’re going.' }],
  't1.destination': [{ target: main, text: 'Pick a place. Your usual spots are saved.' }],
  't1.options': [{ target: main, text: 'Real BATA times. Our pick says Recommended.' }],
  't1.review': [{ target: main, text: 'One tap books and pays. Same fare as on the bus.' }],
  't1.signin': [{ target: main, text: 'Demo: tap Auto fill. No real details needed.' }],
  't1.pay': [{ target: main, text: 'Pay your way: card, wallet, Cash App, Venmo or Zelle.' }],
  't1.booked': [{ target: main, text: 'Done. Now just catch your bus.' }],
  't1.ride': [{ target: main, text: 'See your bus live, like a rideshare.' }],
  't1.walk': [{ target: main, text: 'Walk to your stop. Your bus time stays live.' }],
  't1.stop': [{ target: demo, text: 'Demo: skip ahead to watch it arrive.' }],
  't1.board': [{ target: main, text: 'Show your pass to the driver. That’s it.' }],
  't1.onboard': [{ target: main, text: 'Ride along. We’ll tell you when to get off.' }],
  't1.arrived': [{ target: main, text: 'Next: book ahead for later in the day.' }],

  't2.options': [{ target: main, text: 'Busy day? You’ll see when a bus is nearly full.' }],
  't2.return': [{ target: main, text: 'Add your ride back now. Done and out of the way.' }],
  't2.review': [{ target: main, text: 'Bayline is free. Booking still holds your spot.' }],
  't2.booked': [{ target: main, text: 'Both trips are here. Tap to switch.' }],
  't2.skip': [{ target: demo, text: 'Demo: skip ahead to your trip.' }],
  't2.arrived': [{ target: demo, text: 'Demo: skip to your ride back.' }],
  't2.home2': [{ target: main, text: 'Next: plan a big trip a week ahead.' }],

  't3.home': [{ target: main, text: 'Tap I’m here. We’ll pick you up where you are.' }],
  't3.when': [{ target: main, text: 'Book up to 7 days ahead.' }],
  't3.arriveBy': [{ target: main, text: 'Flight at 11:00? Arrive by 9:00, two hours early.' }],
  't3.options': [{ target: main, text: 'A Link van picks you up at home. No walking.' }],
  't3.review': [{ target: main, text: 'Nervous? Preview every step first.' }],
  't3.preview': [{ target: main, text: 'Drag, or tap Next, to see each step.' }],
  't3.link': [{ target: main, text: 'Watch your van come to you.' }],
};
// The prelude pages (t1.intro, t2.intro, t3.intro) and the Thank you page have no tips: they explain themselves.
