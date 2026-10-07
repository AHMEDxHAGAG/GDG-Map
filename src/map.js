import { tracks, mapSize, compass, bearingTo, distanceTo, toLeagues } from './tracks.js';

const { gsap, ScrollToPlugin } = window;
gsap.registerPlugin(ScrollToPlugin);

const viewport = document.querySelector('#map-viewport');
const menu = document.querySelector('#island-menu');
const hint = document.querySelector('#explore-hint');
const status = document.querySelector('#map-status');
const map = document.querySelector('#map');
const skipReveal = document.querySelector('#skip-reveal');
const waveToggle = document.querySelector('#wave-toggle');
let waveAnimations = [];
let wavesPaused = false;
const gps = document.querySelector('#gps');
const gpsBearing = document.querySelector('#gps-bearing');
const gpsDegrees = document.querySelector('#gps-degrees');
const gpsTarget = document.querySelector('#gps-target');
const gpsLeagues = document.querySelector('#gps-leagues');
const gpsNeedle = document.querySelector('#gps-needle');
const compassNeedle = document.querySelector('#compass-needle');
let reducedMotion = false;
let travel;
let reveal;
let routeDrawing;
let revealStarted = false;
let guidance = 'nearest'; // 'nearest' or a track id pinned by navigation
let guidanceReady = false;
let guidanceTicking = false;

function cancelTravel() {
  if (travel) {
    travel.kill();
    travel = null;
    viewport.dataset.travelling = 'false';
  }
}

function finishReveal() {
  if (reveal) {
    const animation = reveal;
    reveal = null;
    animation.progress(1);
    animation.kill();
  }
  skipReveal.hidden = true;
}

const media = gsap.matchMedia();
media.add({ all: '(min-width: 0px)', reduce: '(prefers-reduced-motion: reduce)' }, context => {
  reducedMotion = context.conditions.reduce;
  viewport.dataset.reducedMotion = String(reducedMotion);
  waveToggle.hidden = reducedMotion;
  if (!reducedMotion) {
    const shapes = [
      'M32 53 C39 53 46 35 53 35 S67 53 74 53 S88 35 95 35',
      'M110 116 C116 116 122 130 128 130 S140 116 146 116',
    ];
    waveAnimations = [...document.querySelectorAll('.wave-mark')].map((mark, index) => gsap.to(mark, {
      attr: { d: shapes[index] }, duration: 3.2 + index * .5,
      repeat: -1, yoyo: true, ease: 'sine.inOut', paused: wavesPaused || document.hidden,
    }));
  }
  if (!revealStarted) {
    revealStarted = true;
    if (!reducedMotion && !location.hash) {
      skipReveal.hidden = false;
      reveal = gsap.fromTo(map, { opacity: .45, scale: .988, transformOrigin: `${tracks[0].x}px 300px` }, {
        opacity: 1, scale: 1, duration: .9, ease: 'power2.out', clearProps: 'transform,opacity,transformOrigin',
        onComplete: () => { skipReveal.hidden = true; reveal = null; },
      });
    }
  }
  return () => {
    waveAnimations = [];
    cancelTravel();
    finishReveal();
    routeDrawing?.kill();
    gsap.killTweensOf('.island-art');
    gsap.set('.island-art', { clearProps: 'transform' });
    gsap.ticker.remove(updateGuidance);
    guidanceTicking = false;
  };
});
waveToggle.addEventListener('click', () => {
  wavesPaused = !wavesPaused;
  waveToggle.textContent = wavesPaused ? 'Resume waves' : 'Pause waves';
  waveAnimations.forEach(animation => animation.paused(wavesPaused || document.hidden));
});
document.addEventListener('visibilitychange', () => {
  waveAnimations.forEach(animation => animation.paused(wavesPaused || document.hidden));
});
skipReveal.addEventListener('click', () => {
  finishReveal();
  viewport.focus({ preventScroll: true });
});

// The compass rose is the centre of the star and the mobile start view.
// Bearings are live: measured from the current viewport centre so the
// compass and GPS needles swing like a real GPS as you sail.
function viewportCenter() {
  return {
    x: viewport.scrollLeft + viewport.clientWidth / 2,
    y: viewport.scrollTop + viewport.clientHeight / 2,
  };
}

// Arrived when the island itself is centred on screen. Whole-card checks
// almost never pass on narrow phones, so arrivals never triggered.
function isInView(track) {
  const island = document.getElementById(track.id);
  if (!island) return false;
  const box = island.getBoundingClientRect();
  const frame = viewport.getBoundingClientRect();
  const visibleWidth = Math.min(box.right, frame.right) - Math.max(box.left, frame.left);
  const visibleHeight = Math.min(box.bottom, frame.bottom) - Math.max(box.top, frame.top);
  if (visibleWidth <= 0 || visibleHeight <= 0) return false;
  const visibleShare = visibleWidth * visibleHeight / (box.width * box.height);
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  const centred = centerX >= frame.left && centerX <= frame.right &&
    centerY >= frame.top && centerY <= frame.bottom;
  return centred && visibleShare >= .35;
}

function nearestOutOfView(from) {
  let best = null;
  let bestDistance = Infinity;
  for (const track of tracks) {
    if (isInView(track)) continue;
    const units = distanceTo(track, from);
    if (units < bestDistance) {
      best = track;
      bestDistance = units;
    }
  }
  return best;
}

function guidanceTrack() {
  const from = viewportCenter();
  if (guidance !== 'nearest') {
    const pinned = tracks.find(track => track.id === guidance);
    // Pinned popup stays until you reach its island, then hides.
    if (pinned && !isInView(pinned)) return pinned;
    guidance = 'nearest';
    if (pinned && isInView(pinned)) return null;
  }
  // Free explore: hide the popup while standing on any island,
  // otherwise point at the nearest island still off screen.
  for (const track of tracks) if (isInView(track)) return null;
  return nearestOutOfView(from);
}

function updateGuidance() {
  if (!guidanceReady) return;
  const track = guidanceTrack();
  const arrived = track === null;
  gps.hidden = arrived;
  viewport.dataset.gpsHidden = String(arrived);
  if (arrived) return;
  const from = viewportCenter();
  const { degrees, word } = bearingTo(track, from);
  gpsBearing.textContent = word;
  gpsDegrees.textContent = `${Math.round(degrees)}°`;
  gpsTarget.textContent = track.name;
  gpsLeagues.textContent = toLeagues(distanceTo(track, from));
  gps.style.setProperty('--accent', track.accent);
  if (reducedMotion) {
    gpsNeedle.setAttribute('transform', `rotate(${degrees})`);
    compassNeedle.setAttribute('transform', `rotate(${degrees})`);
    return;
  }
  gsap.to(gpsNeedle, { rotation: degrees, svgOrigin: '0 0', duration: .45, ease: 'power2.out', overwrite: true });
  gsap.to(compassNeedle, { rotation: degrees, svgOrigin: `${compass.x} ${compass.y}`, duration: .45, ease: 'power2.out', overwrite: true });
}

function scheduleGuidance() {
  if (!guidanceReady || guidanceTicking) return;
  guidanceTicking = true;
  gsap.ticker.add(updateGuidance);
}

function emphasizeIsland(track) {
  routeDrawing?.kill();
  gsap.killTweensOf('.island-art');
  gsap.set('.island-art', { clearProps: 'transform' });
  if (reducedMotion) return;
  gsap.fromTo(`#${track.id} .island-art`, { scale: 1 }, { scale: 1.05, duration: .28, repeat: 1, yoyo: true, ease: 'sine.inOut', clearProps: 'transform' });
  const path = document.querySelector(`#route-${track.id}`);
  const svg = path.ownerSVGElement;
  const namespace = 'http://www.w3.org/2000/svg';
  const mask = document.createElementNS(namespace, 'mask');
  mask.id = 'route-reveal';
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  mask.setAttribute('x', '0'); mask.setAttribute('y', '0');
  mask.setAttribute('width', String(mapSize.width)); mask.setAttribute('height', String(mapSize.height));
  const stroke = path.cloneNode();
  stroke.removeAttribute('id');
  const length = path.getTotalLength();
  stroke.setAttribute('fill', 'none');
  stroke.setAttribute('stroke', 'white');
  stroke.setAttribute('stroke-width', '10');
  stroke.setAttribute('stroke-dasharray', `${length} ${length}`);
  mask.append(stroke);
  svg.querySelector('defs').append(mask);
  path.setAttribute('mask', 'url(#route-reveal)');
  const cleanRoute = () => { path.removeAttribute('mask'); mask.remove(); routeDrawing = null; };
  routeDrawing = gsap.fromTo(stroke, { strokeDashoffset: length }, {
    strokeDashoffset: 0, duration: .65, ease: 'power1.inOut', onComplete: cleanRoute, onInterrupt: cleanRoute,
  });
}

function destination(track) {
  const island = document.getElementById(track.id);
  return {
    left: Math.max(0, track.x - viewport.clientWidth / 2),
    top: Math.max(0, track.y - Math.max(90, (viewport.clientHeight - island.offsetHeight) / 2)),
  };
}

function selectIsland(track, focus = true, animate = true) {
  finishReveal();
  cancelTravel();
  guidance = track.id;
  guidanceReady = true;
  scheduleGuidance();
  document.querySelectorAll('.island').forEach(island => island.classList.toggle('is-selected', island.id === track.id));
  const arrive = () => {
    travel = null;
    viewport.dataset.travelling = 'false';
    if (focus) document.querySelector(`#${track.id} h2`).focus({ preventScroll: true });
    status.textContent = `${track.name} island. Join the crew to open its WhatsApp group.`;
    if (animate) emphasizeIsland(track);
  };
  const { left, top } = destination(track);
  if (reducedMotion || !animate) {
    viewport.scrollTo({ left, top });
    arrive();
  } else {
    viewport.dataset.travelling = 'true';
    travel = gsap.to(viewport, {
      scrollTo: { x: left, y: top, autoKill: true, onAutoKill: cancelTravel },
      duration: .95, ease: 'power2.inOut', onComplete: arrive,
    });
  }
}

document.querySelectorAll('.island-menu a').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    menu.open = false;
    dismissHint();
    viewport.focus({ preventScroll: true });
    const track = tracks.find(track => `#${track.id}` === link.hash);
    history.pushState(null, '', link.hash);
    selectIsland(track);
  });
});

document.addEventListener('click', event => {
  if (!event.target.closest('.navigation')) menu.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  menu.open = true;
  menu.querySelector('summary').focus();
});

function openHash() {
  const track = tracks.find(track => `#${track.id}` === location.hash);
  if (track) {
    selectIsland(track, false, false);
    return;
  }
  // Open on the compass rose at the centre of the star. Centre immediately,
  // then re-centre once layout and fonts settle so URL bars and webfonts
  // cannot leave mobile visitors at the corner of the map.
  const centreCompass = () => {
    viewport.scrollTo({
      left: Math.max(0, Math.min(compass.x - viewport.clientWidth / 2, mapSize.width - viewport.clientWidth)),
      top: Math.max(0, Math.min(compass.y - viewport.clientHeight / 2, mapSize.height - viewport.clientHeight)),
    });
  };
  centreCompass();
  requestAnimationFrame(centreCompass);
  document.fonts?.ready.then(() => centreCompass());
}
window.addEventListener('hashchange', openHash);
openHash();

function dismissHint() {
  hint.hidden = true;
  try { localStorage.setItem('gdgoc-map-explored', 'yes'); } catch { /* Exploration still works without storage. */ }
}
try { hint.hidden = localStorage.getItem('gdgoc-map-explored') === 'yes'; } catch { hint.hidden = false; }
document.querySelector('#dismiss-hint').addEventListener('click', dismissHint);
viewport.addEventListener('touchmove', dismissHint, { passive: true, once: true });
viewport.addEventListener('wheel', dismissHint, { passive: true, once: true });

// Guidance follows every native scroll, in both axes, without touching the gesture.
for (const type of ['scroll', 'touchend']) viewport.addEventListener(type, updateGuidance, { passive: true });
// A resize (or mobile URL-bar collapse) can move the compass without a scroll.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateGuidance, 120);
});
document.fonts?.ready.then(updateGuidance);
guidanceReady = true;
scheduleGuidance();
updateGuidance();

// Observe intent; never prevent defaults or translate a native touch gesture.
for (const type of ['wheel', 'touchstart', 'pointerdown']) {
  viewport.addEventListener(type, () => { cancelTravel(); finishReveal(); }, { passive: true });
}
document.addEventListener('keydown', event => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab', 'Escape'].includes(event.key)) {
    cancelTravel();
    finishReveal();
  }
});
