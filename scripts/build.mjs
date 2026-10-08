import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tracks, mapSize, compass } from '../src/tracks.js';

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const navigation = tracks.map(track => `<a href="#${track.id}" style="--accent:${track.accent}">${escape(track.name)}</a>`).join('\n');
// Islands render real images directly (no placeholder swapping: it flashes
// ugly and stutters under mobile pinch-zoom). The files are small 320w/520w
// WebP with decoding=async + fetchpriority low so they paint without
// blocking first paint.
const islands = tracks.map(track => `
  <section class="island" id="${track.id}" aria-labelledby="${track.id}-title" style="--x:${track.x}px;--y:${track.y}px;--accent:${track.accent}">
    <div class="island-art"><img src="/images/${track.artwork}-320.webp" srcset="/images/${track.artwork}-320.webp 320w, /images/${track.artwork}-520.webp 520w" sizes="(max-width: 430px) 260px, 260px" width="260" height="260" alt="" decoding="async" fetchpriority="low" draggable="false"></div>
    <h2 id="${track.id}-title" tabindex="-1">${escape(track.name)}</h2>
    <p>${escape(track.description)}</p>
    <a class="crew-link" href="${escape(track.whatsapp)}" target="_blank" rel="noopener noreferrer" aria-label="Join the ${escape(track.name)} crew on WhatsApp (opens in a new tab)">Join the crew</a>
  </section>`).join('\n');
let html = await readFile('src/index.html', 'utf8');
const seaMask = tracks.map(track => `<rect x="${track.x - 145}" y="${track.y}" width="290" height="470" fill="black"/>`).join('');
for (const [key, value] of Object.entries({ NAVIGATION: navigation, ISLANDS: islands, SEA_MASK: seaMask, MAP_WIDTH: mapSize.width, MAP_HEIGHT: mapSize.height, TITLE_X: tracks[0].x - 165, TITLE_MASK_X: tracks[0].x - 180, COMPASS_X: compass.x, COMPASS_Y: compass.y })) html = html.replaceAll(`{{${key}}}`, value);
await mkdir('dist', { recursive: true });
// cp() never deletes: drop stale optimized copies (e.g. retired 640w
// islands) so dist/ cannot ship bytes the HTML no longer references.
for (const stale of ['dist/images', 'dist/vendor']) await rm(stale, { recursive: true, force: true });
await cp('public', 'dist', { recursive: true });
await mkdir('dist/vendor', { recursive: true });
for (const file of ['gsap.min.js', 'ScrollToPlugin.min.js']) await cp(`node_modules/gsap/dist/${file}`, `dist/vendor/${file}`);
for (const file of ['map.css', 'map.js', 'tracks.js']) await cp(`src/${file}`, `dist/${file}`);
await writeFile('dist/index.html', html);
console.log(`Built a static ${tracks.length}-island map in dist/.`);
