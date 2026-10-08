import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { tracks, mapSize } from '../src/tracks.js';

test('all five tracks use the supplied WhatsApp destinations', async () => {
  const source = await readFile('assests/whatsapp/whatsapp.md', 'utf8');
  const urls = [...source.matchAll(/\]\((https:\/\/chat\.whatsapp\.com\/[^)]+)\)/g)].map(match => match[1]);
  assert.equal(tracks.length, 5);
  assert.equal(new Set(tracks.map(track => track.id)).size, 5);
  assert.deepEqual(tracks.map(track => track.whatsapp), urls);
});

test('each island fits inside the shared two-dimensional map', () => {
  for (const track of tracks) {
    assert.ok(track.x >= 140 && track.x + 140 <= mapSize.width, track.id);
    assert.ok(track.y >= 0 && track.y + 470 < mapSize.height, track.id);
    assert.ok(track.description.length < 75);
  }
});

test('five islands occupy the top, side, and lower tips of a star', () => {
  const [top, right, left, lowerLeft, lowerRight] = tracks;
  assert.ok(left.x < lowerLeft.x && lowerLeft.x < top.x);
  assert.ok(top.x < lowerRight.x && lowerRight.x < right.x);
  assert.ok(top.y < left.y && top.y < right.y);
  assert.equal(left.y, right.y);
  assert.equal(lowerLeft.y, lowerRight.y);
  assert.ok(lowerLeft.y > left.y + 470);
});

test('crew banners are optimized copies with actual HTML link text', async () => {
  const css = await readFile('dist/map.css', 'utf8');
  assert.match(css, /crew-banner-640\.webp/);
  assert.equal((await readFile('dist/index.html', 'utf8')).match(/>Join the crew<\/a>/g).length, 5);
  for (const size of [320, 640]) {
    const image = await readFile(`dist/images/crew-banner-${size}.webp`);
    assert.equal(image.toString('ascii', 8, 12), 'WEBP');
    assert.ok(image.length < 100000);
  }
  assert.ok((await stat('assests/shared-visual/Antique Pirate Treasure Map Banner.png')).size > 2000000);
});

test('built HTML contains real, accessible crew links and jump destinations', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  assert.match(html, /<html lang="en">/);
  assert.ok(!html.includes('{{'));
  assert.equal((html.match(/class="crew-link"/g) || []).length, 5);
  for (const track of tracks) {
    assert.ok(html.includes(`href="#${track.id}"`));
    assert.ok(html.includes(`id="${track.id}"`));
    assert.ok(html.includes(`aria-labelledby="${track.id}-title"`));
    assert.ok(html.includes(`Join the ${track.name} crew on WhatsApp`));
  }
  assert.equal((html.match(/rel="noopener noreferrer"/g) || []).length, 5);
});

test('responsive WebP copies stay small and original images are preserved', async () => {
  for (const track of tracks) {
    assert.ok((await stat(`assests/islands/${track.artwork}.png`)).size > 1000000);
    // 320w covers 1x phones (260px art); 520w covers 2x DPR exactly.
    for (const size of [320, 520]) {
      const path = `dist/images/${track.artwork}-${size}.webp`;
      const image = await readFile(path);
      assert.equal(image.toString('ascii', 8, 12), 'WEBP');
      assert.ok(image.length < 100000, path);
    }
  }
  // No stale 640w copies: they overshot 2x DPR by 23% at ~30% extra bytes.
  for (const track of tracks) {
    await assert.rejects(stat(`dist/images/${track.artwork}-640.webp`));
  }
});

test('first paint ships no island bytes: placeholders defer to data-src', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  assert.ok(!html.includes('fetchpriority="high"'));
  assert.equal((html.match(/data-src="\/images\//g) || []).length, 5);
  assert.equal((html.match(/loading="lazy"/g) || []).length, 5);
  // Placeholders keep layout; real bytes only arrive via data-src/srcset.
  // Strip <noscript> fallbacks first: they intentionally carry real src.
  const withoutNoscript = html.replaceAll(/<noscript>.*?<\/noscript>/gs, '');
  assert.ok(!withoutNoscript.match(/<img src="\/images\//));
  assert.ok(html.includes('<noscript><img src="/images/'));
});

test('native scrolling, safe areas, and reduced motion are part of the foundation', async () => {
  const css = await readFile('dist/map.css', 'utf8');
  assert.match(css, /touch-action:pan-x pan-y/);
  assert.match(css, /overflow:auto/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.ok(!css.includes('scroll-snap'));
});
