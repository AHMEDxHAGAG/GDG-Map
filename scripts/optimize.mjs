import { mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tracks } from '../src/tracks.js';

await mkdir('public/images', { recursive: true });
let originals = 0, optimized = 0;
for (const track of tracks) {
  const original = `assests/islands/${track.artwork}.png`;
  originals += (await stat(original)).size;
  // 320w covers 1x phones (260px art), 520w covers 2x DPR exactly (260*2).
  // 640w overshot by 23% and cost ~30% extra bytes per island.
  for (const [size, quality] of [[320, 60], [520, 62]]) {
    const output = `public/images/${track.artwork}-${size}.webp`;
    execFileSync('magick', [original, '-resize', `${size}x${size}`, '-strip', '-quality', String(quality), '-define', 'webp:method=6', '-define', 'webp:alpha-quality=82', output]);
    optimized += (await stat(output)).size;
  }
}
const banner = 'assests/shared-visual/Antique Pirate Treasure Map Banner.png';
originals += (await stat(banner)).size;
// The banner is text-like artwork on buttons, so keep the 640w copy for
// crisp 2x rendering; islands drop to 520w (260px art × 2 DPR exactly).
for (const [size, quality] of [[320, 60], [640, 62]]) {
  const output = `public/images/crew-banner-${size}.webp`;
  execFileSync('magick', [banner, '-resize', `${size}x`, '-strip', '-quality', String(quality), '-define', 'webp:method=6', output]);
  optimized += (await stat(output)).size;
}
console.log(`Originals preserved: ${(originals / 1048576).toFixed(2)} MiB. Responsive copies: ${(optimized / 1024).toFixed(0)} KiB total.`);
