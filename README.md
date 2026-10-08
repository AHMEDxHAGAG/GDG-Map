# GDGoC Pirate Expedition

Vercel

An English-only, mobile-first treasure map for GDGoC AASTMT Aswan. Five illustrated technology islands link directly to their WhatsApp crews. Static HTML, CSS, and JavaScript; no backend or runtime third-party requests.

## Run

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. Restart `npm run dev` after source changes, or run `npm run build` while the server is running. `dist/` is the deployable static site.

## Edit the map

- `src/tracks.js`: single configuration for names, descriptions, artwork, coordinates, accent colors, and WhatsApp links. Coordinates use an 1880 × 1940 map, with each island's horizontal center and top edge. Web occupies the top point, Data Science and AI the side points, and Software Engineering and Cybersecurity the lower points of a star-shaped sailing route.
- `src/index.html`: map template, dotted routes, compass, ship, GPS guidance popup, and navigation.
- `src/map.css`: supplied visual palette, Pirata One headings, Nunito Sans controls, and safe-area handling.
- `src/map.js`: native scrolling, first-visit hint, GSAP reveal, ScrollToPlugin travel, gently rolling SVG waves, mobile compass-first start view, live per-track GPS guidance that hides on arrival, interruption handling, and reduced-motion preferences via `gsap.matchMedia()`.
- `scripts/build.mjs`: renders actual island HTML and links, then copies local fonts, artwork, and GSAP into `dist/`.

The original files in `assests/` are never modified. Every Join the crew link uses optimized copies of `assests/shared-visual/Antique Pirate Treasure Map Banner.png` behind real HTML text. To regenerate responsive WebP copies, install ImageMagick with the `magick` command and run `npm run optimize`. Islands ship 320w (1x phones) + 520w (2x DPR exactly) copies; the banner keeps 320w + 640w for crisp text-like buttons. Both font families are self-hosted with their SIL Open Font licenses in `public/fonts/`.

## Performance

Islands render small 320w/520w WebP directly — no placeholder swapping (it flashes and stutters under mobile pinch-zoom). `decoding="async"` + `fetchpriority="low"` keep images off the critical path. `content-visibility:auto` sits only on the fixed-size `img`, never on the island card (that collapsed layout under zoom). Mobile waves use a compositor-only opacity swell instead of `d`-morphing. Images and fonts carry immutable year-long cache headers on Vercel; repeat visits load from cache. Total optimized images: ~486 KiB (`public/images/`), `dist/` ~716 KiB.

## Interaction and accessibility

Touch gestures scroll the overflow container natively, including diagonal swipes. There is no drag-to-pan handler, scroll snapping, scroll hijacking, or ScrollSmoother. On desktop, use the same map with trackpad scrolling, scrollbars, arrow keys, or the island menu.

Island navigation travels on both axes. The map opens centred on the compass rose, and a GPS-style popup shows the live compass direction and distance to the selected (or nearest) island, hiding while you stand on an island and returning when you sail away. Wheel, touch, pointer, and navigation-key input cancel travel; focus is moved to the island heading only on arrival. Crew links open WhatsApp in a new tab and are labeled accordingly. All controls meet a 44px minimum target height. A brief reveal can be skipped, and reduced-motion navigation is instant. Real HTML links and the native island menu remain usable without JavaScript.

The wave marks gently change shape rather than moving the map or its islands. Use Pause waves / Resume waves in Find an island to stop or restart them. Waves stop while the page is hidden and remain static for reduced-motion visitors.

## Test

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite covers 360 × 800, 390 × 844, 430 × 932, and desktop 1280 × 900. It checks navigation, links, keyboard access, target sizes, wheel/touch cancellation, diagonal swipes, accidental taps, reduced motion, changing motion preferences, reveal skipping, direct links/history, hint persistence, no-JavaScript fallback, and a throttled cold-load budget. WhatsApp navigation is intercepted locally during tests; tests do not visit or join groups.

If using an existing Chromium installation, set `CHROMIUM_EXECUTABLE` to its executable path. Browser screenshots and failure traces are generated under ignored `test-results/`.

## Deploy

`vercel.json` configures `npm run build` and the `dist/` output directory. Deploy previews with `vercel deploy`; do not add `--prod` unless a production deployment is intended. The project is `gdgoc-pirate-expedition`.

Milestone previews:

1. [Map foundation](https://gdgoc-pirate-expedition-d1a2w89cf-ahmedheagag23-2773s-projects.vercel.app)
2. [GSAP interactions](https://gdgoc-pirate-expedition-puugbe8y1-ahmedheagag23-2773s-projects.vercel.app)
3. [Mobile polish](https://gdgoc-pirate-expedition-80t7bivf9-ahmedheagag23-2773s-projects.vercel.app)
4. [Star layout, parchment crew banners, and rolling waves — latest preview](https://gdgoc-pirate-expedition-ehli4938l-ahmedheagag23-2773s-projects.vercel.app)

Vercel automatically assigned the very first deployment a production alias when creating the project. The URLs above are separate previews; that initial production alias is not updated by this workflow.

`scripts/preview-payload.mjs` is an optional loopback-only helper for supplying compiled files to Vercel MCP when CLI credentials are unavailable. It contains no credentials and is not included in the deployed site.

## Verification

All 8 configuration/build checks and 68 Chromium browser tests passed (across 360 × 800, 390 × 844, 430 × 932, and desktop 1280 × 900), including the compass-first start view and GPS popup that hides on arrival. Four mobile-only checks are intentionally skipped in the desktop project, and the full-map overview is captured once on desktop rather than repeated on mobile. The three mobile widths passed native diagonal scrolling, accidental-tap prevention, and touch cancellation using browser-generated touch input. Banner rendering, wave motion, pause/resume, and disabling waves for reduced motion are also covered.

The updated map passes cold-load budgets of 1.1 MB transferred, 5s DOM ready / largest contentful paint, and cumulative layout shift below 0.1, with cache disabled, 100ms latency, and 400 KB/s download throughput. These are local Chromium emulation results, not production performance guarantees or physical-device Safari testing. Screenshots (including `star-map-overview.png`) and per-width loading metrics are in `test-results/` after a test run.
