import { mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tracks } from '../src/tracks.js';

await mkdir('public/images', { recursive: true });
let originals = 0, optimized = 0;
for (const track of tracks) {
  const original = `assests/islands/${track.artwork}.png`;
  originals += (await stat(original)).size;
  for (const size of [320, 640]) {
    const output = `public/images/${track.artwork}-${size}.webp`;
    execFileSync('magick', [original, '-resize', `${size}x${size}`, '-strip', '-quality', '82', '-define', 'webp:alpha-quality=90', output]);
    optimized += (await stat(output)).size;
  }
}
const banner = 'assests/shared-visual/Antique Pirate Treasure Map Banner.png';
originals += (await stat(banner)).size;
for (const size of [320, 640]) {
  const output = `public/images/crew-banner-${size}.webp`;
  execFileSync('magick', [banner, '-resize', `${size}x`, '-strip', '-quality', '82', '-define', 'webp:alpha-quality=90', output]);
  optimized += (await stat(output)).size;
}
console.log(`Originals preserved: ${(originals / 1048576).toFixed(2)} MiB. Responsive copies: ${(optimized / 1024).toFixed(0)} KiB total.`);
