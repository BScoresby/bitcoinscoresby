'use strict';

// The Electric Cowboy v0.4.2 — browser-only Nostr relay zap feed.
// The zap-catching game, independent of Lightning Cowboy. Ordinary lightning awards zero sats.
// Pixel palette, cowboy hat and procedural lightning style are adapted from
// our original Lightning Cowboy prototype; lightning is yellow, crisp, and unblurred.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const GROUND = 335;
const INK = '#f5f5f5';
const DIM = '#777777';
const BLACK = '#000000';
const ELECTRIC = '#fada5e';

// All values intentionally grouped for playtesting.
// v0.3.1 retains the readable *buildup*, thickens the bolt and holds it briefly.
// The overall event cadence and movement stay the same as v0.3; a smaller
// ground landing tolerance helps compensate for body-and-branch catches.
const MOVE_SPEED = 540;             // px / second while held (v0.1: 395)
const ZAP_INTERVAL_MIN = 0.47;       // offset the longer flash: overall strike pace unchanged
const ZAP_INTERVAL_MAX = 1.09;       // same ~1.49–2.11 s between starts as v0.3
const BUILDUP_SECONDS = 0.85;        // playable anticipatory electrical buildup
const STRIKE_SECONDS = 0.17;         // quick full-bolt flash + an extra 70 ms to read it
const CONTACT_DELAY = 0.025;        // lightning scores as the flash arrives
const ELECTROCUTE_SECONDS = 0.48;
const RUN_FRAME_SECONDS = 0.10;      // 4 chunky leg poses
const MAX_HORIZONTAL_DRIFT = W / 3;
const CATCH_RADIUS = 33;            // narrower landing tolerance; visible bolt touches also count
const MAX_MISSES = 3;
const MAIN_BOLT_PIXEL_SIZE = 3;     // v0.3: 2px; branches stay 1px

ctx.imageSmoothingEnabled = false;
const pressed = { left: false, right: false };
const player = { x: W / 2, electrocuteTime: 0, runTime: 0, running: false, facing: 1, shockPoses: [] };
let mode = 'ready'; // ready | loading | running | dead | paused
let score = 0;                 // reported sats from caught relay receipts only
let caughtZaps = 0;            // all successful catches, including ordinary strikes
let liveCaught = 0;            // actual relay-reported events caught
let misses = 0;
let best = 0;                  // best sats collected in a single run
let elapsed = 0;
let eventNumber = 0;
let nextZap = 1.2;
let activeStrike = null;
let impactParticles = [];
let popup = null;
let lastFrame = null;
// First-start instruction; the loading stage also displays it.
let firstRunIntroPending = true;
let getZappedSeconds = 0;
// Nostr starts only after the first Enter/tap. A bounded loading screen allows
// relays a short chance to return recent receipts, but never blocks offline play.
const LOAD_SECONDS = 2.8;
let loadProgress = 0;
let seededEvents = [];
let freshEvents = [];
let usedInRun = new Set();
const weather = new window.ElectroNostr.NostrZapWeather(zap => {
  if (mode !== 'running' && mode !== 'paused') return;
  if (!usedInRun.has(zap.id) && freshEvents.length < 32) freshEvents.push(zap);
});

// A new key: v0.2 stored catch counts, which must not be mistaken for sats.
try { best = Number(localStorage.getItem('electricCowboyBestLiveSats') || localStorage.getItem('electrocutedCowboyBestLiveSats') || 0); } catch (_) {}
if (!Number.isFinite(best) || best < 0) best = 0;

function rnd(min, max) { return min + Math.random() * (max - min); }
function clamp(v, low, high) { return Math.min(high, Math.max(low, v)); }
function rect(x, y, w, h, color = INK) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function seedOpeningMinute() {
  const recent = weather.recentSeeds(5);
  // Five possible windows across the first minute. They replace ordinary
  // strikes at the normal cadence rather than creating extra hazards.
  const windows = [[4, 9], [14, 20], [25, 32], [37, 45], [49, 56]];
  seededEvents = recent.map((zap, i) => ({ zap, at: rnd(...windows[i]) }));
  freshEvents = [];
  usedInRun = new Set();
}

function startGame() {
  seedOpeningMinute();
  mode = 'running';
  weather.allowFresh();
  score = 0;
  caughtZaps = 0;
  liveCaught = 0;
  misses = 0;
  elapsed = 0;
  nextZap = 0.65;
  player.x = W / 2;
  player.electrocuteTime = 0;
  player.runTime = 0;
  player.running = false;
  player.facing = 1;
  player.shockPoses = [];
  activeStrike = null;
  impactParticles = [];
  popup = null;
  getZappedSeconds = firstRunIntroPending ? 3.0 : 0;
  firstRunIntroPending = false;
  pressed.left = false;
  pressed.right = false;
}

function toggleGame() {
  if (mode === 'paused') mode = 'running';
  else if (mode === 'ready' && !weather.started) {
    mode = 'loading';
    loadProgress = 0;
    weather.connect();
  } else if (mode === 'dead' || mode === 'ready') startGame();
}

window.addEventListener('keydown', event => {
  const key = event.code;
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Enter', 'Space'].includes(key)) event.preventDefault();
  if (key === 'ArrowLeft' || key === 'KeyA') pressed.left = true;
  if (key === 'ArrowRight' || key === 'KeyD') pressed.right = true;
  if ((key === 'Enter' || key === 'Space') && !event.repeat) toggleGame();
});
window.addEventListener('keyup', event => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') pressed.left = false;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') pressed.right = false;
});
window.addEventListener('blur', () => {
  pressed.left = pressed.right = false;
  if (mode === 'running') mode = 'paused';
  lastFrame = null;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'running') mode = 'paused';
  if (document.hidden) pressed.left = pressed.right = false;
  lastFrame = null;
});

for (const [id, direction] of [['move-left', 'left'], ['move-right', 'right']]) {
  const button = document.getElementById(id);
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (mode === 'ready' || mode === 'dead' || mode === 'paused') toggleGame();
    pressed[direction] = true;
    try { button.setPointerCapture(event.pointerId); } catch (_) {}
  });
  function release(event) { event.preventDefault(); pressed[direction] = false; }
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', () => { pressed[direction] = false; });
}

// A normal lightning strike is always catchable, but awards ZERO sats.
function ordinaryStrike() {
  eventNumber++;
  return { id: `ordinary-${eventNumber}`, amountSats: 0, source: 'game' };
}

function nextStrikeEvent() {
  // Consume real incoming receipts first. Seeded receipts due in the opening
  // minute are used whenever the next regularly scheduled strike begins.
  while (freshEvents.length) {
    const zap = freshEvents.shift();
    if (!usedInRun.has(zap.id)) {
      usedInRun.add(zap.id);
      return zap;
    }
  }
  for (let i = 0; i < seededEvents.length; i++) {
    const entry = seededEvents[i];
    if (elapsed >= entry.at && !usedInRun.has(entry.zap.id)) {
      seededEvents.splice(i, 1);
      usedInRun.add(entry.zap.id);
      return entry.zap;
    }
  }
  return ordinaryStrike();
}

function makeLightningPath(startX, endX) {
  // Moves steadily downward and tends toward the preselected landing x.
  // Local kinks and lateral wandering are generated only once per strike.
  const count = 40;
  const points = [];
  const offset = Array.from({ length: 8 }, (_, i) =>
    i === 0 || i === 7 ? 0 : rnd(-27, 27)
  );
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const bendIndex = t * 7;
    const k = Math.min(6, Math.floor(bendIndex));
    const fraction = bendIndex - k;
    const bend = offset[k] * (1 - fraction) + offset[k + 1] * fraction;
    const kink = rnd(-5.5, 5.5) * Math.sin(Math.PI * t);
    const trend = startX + (endX - startX) * t;
    points.push({
      x: Math.round(clamp(trend + bend + kink, 2, W - 2)),
      y: Math.round(4 + (GROUND - 4) * t)
    });
  }
  // Extra short forks that don't themselves count as catches.
  const branches = [];
  for (let i = 7; i < count - 5; i += 7) {
    const from = points[i];
    const dx = rnd(-16, 16);
    branches.push({ at: i, from, to: {
      x: clamp(from.x + dx, 2, W - 2),
      y: Math.min(GROUND - 3, from.y + rnd(10, 21))
    } });
  }
  return { points, branches };
}

function createStrike(zap) {
  // Top and bottom independently randomized, with at most a third-width drift.
  const originX = rnd(20, W - 20);
  const landX = rnd(Math.max(20, originX - MAX_HORIZONTAL_DRIFT),
                    Math.min(W - 20, originX + MAX_HORIZONTAL_DRIFT));
  return {
    zap,
    originX,
    landX,
    path: makeLightningPath(originX, landX),
    // Two frozen jagged shapes produce a quick double-flicker without blur/glow.
    alternatePath: makeLightningPath(originX, landX),
    visualSeed: rnd(0, 10000),
    age: 0,
    resolved: false,
    checkedImpact: false
  };
}

function spark(x, y, type) {
  impactParticles.push({ x, y, age: 0, type });
}

// Snapshot the randomized animation at the moment of the catch so it changes
// pose by pose rather than jittering unpredictably on every rendered frame.
function makeShockPoses() {
  return Array.from({ length: 9 }, (_, i) => ({
    bounce: [3, 11, 6, 15, 8, 13, 5, 8, 2][i],
    shake: Math.round(rnd(-3, 3)),
    leftElbowX: -Math.round(rnd(8, 17)),
    leftElbowY: Math.round(rnd(-7, 10)),
    leftHandX: -Math.round(rnd(17, 27)),
    leftHandY: Math.round(rnd(-14, 11)),
    rightElbowX: Math.round(rnd(8, 17)),
    rightElbowY: Math.round(rnd(-7, 10)),
    rightHandX: Math.round(rnd(17, 27)),
    rightHandY: Math.round(rnd(-14, 11)),
    leftFootX: -Math.round(rnd(7, 21)),
    leftFootY: Math.round(rnd(-5, 5)),
    rightFootX: Math.round(rnd(7, 21)),
    rightFootY: Math.round(rnd(-5, 5))
  }));
}

// Original cowboy art is also the hitbox source. Rectangles are in the same
// coordinate system as drawCowboy() (local origin: x = center - 23,
// y = ground - 89). The black eye is intentionally omitted from collision.
function cowboySolidParts(running, phase) {
  const parts = [
    [11, 0, 24, 12], [4, 10, 38, 5], [15, 15, 16, 14], [11, 29, 23, 29]
  ];
  if (running && phase % 4 === 0) {
    parts.push([3, 32, 7, 18], [35, 40, 7, 16],
      [11, 58, 8, 14], [7, 70, 7, 12], [3, 82, 15, 5],
      [27, 58, 8, 13], [32, 69, 7, 13], [31, 82, 14, 5]);
  } else if (running && phase % 4 === 2) {
    parts.push([4, 40, 7, 16], [36, 32, 7, 18],
      [13, 58, 8, 13], [20, 69, 7, 13], [19, 82, 14, 5],
      [25, 58, 8, 14], [18, 70, 7, 12], [14, 82, 15, 5]);
  } else {
    parts.push([4, 35, 7, 19], [34, 35, 7, 19],
      [13, 58, 8, 24], [26, 58, 8, 24],
      [9, 80, 14, 7], [26, 80, 14, 7]);
  }
  return parts;
}

function cowboyCollisionRects() {
  const phase = Math.floor(player.runTime / RUN_FRAME_SECONDS) % 4;
  const parts = cowboySolidParts(player.running, phase);
  return parts.map(([dx, dy, w, h]) => {
    // Player is drawn facing either direction using a horizontal flip.
    const localX = -23 + dx;
    const x = player.facing === -1 ? player.x - (localX + w) : player.x + localX;
    return { x, y: GROUND - 89 + dy, w, h };
  });
}

// Segment vs an expanded rectangle (slab method). Checks the actual jagged
// path, not just its landing point, and also works for short side branches.
function segmentTouchesRect(a, b, box, radius) {
  let lo = 0, hi = 1;
  for (const [axis, extent] of [['x', 'w'], ['y', 'h']]) {
    const d = b[axis] - a[axis];
    const low = box[axis] - radius;
    const high = box[axis] + box[extent] + radius;
    if (Math.abs(d) < 1e-8) {
      if (a[axis] < low || a[axis] > high) return false;
    } else {
      let t1 = (low - a[axis]) / d;
      let t2 = (high - a[axis]) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      lo = Math.max(lo, t1);
      hi = Math.min(hi, t2);
      if (lo > hi) return false;
    }
  }
  return true;
}

function lightningTouchesCowboy(path) {
  const hitboxes = cowboyCollisionRects();
  // Slight tolerance for rasterized, square-pixel line thickness.
  const touch = (a, b, radius) => hitboxes.some(box => segmentTouchesRect(a, b, box, radius));
  for (let i = 0; i < path.points.length - 1; i++) {
    if (touch(path.points[i], path.points[i + 1], MAIN_BOLT_PIXEL_SIZE / 2)) return true;
  }
  for (const branch of path.branches) {
    if (touch(branch.from, branch.to, 0.5)) return true;
  }
  return false;
}

function resolveStrike(strike, caught) {
  if (strike.resolved) return;
  strike.resolved = true;
  spark(strike.landX, GROUND - 1, caught ? 'catch' : 'miss');
  if (caught) {
    if (strike.zap.source === 'nostr') {
      score += strike.zap.amountSats;
      liveCaught += 1;
    }
    caughtZaps += 1;
    player.electrocuteTime = ELECTROCUTE_SECONDS;
    player.running = false;
    player.shockPoses = makeShockPoses();
    popup = { label: strike.zap.source === 'nostr' ? `+${strike.zap.amountSats.toLocaleString()} SATS!` : 'YEEHAW!', age: 0, color: ELECTRIC };
    if (score > best) {
      best = score;
      try { localStorage.setItem('electricCowboyBestLiveSats', String(best)); } catch (_) {}
    }
  } else {
    misses += 1;
    popup = { label: strike.zap.source === 'nostr' ? 'LIVE ZAP MISSED!' : 'MISSED!', age: 0, color: DIM };
    if (misses >= MAX_MISSES) mode = 'dead';
  }
}

function update(dt) {
  if (mode === 'loading') {
    loadProgress += dt;
    if (loadProgress >= LOAD_SECONDS) startGame();
    return;
  }
  // Effects continue to fade in the post-impact instant, even on game over.
  if (mode !== 'running') {
    // On game over, let the last bolt fade instead of freezing indefinitely.
    if (mode === 'dead' && activeStrike) {
      activeStrike.age += dt;
      if (activeStrike.age >= BUILDUP_SECONDS + STRIKE_SECONDS) activeStrike = null;
    }
    for (const p of impactParticles) p.age += dt;
    impactParticles = impactParticles.filter(p => p.age < 0.38);
    if (popup) popup.age += dt;
    return;
  }
  elapsed += dt;
  getZappedSeconds = Math.max(0, getZappedSeconds - dt);
  player.electrocuteTime = Math.max(0, player.electrocuteTime - dt);

  if (player.electrocuteTime <= 0) {
    const direction = Number(pressed.right) - Number(pressed.left);
    const nextX = clamp(player.x + direction * MOVE_SPEED * dt, 24, W - 24);
    player.running = direction !== 0 && nextX !== player.x;
    player.x = nextX;
    if (player.running) {
      player.facing = direction;
      player.runTime += dt;
    }
  } else {
    player.running = false;
  }

  if (popup) { popup.age += dt; if (popup.age > 0.95) popup = null; }
  for (const p of impactParticles) p.age += dt;
  impactParticles = impactParticles.filter(p => p.age < 0.38);

  if (!activeStrike) {
    nextZap -= dt;
    if (nextZap <= 0) {
      activeStrike = createStrike(nextStrikeEvent());
      nextZap = rnd(ZAP_INTERVAL_MIN, ZAP_INTERVAL_MAX);
    }
    return;
  }

  activeStrike.age += dt;
  const contactAt = BUILDUP_SECONDS + CONTACT_DELAY;
  const strikeEnd = BUILDUP_SECONDS + STRIKE_SECONDS;
  if (!activeStrike.resolved && activeStrike.age >= contactAt && activeStrike.age < strikeEnd) {
    // Ground proximity is judged only when the strike initially connects;
    // players can't run into the landing zone after that instant.
    if (!activeStrike.checkedImpact) {
      activeStrike.checkedImpact = true;
      if (Math.abs(player.x - activeStrike.landX) <= CATCH_RADIUS) {
        resolveStrike(activeStrike, true);
      }
    }
    // While the bolt is visible, touching its actual main arc OR branches
    // catches the zap. Both flicker shapes are checked as they appear.
    if (!activeStrike.resolved) {
      const flashAge = activeStrike.age - BUILDUP_SECONDS;
      const path = flashAge < STRIKE_SECONDS * 0.48
        ? activeStrike.path : activeStrike.alternatePath;
      if (lightningTouchesCowboy(path)) resolveStrike(activeStrike, true);
    }
  }
  if (activeStrike.age >= strikeEnd) {
    if (!activeStrike.resolved) resolveStrike(activeStrike, false);
    activeStrike = null;
  }
}

function drawCowboy(cx, bottomY, running = false, phase = 0) {
  // The exact same pixel rectangles used in v0.3, now shared with collision.
  const x = Math.round(cx - 23);
  const y = Math.round(bottomY - 89);
  for (const [dx, dy, w, h] of cowboySolidParts(running, phase)) {
    rect(x + dx, y + dy, w, h);
  }
  rect(x + 26, y + 20, 2, 2, BLACK); // Single eye
}

function pixelBone(x1, y1, x2, y2, thickness = 3) {
  // Pixelated bone line: rects only, with no smoothing or glow.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    rect(x1 + (x2 - x1) * t - thickness / 2,
      y1 + (y2 - y1) * t - thickness / 2, thickness, thickness);
  }
}

function drawSkeleton(cx, bottomY, pose) {
  const x = Math.round(cx - 23);
  const y = Math.round(bottomY - 89);
  const r = (dx, dy, w, h, color = INK) => rect(x + dx, y + dy, w, h, color);
  // The hat stays put on the skeleton: deliberately cartoonish.
  r(11, 0, 24, 12); r(4, 10, 38, 5);
  r(15, 16, 16, 15);                   // Skull
  r(18, 23, 3, 4, BLACK); r(26, 23, 3, 4, BLACK);
  r(22, 29, 4, 4, BLACK);
  r(22, 32, 4, 31);                    // Spine
  for (let i = 0; i < 4; i++) r(14, 34 + i * 6, 20, 3);
  r(13, 63, 21, 5);                    // Pelvis

  const armY = y + 38;
  // Each arm is a pair of short bones that jut out in a different direction
  // on each catch, with a bend at the elbow.
  pixelBone(x + 15, armY, x + 15 + pose.leftElbowX, armY + pose.leftElbowY, 3);
  pixelBone(x + 15 + pose.leftElbowX, armY + pose.leftElbowY,
    x + 15 + pose.leftHandX, armY + pose.leftHandY, 3);
  pixelBone(x + 32, armY, x + 32 + pose.rightElbowX, armY + pose.rightElbowY, 3);
  pixelBone(x + 32 + pose.rightElbowX, armY + pose.rightElbowY,
    x + 32 + pose.rightHandX, armY + pose.rightHandY, 3);
  // Splayed legs—still connected to the pelvis, unlike random loose pixels.
  pixelBone(x + 18, y + 67, x + 18 + pose.leftFootX, y + 84 + pose.leftFootY, 4);
  pixelBone(x + 29, y + 67, x + 29 + pose.rightFootX, y + 84 + pose.rightFootY, 4);
  r(17 + pose.leftFootX - 4, 84 + pose.leftFootY, 11, 3);
  r(28 + pose.rightFootX - 4, 84 + pose.rightFootY, 11, 3);
}

function drawElectrocution() {
  if (player.electrocuteTime > 0) {
    const effectElapsed = ELECTROCUTE_SECONDS - player.electrocuteTime;
    const index = Math.min(player.shockPoses.length - 1, Math.floor(effectElapsed / 0.055));
    const pose = player.shockPoses[index] || makeShockPoses()[0];
    const x = player.x + pose.shake;
    const feet = GROUND - pose.bounce;
    // Brief silhouette flickers between many X-ray skeleton poses.
    if (index % 3 !== 2) drawSkeleton(x, feet, pose);
    else drawCowboy(x, feet);
    for (let i = 0; i < 7; i++) {
      const angle = (i * Math.PI / 3.5) + index * 0.9;
      rect(x + Math.cos(angle) * 35, GROUND - 48 + Math.sin(angle) * 43 - pose.bounce,
        3, 3, ELECTRIC);
    }
  } else {
    const phase = Math.floor(player.runTime / RUN_FRAME_SECONDS) % 4;
    // Flip the same silhouette horizontally when moving left.
    ctx.save();
    ctx.translate(player.x, 0);
    ctx.scale(player.facing, 1);
    drawCowboy(0, GROUND, player.running, phase);
    ctx.restore();
  }
}

// Pixel-stepped raster segment. No image smoothing, shadow blur, or CSS filters.
function pixelLine(a, b, coverage = 1, size = 2, color = ELECTRIC) {
  const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / size));
  const visible = Math.ceil(count * coverage);
  for (let i = 0; i <= visible; i++) {
    const t = i / count;
    rect(Math.round((a.x + (b.x - a.x) * t) / size) * size,
      Math.round((a.y + (b.y - a.y) * t) / size) * size, size, size, color);
  }
}

// A stable, inexpensive visual-noise function keeps each flicker deterministic.
// The player sees a broad ground tell at first, increasingly localized to landX.
function warningNoise(seed, step, channel) {
  const v = Math.sin(seed * 0.618 + step * 46.83 + channel * 97.31) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

function drawWarning(s) {
  const t = clamp(s.age / BUILDUP_SECONDS, 0, 1);
  const tick = Math.floor(s.age / 0.065);
  // A tiny electrical crown at the origin: no descending snake.
  if (tick % 3 !== 2) {
    rect(s.originX - 2 + warningNoise(s.visualSeed, tick, 0) * 4, 4, 4, 10, ELECTRIC);
    rect(s.originX - 10 + warningNoise(s.visualSeed, tick, 1) * 8, 18, 3, 3, ELECTRIC);
    if (t > 0.4) rect(s.originX + 7, 12, 3, 6, ELECTRIC);
  }
  // Ground corona becomes a better clue as impact nears. A player can move
  // during the buildup, but only learns the exact landing point near the end.
  const scatter = 80 * (1 - t) * (1 - t) + 6;
  const density = t < 0.25 ? 2 : t < 0.6 ? 3 : 5;
  for (let i = 0; i < density; i++) {
    const jitter = warningNoise(s.visualSeed, tick, 10 + i) * scatter;
    const px = clamp(s.landX + jitter, 3, W - 3);
    const py = GROUND - 3 - (i % 3) * 5;
    if (i === 0 || (tick + i) % 3 !== 0) rect(px, py, t > 0.75 ? 4 : 3, 2, ELECTRIC);
  }
  if (t > 0.76 && tick % 2 === 0) rect(s.landX - 5, GROUND - 2, 10, 2, ELECTRIC);
  // LIVE ZAP is brighter but gives the same reaction window and collision.
  if (s.zap.source === 'nostr') {
    rect(s.originX - 4, 4, 8, 2, '#ffe88a');
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#ffe88a';
    ctx.fillText('LIVE ZAP!', s.landX, GROUND - 36);
  }
}

function drawStrike(s) {
  if (s.age < BUILDUP_SECONDS) {
    drawWarning(s);
    return;
  }
  // The whole bolt flashes onto the screen at once instead of crawling down.
  // Two distinct frozen routes alternate once, inspired by the existing
  // Electric Cowboy lightning path generator, with no smoothing or glow.
  const strikeAge = s.age - BUILDUP_SECONDS;
  if (strikeAge >= STRIKE_SECONDS) return;
  const path = strikeAge < STRIKE_SECONDS * 0.48 ? s.path : s.alternatePath;
  ctx.globalAlpha = strikeAge > STRIKE_SECONDS * 0.86 ? 0.75 : 1;
  const isLive = s.zap.source === 'nostr';
  // Light yellow, visually heavier, but no extra hitbox or aiming advantage.
  for (let i = 0; i < path.points.length - 1; i++) {
    pixelLine(path.points[i], path.points[i + 1], 1, MAIN_BOLT_PIXEL_SIZE, isLive ? '#ffe88a' : ELECTRIC);
  }
  for (const branch of path.branches) pixelLine(branch.from, branch.to, 1, 1, isLive ? '#ffe88a' : ELECTRIC);
  if (isLive) {
    rect(s.landX - 10, GROUND - 4, 20, 4, '#ffe88a');
    for (const side of [-1, 1]) {
      rect(s.landX + side * 16, GROUND - 14, 4, 4, '#ffe88a');
      rect(s.landX + side * 24, GROUND - 7, 3, 3, '#ffe88a');
    }
  }
  rect(s.landX - 7, GROUND - 3, 14, 3, ELECTRIC);
  ctx.globalAlpha = 1;
}

function drawImpact(p) {
  const life = 1 - p.age / 0.38;
  ctx.globalAlpha = Math.max(0, life);
  const radius = 4 + p.age * 40;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + i * Math.PI / 6;
    rect(p.x + Math.cos(a) * radius, p.y + Math.sin(a) * radius,
      3, 3, p.type === 'catch' ? ELECTRIC : INK);
  }
  ctx.globalAlpha = 1;
}

function drawScene() {
  rect(0, 0, W, H, BLACK);
  // Static landscape — unlike the scrolling runner. Same visual vocabulary.
  rect(0, GROUND, W, 2, INK);
  for (let x = 15; x < W; x += 69) {
    rect(x, GROUND + 15, 11, 2, DIM);
    rect(x + 31, GROUND + 21, 4, 2, DIM);
  }
  for (const x of [105, 532, 745]) {
    rect(x, 70, 30, 2, DIM);
    rect(x + 7, 66, 18, 2, DIM);
    rect(x + 12, 63, 9, 2, DIM);
  }
  // Non-collidable cacti provide a sparse Western silhouette.
  for (const [x, h] of [[42, 31], [755, 38]]) {
    rect(x + 8, GROUND - h, 8, h, DIM);
    rect(x, GROUND - h + 13, 7, 6, DIM);
    rect(x + 4, GROUND - h + 13, 4, 15, DIM);
    rect(x + 16, GROUND - h + 7, 6, 6, DIM);
  }
  drawElectrocution();
  // Lightning overlays the cowboy: a visible touch now counts as a catch.
  if (activeStrike) drawStrike(activeStrike);
  impactParticles.forEach(drawImpact);

  if (popup && popup.age < 0.95) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = popup.color;
    ctx.globalAlpha = popup.age > 0.65 ? Math.max(0, (0.95 - popup.age) / 0.30) : 1;
    ctx.fillText(popup.label, player.x, GROUND - 110 - popup.age * 16);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = DIM;
  ctx.font = 'bold 17px monospace';
  ctx.fillText(`HI ${String(best).padStart(5, '0')}  ${String(score).padStart(5, '0')} SATS`, W - 24, 32);
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`CAUGHT ${String(caughtZaps).padStart(2, '0')}  LIVE ${String(liveCaught).padStart(2, '0')}  MISSES ${misses}/${MAX_MISSES}`, W - 24, 52);
  ctx.textAlign = 'left';
  ctx.fillStyle = ELECTRIC;
  ctx.font = 'bold 12px monospace';
  const relayStatus = weather.status();
  const relayText = !weather.started ? 'NOSTR: NOT CONNECTED' :
    relayStatus.online ? `NOSTR: ${relayStatus.online} RELAY${relayStatus.online === 1 ? '' : 'S'} LIVE` :
      'NOSTR: OFFLINE / RECONNECTING';
  ctx.fillText(relayText, 20, 26);
  if (activeStrike && activeStrike.zap.source === 'nostr') {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe88a';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`LIVE ZAP  ${activeStrike.zap.amountSats.toLocaleString()} SATS`, 20, 46);
  }

  if (mode === 'loading') {
    ctx.textAlign = 'center';
    ctx.font = 'bold 25px monospace';
    ctx.fillStyle = ELECTRIC;
    ctx.fillText('GET ZAPPED!', W / 2, 137);
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = INK;
    ctx.fillText('CHECKING THE ZAP WEATHER...', W / 2, 183);
    rect(240, 208, 320, 3, DIM);
    rect(240, 208, Math.round(320 * clamp(loadProgress / LOAD_SECONDS, 0, 1)), 3, ELECTRIC);
    ctx.font = '12px monospace';
    ctx.fillStyle = DIM;
    ctx.fillText(`${weather.status().recent} RECENT RECEIPTS FOUND`, W / 2, 240);
  } else if (mode === 'running' && getZappedSeconds > 0) {
    // Brief yellow first-run instruction. It doesn't block player movement.
    ctx.textAlign = 'center';
    ctx.font = 'bold 25px monospace';
    ctx.fillStyle = ELECTRIC;
    ctx.globalAlpha = Math.min(1, getZappedSeconds / 0.45);
    ctx.fillText('GET ZAPPED!', W / 2, 124);
    ctx.globalAlpha = 1;
  } else if (mode !== 'running') {
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = INK;
    ctx.fillText(mode === 'ready' ? 'THE ELECTRIC COWBOY' :
      mode === 'paused' ? 'PAUSED' : 'GAME OVER', W / 2, 179);
    ctx.font = '14px monospace';
    ctx.fillText(mode === 'paused' ? 'PRESS ENTER TO CONTINUE' :
      'PRESS ENTER TO ' + (mode === 'ready' ? 'START' : 'RESTART'), W / 2, 207);
    if (mode === 'dead') ctx.fillText(`${score.toLocaleString()} SATS  /  ${liveCaught} LIVE ZAPS  /  ${caughtZaps} TOTAL CATCHES`, W / 2, 230);
  }
}

function frame(timestamp) {
  if (lastFrame === null) lastFrame = timestamp;
  const dt = Math.min((timestamp - lastFrame) / 1000, 0.04);
  lastFrame = timestamp;
  update(dt);
  drawScene();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
