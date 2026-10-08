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

- `src/tracks.js`: single configuration for names, descriptions, artwork, coordinates, accent colors, and WhatsApp links. Coordinates use an 1880 × 1940 map, with each island's horizontal center and top edge. The five islands are scattered irregularly with wide water between each pair — no shared rows, columns, or formation.
- `src/index.html`: map template, compass, ship, edge-arrow guidance, and navigation.
- `src/map.css`: supplied visual palette, Pirata One headings, Nunito Sans controls, edge arrows pinned to the screen edge, and safe-area handling.
- `src/map.js`: native scrolling, first-visit hint, GSAP reveal (desktop only), ScrollToPlugin travel, compass-first start view, edge arrows per island that hide on arrival, interruption handling, and reduced-motion preferences via `gsap.matchMedia()`. Touch devices run zero decorative tweens.
- `scripts/build.mjs`: renders actual island HTML and links, then copies local fonts, artwork, and GSAP into `dist/`.

The original files in `assests/` are never modified. Every Join the crew link uses optimized copies of `assests/shared-visual/Antique Pirate Treasure Map Banner.png` behind real HTML text. To regenerate responsive WebP copies, install ImageMagick with the `magick` command and run `npm run optimize`. Islands ship 320w (1x phones) + 520w (2x DPR exactly) copies; the banner keeps 320w + 640w for crisp text-like buttons. Both font families are self-hosted with their SIL Open Font licenses in `public/fonts/`.

## Performance

Islands render small 320w/520w WebP directly — no placeholder swapping (it flashes and stutters under mobile pinch-zoom). `decoding="async"` + `fetchpriority="low"` keep images off the critical path. `content-visibility:auto` sits only on the fixed-size `img`, never on the island card (that collapsed layout under zoom). Touch devices skip every decorative tween except a compositor-only wave-opacity swell (no path morphs, no reveal scale, no island pop) and drop the `feTurbulence` paper grain plus five of six background gradients — scrolling is then a plain compositor translation. Edge arrows update on a single rAF-throttled scroll listener with writes only when placement changes; there is no per-frame ticker. Images and fonts carry immutable year-long cache headers on Vercel; repeat visits load from cache. Total optimized images: ~486 KiB (`public/images/`), `dist/` ~716 KiB. No loading screen: first paint already ships small and a loader would only add weight without fixing scroll cost.

## Interaction and accessibility

Touch gestures scroll the overflow container natively, including diagonal swipes. There is no drag-to-pan handler, scroll snapping, scroll hijacking, or ScrollSmoother. On desktop, use the same map with trackpad scrolling, scrollbars, arrow keys, or the island menu.

Island navigation travels on both axes. The map opens centred on the compass rose, and one tappable arrow per island pins to the screen edge nearest that island — arrowhead rotated toward it plus the island name. Tapping an arrow sails to its island; that island's arrow hides while its centre is on screen with ~35% of its card visible, and returns when you sail away. Wheel, touch, pointer, and navigation-key input cancel travel; focus is moved to the island heading only on arrival. Crew links open WhatsApp in a new tab and are labeled accordingly. All controls meet a 44px minimum target height. A brief desktop reveal can be skipped (touch has none to skip), and reduced-motion navigation is instant. Real HTML links and the native island menu remain usable without JavaScript.

On desktop the wave marks gently change shape rather than moving the map or its islands. Touch devices swell the same marks via opacity instead (cheap enough to keep running while scrolling). Use Pause waves / Resume waves in Find an island to stop or restart them on any device. Waves stop while the page is hidden, and remain static for reduced-motion visitors.

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

All 8 configuration/build checks and 68 Chromium browser tests passed (across 360 × 800, 390 × 844, 430 × 932, and desktop 1280 × 900), including the compass-first start view and edge arrows that hide on arrival. Four mobile-only checks are intentionally skipped in the desktop project, and the full-map overview is captured once on desktop rather than repeated on mobile. The three mobile widths passed native diagonal scrolling, accidental-tap prevention, and touch cancellation using browser-generated touch input. Banner rendering, wave motion with pause/resume on desktop and touch, and disabling waves for reduced motion are also covered.

The updated map passes cold-load budgets of 1.1 MB transferred, 5s DOM ready / largest contentful paint, and cumulative layout shift below 0.1, with cache disabled, 100ms latency, and 400 KB/s download throughput. These are local Chromium emulation results, not production performance guarantees or physical-device Safari testing. Screenshots (including `scattered-map-overview.png`) and per-width loading metrics are in `test-results/` after a test run.
