# bata go: a rider demo for BATA

A concept demo by HarrisXR. **Not an official BATA app.**

A phone-first web app that shows how riding a BATA bus could feel like getting an Uber or Lyft: plan a trip, book and pay ahead, watch your ride come to you, and preview every step first. Short tips guide you through three trips.

## Try it

**[Open the demo](https://harrisxr-llc.github.io/batabusdemo/)**

It's made for a phone, held upright. On a computer it shows inside a phone frame, with a QR code to open it on your phone. The whole demo takes about four minutes.

## What it shows

1. **Book now.** A weekday morning ride to work on Route 07: book and pay in one tap, see your bus live, walk to the stop, show your pass, ride.
2. **Book ahead.** The fair on July 4, booked that morning, out and back on the free Bayline. You see when a bus is nearly full.
3. **Plan a week ahead.** A flight at 11:00 AM: a Link van picks you up at your door and drops you at Cherry Capital Airport two hours early.

**Preview my Ride** on every trip plays the trip step by step before you go.

## Run it locally

It's a static website (HTML, CSS and JavaScript modules, no build step). Modules need a web server, so opening `index.html` straight from the folder won't work. Serve the folder with any static server, for example:

- `npx serve` (Node), or
- `python -m http.server 8000` (Python), then open <http://localhost:8000/>.

If the page stays blank, the server is probably sending `.js` files with the wrong type; they must be `text/javascript`.

On a phone the app fills the screen (portrait only). On a computer it appears inside a 9:20 phone frame. Add `?frame=on` or `?frame=off` to the address to force either view.

### Testing links

Add these to the address. They're for testing only; the app never links to them.

| Add | What it does |
|---|---|
| `?step=t2.options` | Open any step directly (step ids are in `js/steps.js`) |
| `?today=2026-10-24` | Pretend today is that date (trip 1 moves a weekend to Monday) |
| `?tips=off` | Hide the tips |
| `?kit=1` | The UI kit gallery. Add `&tip=above` (or `below`, `left`, `right`, `corner`, `bottom`, `none`) to test tip placement, or `&show=modal` (or `pill`, `banner`) |
| `?selftest=1` | Check the trip engine against the planned trip options and arrival times |
| `?clock=07:48` | Start the first step at that story time (with `?step=t1.ride`, it's the live "Where's my ride" map) |
| `?map=simple` | Use the simplified map (the one shown when the street map can't load) |

Combine them with `&`, for example `index.html?frame=off&today=2026-10-19&step=t1.walk`.

## What's real and what isn't

- **Real:** the routes, stops, times and fares come from BATA's published GTFS feed (GMV Syncromatics, feed version 9/7/2026, downloaded 2026-10-18). The map is OpenStreetMap.
- **Simulated:** the vehicles. Every bus on the map moves on its scheduled times; none are live. The Link vans are pretend.
- **Proposed, not BATA services today:** booking and paying ahead in an app, booking Link 7 days ahead, paying with wallets and payment apps, and Wallet passes.
- **Pretend:** the homes ("123 Sesame Street", "77 Sesame Street"), the rider, the card and the sign-in. Nothing is typed in, collected or sent, and no payment is made.

## Accessibility

Built toward WCAG 2.2 AA: every control works with a keyboard and has a name for screen readers, focus stays visible, tips are dialogs you can close with Escape, times are announced politely, and the app follows reduced motion, reduced transparency, more contrast and larger text. It is portrait only by design.

## Folder guide

| Path | What it is |
|---|---|
| `index.html`, `css/`, `js/`, `assets/` | The app |
| `js/steps.js` | Every step of the demo in order, its story time and its tip text |
| `js/trips/` | Each trip's screens (`trip1.js`, `trip2.js`, `trip3.js`) and `common.js`, the screens they share; `js/pay.js`, `js/ride.js` and `js/preview.js` are the sign-in and payment, Where's my ride and pass, and Preview my Ride pieces |
| `js/config.js` | Story dates, trip-engine settings (walking speed, Link pickups, room levels) and what each trip asks for |
| `data/bata.json` | BATA's schedule for the story, the vehicles on the road, and the routed walking and Link paths |
| `assets/sprites/` | The bus and van pictures: 9 angles each (mirrored to 16), side views and `manifest.json` |
| `assets/brands/` | Payment brand icons |
| `vendor/` | Pinned third-party files with their licenses, listed in `vendor/vendor.lock.json` |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

The schedule data, the sprites and the payment icons are made with HarrisXR's dev tools, which are kept outside this repo. Code comments cite sections of HarrisXR's private plan documents (for example "plan 1·4 §5"); those documents aren't published.

## Sources and credits

- Schedule data: BATA's public GTFS feed ([batabustracker.com/gtfs](https://batabustracker.com/gtfs), published by GMV Syncromatics, version 9/7/2026), listed on [bata.net](https://www.bata.net/customer-service/gtfs-data.html).
- Map: [OpenFreeMap](https://openfreemap.org/) tiles · © [OpenMapTiles](https://www.openmaptiles.org/) · © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- Walking and Link paths: routed once with [OSRM](https://project-osrm.org/) on [routing.openstreetmap.de](https://routing.openstreetmap.de/) (FOSSGIS), on © OpenStreetMap contributors' data (ODbL). The app never calls a routing server.
- [MapLibre GL JS](https://maplibre.org/) 6.12.0 (BSD-3-Clause) and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 by Kazuhiko Arase (MIT), vendored.
- Payment brand icons: [Simple Icons](https://simpleicons.org/) 16.33.0 (CC0). **Trademark note:** Payment names and logos belong to their owners and are shown only to illustrate proposed payment options. This demo has no tie to them.
- "Add to Apple Wallet" and "Add to Google Wallet" are plain buttons in this app's own style, not the official badges.
- Bus and van sprites: HarrisXR's own, from a generator adapted from HarrisXR's Max's Service GPS project. No BATA logos or words are drawn on them.
- BATA's colors were sampled from [bata.net](https://www.bata.net/). This demo isn't made, endorsed or run by BATA.

The full list, with license texts, is in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## License

© 2026 HarrisXR LLC. All rights reserved. You may view the code and run the demo to evaluate it; see [LICENSE](LICENSE). Third-party files keep their own licenses ([THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)).

## Version

**V0.1.1** · 2026-10-19
