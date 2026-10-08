import { tracks, mapSize, compass } from './tracks.js';

const { gsap, ScrollToPlugin } = window;
gsap.registerPlugin(ScrollToPlugin);

const viewport = document.querySelector('#map-viewport');
const menu = document.querySelector('#island-menu');
const hint = document.querySelector('#explore-hint');
const status = document.querySelector('#map-status');
const map = document.querySelector('#map');
const skipReveal = document.querySelector('#skip-reveal');
// Touch devices skip decorative tweens entirely (reveal + arrival pop):
// the scrolling itself is the motion, and killing the ticker is the biggest
// single perf win on mobile GPUs.
const isCoarsePointer = matchMedia('(pointer: coarse)').matches;
const arrowLayer = document.querySelector('#edge-arrows');
let reducedMotion = false;
let travel;
let reveal;
let revealStarted = false;
// Edge arrows: one fixed-position arrow per island, pinned to the screen
// edge nearest that island. Tapping an arrow sails to its island; the arrow
// hides once its island is in view and returns when you sail away.

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
  // Waves are static artwork: no wave tweens on any device, so there is no
  // background ticker draining the battery while you explore.
  if (!revealStarted) {
    revealStarted = true;
    // Perf revamp: the full-map scale reveal forces a 1880x1940 repaint
    // every frame for almost a second on load. Touch devices skip it and
    // just appear — the compass-first view is the reveal.
    if (!reducedMotion && !isCoarsePointer && !location.hash) {
      skipReveal.hidden = false;
      reveal = gsap.fromTo(map, { opacity: .45, scale: .988, transformOrigin: `${tracks[0].x}px 300px` }, {
        opacity: 1, scale: 1, duration: .9, ease: 'power2.out', clearProps: 'transform,opacity,transformOrigin',
        onComplete: () => { skipReveal.hidden = true; reveal = null; },
      });
    }
  }
  return () => {
    cancelTravel();
    finishReveal();
    gsap.killTweensOf('.island-art');
    gsap.set('.island-art', { clearProps: 'transform' });
  };
});
skipReveal.addEventListener('click', () => {
  finishReveal();
  viewport.focus({ preventScroll: true });
});

// In-view check: the island counts as reached when its centre is on screen
// with at least ~35% of its card visible. Whole-card checks almost never
// pass on narrow phones, so arrows would never hide.
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

// Edge arrows: one tappable arrow per island, pinned to the screen edge
// nearest that island. Each arrow hides while its island is in view and
// returns when you sail away. No ticker, no per-frame tweens: updates are
// rAF-throttled from scroll and only write when placement changes.
const arrowButtons = new Map();

function buildArrows() {
  arrowLayer.textContent = '';
  arrowButtons.clear();
  for (const track of tracks) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'edge-arrow';
    button.style.setProperty('--accent', track.accent);
    button.dataset.track = track.id;
    button.hidden = true;
    button.setAttribute('aria-label', 'Sail to ' + track.name);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '-14 -14 28 28');
    icon.setAttribute('aria-hidden', 'true');
    const head = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    head.setAttribute('d', 'M0-9 L7 6 L0 2.5 L-7 6 Z');
    icon.append(head);
    const label = document.createElement('span');
    label.textContent = track.name;
    button.append(icon, label);
    button.addEventListener('click', () => {
      dismissHint();
      viewport.focus({ preventScroll: true });
      history.pushState(null, '', '#' + track.id);
      selectIsland(track);
    });
    arrowLayer.append(button);
    arrowButtons.set(track.id, button);
  }
}

let arrowsQueued = false;

function updateArrows() {
  if (arrowsQueued) return;
  arrowsQueued = true;
  requestAnimationFrame(() => {
    arrowsQueued = false;
    const frame = viewport.getBoundingClientRect();
    // Asymmetric pads keep arrows clear of the fixed menu (top) and hint
    // (bottom) while staying near the true screen edge on the sides.
    const minX = frame.left + 60;
    const maxX = frame.right - 60;
    const minY = frame.top + 100;
    const maxY = frame.bottom - 96;
    const midX = frame.left + frame.width / 2;
    const midY = frame.top + frame.height / 2;
    for (const track of tracks) {
      const button = arrowButtons.get(track.id);
      if (!button) continue;
      const island = document.getElementById(track.id);
      if (!island) {
        if (!button.hidden) button.hidden = true;
        continue;
      }
      const box = island.getBoundingClientRect();
      const islandX = box.left + box.width / 2;
      const islandY = box.top + box.height / 2;
      const visibleWidth = Math.min(box.right, frame.right) - Math.max(box.left, frame.left);
      const visibleHeight = Math.min(box.bottom, frame.bottom) - Math.max(box.top, frame.top);
      const share = visibleWidth > 0 && visibleHeight > 0
        ? visibleWidth * visibleHeight / (box.width * box.height)
        : 0;
      const inView = islandX >= frame.left && islandX <= frame.right &&
        islandY >= frame.top && islandY <= frame.bottom && share >= .35;
      if (inView) {
        if (!button.hidden) button.hidden = true;
        button.dataset.placed = '';
        continue;
      }
      const dx = islandX - midX;
      const dy = islandY - midY;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      const candidates = [];
      if (dx > 0) candidates.push((maxX - midX) / dx);
      else if (dx < 0) candidates.push((minX - midX) / dx);
      if (dy > 0) candidates.push((maxY - midY) / dy);
      else if (dy < 0) candidates.push((minY - midY) / dy);
      const valid = candidates.filter(value => value > 0);
      const t = Math.min.apply(null, valid.length ? valid : [1]);
      let edgeX = midX + dx * t;
      const edgeY = midY + dy * t;
      // The fixed island menu sits top-right: slide arrows left along the
      // top edge instead of parking them underneath it.
      if (edgeY < frame.top + 140 && edgeX > frame.right - 230) edgeX = frame.right - 230;
      if (button.hidden) button.hidden = false;
      const key = Math.round(edgeX - frame.left) + '|' + Math.round(edgeY - frame.top) + '|' + Math.round(angle);
      if (button.dataset.placed === key) continue;
      button.dataset.placed = key;
      button.style.transform = 'translate(' + (edgeX - frame.left) + 'px, ' + (edgeY - frame.top) + 'px) translate(-50%, -50%)';
      button.firstChild.style.transform = 'rotate(' + angle + 'deg)';
    }
  });
}

function emphasizeIsland(track) {
  gsap.killTweensOf('.island-art');
  gsap.set('.island-art', { clearProps: 'transform' });
  // Perf revamp: the island pop is a main-thread tween firing on every
  // arrival. Touch skips it (the scroll IS the motion); desktop keeps it.
  if (reducedMotion || isCoarsePointer) {
    updateArrows();
    return;
  }
  gsap.fromTo(`#${track.id} .island-art`, { scale: 1 }, { scale: 1.05, duration: .28, repeat: 1, yoyo: true, ease: 'sine.inOut', clearProps: 'transform' });
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
  document.querySelectorAll('.island').forEach(island => island.classList.toggle('is-selected', island.id === track.id));
  const arrive = () => {
    travel = null;
    viewport.dataset.travelling = 'false';
    if (focus) document.querySelector(`#${track.id} h2`).focus({ preventScroll: true });
    status.textContent = `${track.name} island. Join the crew to open its WhatsApp group.`;
    updateArrows();
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
  // Open on the compass rose near the middle of the map. Centre immediately,
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

buildArrows();
updateArrows();
// Arrows follow every native scroll, in both axes, without touching the gesture.
for (const type of ['scroll', 'touchend']) viewport.addEventListener(type, updateArrows, { passive: true });
// A resize (or mobile URL-bar collapse) can move islands without a scroll.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateArrows, 120);
});
document.fonts?.ready.then(updateArrows);

// Crew banners are tiny (~7-19 KiB each); load them with the stylesheet
// instead of swapping backgrounds in JS — no flash, no zoom stutter.
for (const link of document.querySelectorAll('.crew-link')) link.classList.add('has-banner');

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
