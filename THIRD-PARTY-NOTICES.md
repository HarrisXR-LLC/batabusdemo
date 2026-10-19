# Third-party notices

"bata go" is © 2026 HarrisXR LLC (see [LICENSE](LICENSE)). It uses the material below, which keeps its own license and owners.

## Code (in `vendor/`)

| Component | Version | License | Where |
|---|---|---|---|
| [MapLibre GL JS](https://maplibre.org/) | 6.12.0 | BSD-3-Clause, © MapLibre contributors | `vendor/maplibre-gl-6.12.0/`; the full license is in `vendor/maplibre-gl-6.12.0/LICENSE.txt` |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | 1.4.4 | MIT, © 2009 Kazuhiko Arase | `vendor/qrcode-generator-1.4.4/qrcode.js` (the notice is in its header; the text is below) |

The exact versions and the SHA-256 of every vendored file are in `vendor/vendor.lock.json`.

"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

<details><summary>The MIT license (qrcode-generator)</summary>

```
Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

</details>

## Icons

| Material | License | Where |
|---|---|---|
| Payment brand icons (Apple Pay, Google Pay, PayPal, Cash App, Venmo, Zelle) from [Simple Icons](https://simpleicons.org/) 16.33.0 | CC0 1.0 | `assets/brands/` |

**Trademark note:** Payment names and logos belong to their owners and are shown only to illustrate proposed payment options. This demo has no tie to them, and no payment is made. "Add to Apple Wallet" and "Add to Google Wallet" are plain buttons in this app's own style, not the official badges.

The line icons (`assets/icons.svg`) and the bus and van pictures (`assets/sprites/`) are HarrisXR's own.

## Map and routing data

| Source | Terms | Used for |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) | The map, and the walking and Link paths in `data/bata.json` |
| [OpenFreeMap](https://openfreemap.org/) and [OpenMapTiles](https://www.openmaptiles.org/) | Their attribution terms | Map tiles and the Positron style, loaded at run time from `tiles.openfreemap.org` (not stored here) |
| [OSRM](https://project-osrm.org/) on [routing.openstreetmap.de](https://routing.openstreetmap.de/) (FOSSGIS) | Their usage policy | The walking and Link paths, routed once when the data was built; the app never calls a routing server |

The app shows these credits on the map (the "i" button).

## Schedule data

| Source | Terms | Used for |
|---|---|---|
| BATA's public GTFS feed ([batabustracker.com/gtfs](https://batabustracker.com/gtfs), published by GMV Syncromatics, feed version 9/7/2026; listed on [bata.net](https://www.bata.net/customer-service/gtfs-data.html)) | No license is stated. The data belongs to BATA. | The routes, stops, times, shapes and fares in `data/bata.json` |

BATA's colors were sampled from [bata.net](https://www.bata.net/). This demo isn't made, endorsed or run by BATA.
