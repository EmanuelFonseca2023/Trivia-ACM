import { AudioBus } from './audio.js';
import { GLITCHES, activeGlitchNames, glitchOn } from './glitches.js';
import { drawHero } from './hero.js';
import { LevelBank } from './levels/index.js';
import { QUESTIONS } from './questions/index.js';

const DESKTOP_W = 960;
const DESKTOP_H = 540;
const TILE = 32;
let viewW = DESKTOP_W;
let viewH = DESKTOP_H;
let cssW = DESKTOP_W;
let cssH = DESKTOP_H;
let dpr = 1;
const GRAVITY = 0.44;
const JUMP_V = -10.5;
const MAX_FALL = 12;
const OUCH = ['¡Exception!', '¡Null!', '¡Crash!', '¡Ay!'];
const RANK_BLURB = {
  D: 'Otra vuelta',
  C: 'Vas entendiendo',
  B: 'Bien jugado',
  A: 'Casi perfecto',
  S: '¡Sin errores!',
};

const params = new URLSearchParams(globalThis.location.search);
const canvas = globalThis.document.getElementById('c');
const ctx = canvas.getContext('2d');
const frame = globalThis.document.getElementById('frame');

const keys = Object.create(null);
const virt = { left: false, right: false, jump: false, down: false, action: false };
const touchPointers = new Map();
const echoBuf = [];
const input = {
  left: false, right: false, dir: 0, jumpHeld: false, down: false,
  jumpEdge: false, downEdge: false, actionEdge: false,
};

let prevJump = false;
let prevDown = false;
let prevAction = false;
let waitReleaseAction = false;

let state = 'title';
let level = null;
let player = null;
let checkpoint = { x: 0, y: 0 };
let run = null;
let cam = { x: 0, y: 0 };
let snapCam = false;
let particles = [];
let popups = [];
let trails = [];
let trauma = 0;
let kickX = 0;
let kickY = 0;
const juice = { level: 1 };
let flash = { a: 0, color: '#fff' };
let hitstop = 0;
let winning = 0;
let ranked = false;
let session = null;
let banner = null;
let hudPrompt = '';
let tick = 0;
const usedQ = new Set();

const titleActor = {
  x: 730,
  y: 488 - 36,
  w: 22,
  h: 36,
  facing: 1,
  squash: 1,
  cycle: 0,
  mach: 0.92,
  grounded: true,
  invuln: 0,
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function hash(a, b) {
  let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}
function fmtScore(n) { return String(Math.max(0, Math.floor(n))).padStart(6, '0'); }

function loadSave() {
  try {
    const data = JSON.parse(globalThis.localStorage.getItem('code-tower-v1') || '');
    if (data && typeof data === 'object') return data;
  } catch { /* empty */ }
  return { levels: {}, mute: false };
}
function writeSave(data) {
  try { globalThis.localStorage.setItem('code-tower-v1', JSON.stringify(data)); } catch { /* empty */ }
}

function round(x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
function meat(x, y, w, h, r, fill) {
  round(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1c0c08';
  ctx.stroke();
}

function cellSolid(tx, ty) {
  if (!level) return false;
  if (tx < 0 || tx >= level.w) return true;
  if (ty < 0 || ty >= level.h) return false;
  if (level.grid[ty][tx] === 1) return true;
  for (const d of level.doors) {
    if (d.open) continue;
    if (tx >= d.tx && tx < d.tx + d.tw && ty >= d.ty && ty < d.ty + d.th) return true;
  }
  return false;
}
function cellOneWay(tx, ty) {
  if (!level || tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return false;
  if (level.grid[ty][tx] === 2) return true;
  for (const d of level.doors) {
    if (d.kind === 'hatch' && d.open && tx >= d.tx && tx < d.tx + d.tw && ty >= d.ty && ty < d.ty + d.th) return true;
  }
  return false;
}
function overlapsSolid(x, y, w, h) {
  const x0 = Math.floor(x / TILE);
  const y0 = Math.floor(y / TILE);
  const x1 = Math.floor((x + w - 0.001) / TILE);
  const y1 = Math.floor((y + h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (cellSolid(tx, ty)) return true;
    }
  }
  return false;
}
function hasFloor(px, footY) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor((footY - 0.01) / TILE);
  if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return false;
  const cell = level.grid[ty][tx];
  if (cell === 1 || cell === 2) return true;
  for (const d of level.doors) {
    if (tx < d.tx || tx >= d.tx + d.tw || ty < d.ty || ty >= d.ty + d.th) continue;
    if (!d.open || d.kind === 'hatch') return true;
  }
  return false;
}

function burst(x, y, color, n, speed, chunk) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.35 + Math.random());
    const life = (chunk ? 22 : 14) + Math.random() * 14;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - speed * 0.35,
      life,
      max: life,
      color,
      size: chunk ? 6 + Math.random() * 5 : 3 + Math.random() * 3,
      rot: Math.random() * 6,
      spin: (Math.random() - 0.5) * (chunk ? 0.4 : 0.2),
      g: chunk ? 0.28 : 0.16,
    });
  }
  if (particles.length > 220) particles.splice(0, particles.length - 220);
}
function bumpCamera(weight, kx, ky) {
  const scale = juice.level;
  if (scale <= 0) return;
  trauma = Math.min(1, trauma + weight * scale);
  kickX += (kx || 0) * scale;
  kickY += (ky || 0) * scale;
}
function freeze(frames) {
  hitstop = Math.max(hitstop, frames);
}
function popup(x, y, text, color) {
  popups.push({ x, y, text, color: color || '#fff6e4', life: 48 });
}
function bumpCombo() {
  if (run.comboTimer <= 0) run.combo = 1;
  else run.combo = Math.min(20, run.combo + 1);
  run.comboTimer = 170;
  if (run.combo === 12) return '¡IMPARABLE!';
  if (run.combo === 8) return '¡EN LLAMAS!';
  if (run.combo === 5) return '¡SIN BUGS!';
  if (run.combo === 3) return '¡COMPILA!';
  if (run.combo === 2) return '¡OK!';
  return '';
}
function award(base, x, y, word) {
  const pts = base * Math.max(1, run.combo);
  run.score += pts;
  popup(x, y - 6, '+' + pts, '#fff6e4');
  if (word) popup(x, y - 28, word, '#ffe14a');
}

function decorate(lv) {
  lv.bg = [];
  const count = Math.ceil((lv.w * TILE) / 150) + 2;
  for (let i = 0; i < count; i++) {
    lv.bg.push({
      x: i * 150 - 40,
      h: 90 + hash(i, 2) % 190,
      w: 96 + hash(i, 4) % 80,
      hue: hash(i, 1) % 3,
    });
  }
  const glyphs = lv.glyphSet || ['{ }', ';', '=>', 'if', 'fn', '</>', 'for', '0'];
  lv.glyphs = Array.from({ length: 18 }, (_, i) => ({
    t: glyphs[i % glyphs.length],
    x: hash(i, 8) % (lv.w * TILE),
    y: 40 + hash(i, 9) % Math.max(80, lv.h * TILE - 80),
  }));
}

function makePlayer(x, y) {
  return {
    x, y, w: 22, h: 36,
    vx: 0, vy: 0, facing: 1,
    grounded: true, wasGrounded: true, coyote: 8,
    buffer: 0, jumpCut: false, pounding: false,
    justLanded: false, landImpact: 0,
    mach: 0, turboSfx: false, squash: 1, cycle: 0,
    invuln: 0, hitFlash: 0, wallDir: 0, wallSliding: false, prevY: y,
  };
}

function startLevel(id) {
  level = LevelBank.build(id);
  decorate(level);
  player = makePlayer(level.spawn.x, level.spawn.y);
  checkpoint = { x: player.x, y: player.y };
  echoBuf.length = 0;
  run = {
    score: 0,
    time: 0,
    wrong: 0,
    hits: 0,
    deaths: 0,
    bugsGot: 0,
    coffeeGot: 0,
    bugsTotal: level.enemies.length,
    coffeeTotal: level.coffees.length,
    combo: 0,
    comboTimer: 0,
    glitches: {},
  };
  for (const e of level.enemies) {
    if (e.glitch && GLITCHES[e.glitch]) run.glitches[e.glitch] = true;
  }
  usedQ.clear();
  particles = [];
  popups = [];
  trails = [];
  trauma = 0;
  kickX = 0;
  kickY = 0;
  flash = { a: 0, color: '#fff' };
  hitstop = 0;
  winning = 0;
  ranked = false;
  session = null;
  hudPrompt = '';
  banner = { text: level.name.toUpperCase(), life: 130 };
  snapCam = true;
  cam.x = 0;
  cam.y = 0;
  updateCamera();
  waitReleaseAction = true;
  state = 'play';
  setOverlay('play');
  const nameEl = globalThis.document.getElementById('level-name');
  if (nameEl) nameEl.textContent = level.name;
  AudioBus.click();
}

function updateCamera() {
  const look = player.vx * 14 * (viewW / DESKTOP_W);
  const headroom = viewW < DESKTOP_W ? viewH * 0.12 : 24;
  let tx = player.x + player.w / 2 - viewW / 2 + look;
  let ty = player.y + player.h / 2 - viewH / 2 - headroom;
  const maxX = level.w * TILE - viewW;
  const maxY = level.h * TILE - viewH;
  tx = maxX < 0 ? maxX / 2 : clamp(tx, 0, maxX);
  ty = maxY < 0 ? maxY / 2 : clamp(ty, 0, maxY);
  const follow = glitchOn(run, 'lag-cam') ? 0.03 : 0.12;
  if (snapCam) {
    cam.x = tx;
    cam.y = ty;
    snapCam = false;
  } else {
    cam.x += (tx - cam.x) * follow;
    cam.y += (ty - cam.y) * follow;
  }
}

function poll() {
  let sample = {
    left: !!(keys.ArrowLeft || keys.KeyA || virt.left),
    right: !!(keys.ArrowRight || keys.KeyD || virt.right),
    jump: !!(keys.Space || keys.ArrowUp || keys.KeyW || virt.jump),
    down: !!(keys.ArrowDown || keys.KeyS || virt.down),
    action: !!(keys.KeyE || keys.Enter || virt.action),
  };
  echoBuf.push(sample);
  if (echoBuf.length > 12) echoBuf.shift();
  if (glitchOn(run, 'echo')) {
    sample = echoBuf.length < 12
      ? { left: false, right: false, jump: false, down: false, action: false }
      : echoBuf[0];
  }
  let left = sample.left;
  let right = sample.right;
  let jump = sample.jump;
  let down = sample.down;
  const action = sample.action;
  if (glitchOn(run, 'flip')) [left, right] = [right, left];
  if (glitchOn(run, 'scramble')) [jump, down] = [down, jump];
  input.left = left;
  input.right = right;
  input.dir = (right ? 1 : 0) - (left ? 1 : 0);
  input.jumpHeld = jump;
  input.down = down;
  input.jumpEdge = jump && !prevJump;
  input.downEdge = down && !prevDown;
  if (waitReleaseAction) {
    input.actionEdge = false;
    if (!action) waitReleaseAction = false;
  } else {
    input.actionEdge = action && !prevAction;
  }
  prevJump = jump;
  prevDown = down;
  prevAction = action;
}

function doJump(wall) {
  if (wall) {
    player.vx = -(player.wallDir || 1) * 6.4;
    player.mach *= 0.55;
    player.facing = Math.sign(player.vx) || player.facing;
  }
  player.vy = glitchOn(run, 'short-jump') ? JUMP_V * 0.58 : JUMP_V;
  player.jumpCut = false;
  player.pounding = false;
  player.grounded = false;
  player.coyote = 0;
  player.buffer = 0;
  player.wallSliding = false;
  AudioBus.jump();
  burst(player.x + player.w / 2, player.y + player.h, '#fff6e4', 4, 1.4);
}

function accelPlayer() {
  const dir = input.dir;
  const icy = glitchOn(run, 'ice');
  if (dir !== 0) player.facing = dir;
  if (dir !== 0) {
    const max = 3.35 + 5.3 * player.mach;
    const acc = player.wasGrounded ? (icy ? 0.16 : 0.42) : 0.22;
    player.vx += dir * acc;
    if (dir > 0) player.vx = Math.min(player.vx, max);
    else player.vx = Math.max(player.vx, -max);
  } else {
    player.vx = approach(player.vx, 0, player.wasGrounded ? (icy ? 0.1 : 0.46) : 0.04);
  }
  if (glitchOn(run, 'no-turbo')) {
    player.mach = 0;
    player.turboSfx = false;
  } else if (player.wasGrounded && dir && Math.sign(player.vx || dir) === dir) {
    player.mach = Math.min(1, player.mach + 0.016);
  } else if (player.wasGrounded) {
    player.mach = Math.max(0, player.mach - 0.02);
  }
  if (dir && player.vx && Math.sign(player.vx) !== dir) player.mach *= 0.55;
  if (player.mach > 0.82 && !player.turboSfx) {
    player.turboSfx = true;
    AudioBus.turbo();
    popup(player.x, player.y - 24, '¡TURBO!', '#ffe14a');
  }
  if (player.mach < 0.62) player.turboSfx = false;
}

function hitsWall(x, y, w, h) {
  // La cabeza sobresale 4px de un tile. Si eso cuenta como muro,
  // un techo bajo escupe al jugador de lado.
  return overlapsSolid(x, y + 4, w, h - 5);
}
function moveX() {
  player.wallDir = 0;
  player.x += player.vx;
  if (!hitsWall(player.x, player.y, player.w, player.h)) return;
  const dir = Math.sign(player.vx) || player.facing || 1;
  if (dir > 0) {
    const hit = Math.floor((player.x + player.w - 0.001) / TILE);
    player.x = hit * TILE - player.w;
  } else {
    const hit = Math.floor(player.x / TILE);
    player.x = (hit + 1) * TILE;
  }
  let guard = 0;
  while (hitsWall(player.x, player.y, player.w, player.h) && guard++ < 48) player.x -= dir;
  player.vx = 0;
  player.wallDir = dir;
}

function moveY() {
  player.y += player.vy;
  if (!overlapsSolid(player.x, player.y, player.w, player.h)) return;
  const dir = Math.sign(player.vy) || 1;
  if (dir > 0) {
    player.landImpact = player.vy;
    const hit = Math.floor((player.y + player.h - 0.001) / TILE);
    player.y = hit * TILE - player.h;
    player.grounded = true;
    if (player.landImpact > 3 && !player.wasGrounded) player.justLanded = true;
  } else {
    const hit = Math.floor(player.y / TILE);
    player.y = (hit + 1) * TILE;
    player.pounding = false;
  }
  const snapped = player.y;
  let guard = 0;
  while (overlapsSolid(player.x, player.y, player.w, player.h) && guard++ < 6) player.y -= dir;
  if (overlapsSolid(player.x, player.y, player.w, player.h)) player.y = snapped;
  player.vy = 0;
}

function moveOneWay() {
  if (player.grounded || player.vy < 0) return;
  const prevBottom = player.prevY + player.h;
  const foot = player.y + player.h;
  const x0 = Math.floor(player.x / TILE);
  const x1 = Math.floor((player.x + player.w - 0.001) / TILE);
  const ty0 = Math.floor(prevBottom / TILE) - 1;
  const ty1 = Math.floor(foot / TILE);
  let land = null;
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      if (!cellOneWay(tx, ty)) continue;
      const top = ty * TILE;
      if (prevBottom <= top + 8 && foot >= top && (land === null || top < land)) land = top;
    }
  }
  if (land === null) return;
  const nextY = land - player.h;
  if (overlapsSolid(player.x, nextY, player.w, player.h)) return;
  player.landImpact = Math.max(player.landImpact, player.vy);
  player.y = nextY;
  player.vy = 0;
  if (player.landImpact > 3 && !player.wasGrounded) player.justLanded = true;
  player.grounded = true;
}

function shockwave() {
  bumpCamera(0.55, 0, 6);
  freeze(5);
  player.hitFlash = 4;
  AudioBus.pound();
  burst(player.x + player.w / 2, player.y + player.h, '#ffe14a', 14, 4.2);
  burst(player.x + player.w / 2, player.y + player.h, '#fff6e4', 6, 3, true);
  for (const e of level.enemies) {
    if (e.dead) continue;
    const dx = Math.abs((e.x + e.w / 2) - (player.x + player.w / 2));
    const dy = Math.abs((e.y + e.h) - (player.y + player.h));
    if (dx < 86 && dy < 46) killEnemy(e);
  }
  const b = level.boss;
  if (b && !b.dying && b.stun > 0 && b.hurt <= 0) {
    const dx = Math.abs((b.x + b.w / 2) - (player.x + player.w / 2));
    if (dx < 110) damageBoss();
  }
}

function killEnemy(e) {
  if (!e || e.dead) return;
  e.dead = true;
  e.timer = 16;
  e.hitFlash = 8;
  const word = bumpCombo();
  award(e.kind === 'ghost' ? 150 : 100, e.x + e.w / 2, e.y, word);
  run.bugsGot++;
  if (e.glitch && run.glitches && run.glitches[e.glitch]) {
    delete run.glitches[e.glitch];
    const fix = GLITCHES[e.glitch];
    if (fix) popup(e.x + e.w / 2, e.y - 28, fix.fixed, '#b6ff6a');
  }
  bumpCamera(0.32, (player.x < e.x ? 1 : -1) * 3, 2);
  freeze(4);
  AudioBus.stomp(run.combo);
  const color = e.kind === 'ghost' ? '#d6c4ff' : '#7dce3a';
  burst(e.x + e.w / 2, e.y + e.h / 2, color, 8, 2.4);
  burst(e.x + e.w / 2, e.y + e.h / 2, color, 5, 3.2, true);
}

function hurtPlayer(fromX) {
  if (player.invuln > 0 || winning) return;
  player.invuln = 75;
  const dir = Math.sign((player.x + player.w / 2) - fromX) || -player.facing || 1;
  player.vx = dir * 4.4;
  player.vy = -6.2;
  player.pounding = false;
  run.combo = 0;
  run.comboTimer = 0;
  run.hits++;
  player.hitFlash = 7;
  bumpCamera(0.42, -dir * 5, -2);
  freeze(3);
  flash = { a: 0.28 * juice.level, color: '#ff3355' };
  AudioBus.hurt();
  popup(player.x, player.y - 12, OUCH[hash(tick, 3) % OUCH.length], '#ffb4b4');
}

function respawn() {
  player.x = checkpoint.x;
  player.y = checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.pounding = false;
  player.grounded = true;
  player.mach = 0;
  player.turboSfx = false;
  player.invuln = 100;
  run.combo = 0;
  run.comboTimer = 0;
  run.deaths++;
  player.hitFlash = 8;
  bumpCamera(0.5, 0, 4);
  freeze(6);
  flash = { a: 0.3 * juice.level, color: '#ff3355' };
  AudioBus.hurt();
  popup(player.x, player.y - 24, '¡Te caíste!', '#ffb4b4');
  snapCam = true;
}

function updateBug(e) {
  const front = e.x + (e.dir > 0 ? e.w + 3 : -3);
  const blocked = overlapsSolid(e.x + e.dir * 3, e.y + 2, e.w, e.h - 4);
  if (blocked || !hasFloor(front, e.y + e.h + 2)) e.dir *= -1;
  e.x += e.dir * e.speed;
}
function ghostBlocked(x, y, w, h) {
  const x0 = Math.floor(x / TILE);
  const y0 = Math.floor(y / TILE);
  const x1 = Math.floor((x + w - 0.001) / TILE);
  const y1 = Math.floor((y + h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return true;
      if (level.grid[ty][tx] !== 0) return true;
      for (const d of level.doors) {
        if (!d.open && tx >= d.tx && tx < d.tx + d.tw && ty >= d.ty && ty < d.ty + d.th) return true;
      }
    }
  }
  return false;
}
function updateGhost(e) {
  e.x += e.dir * e.speed;
  if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
  if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }
  const wave = Math.sin(tick / 18 + e.phase);
  let amp = 22;
  while (amp > 0 && ghostBlocked(e.x, e.baseY + wave * amp, e.w, e.h)) amp--;
  let y = e.baseY + wave * amp;
  let guard = 0;
  while (ghostBlocked(e.x, y, e.w, e.h) && guard++ < 40) y--;
  e.y = y;
}
function updateEnemies() {
  for (const e of level.enemies) {
    if (e.hitFlash > 0) e.hitFlash--;
    if (e.dead) {
      e.timer--;
      continue;
    }
    if (e.kind === 'bug') updateBug(e);
    else updateGhost(e);
    if (!aabb(player, e)) continue;
    const prevBottom = player.prevY + player.h;
    const stomp = player.vy > 0 && prevBottom <= e.y + 12;
    if (stomp) {
      killEnemy(e);
      player.vy = -7.6;
      player.grounded = false;
      player.pounding = false;
    } else if (player.invuln <= 0) {
      hurtPlayer(e.x + e.w / 2);
    }
  }
  level.enemies = level.enemies.filter((e) => !e.dead || e.timer > 0);
}

function damageBoss() {
  const b = level.boss;
  if (!b || b.dying || b.hurt > 0 || b.hp <= 0) return;
  b.hp--;
  b.stun = 0;
  b.hurt = 36;
  b.hitFlash = 8;
  b.timer = 0;
  const dyingNow = b.hp <= 0;
  bumpCamera(dyingNow ? 0.85 : 0.62, 0, dyingNow ? 8 : 5);
  freeze(dyingNow ? 10 : 7);
  const word = bumpCombo();
  award(400, b.x + b.w / 2, b.y, b.hp > 0 ? word : '¡KO!');
  AudioBus.stomp(run.combo + 2);
  burst(b.x + b.w / 2, b.y + 20, '#d6ff6a', 16, 4);
  burst(b.x + b.w / 2, b.y + 20, '#ff3b30', 8, 3.4, true);
  if (dyingNow) {
    b.dying = 75;
    flash = { a: 0.55 * juice.level, color: '#fff' };
    AudioBus.win();
  }
}

function updateBoss() {
  const b = level.boss;
  if (!b) return;
  if (b.hitFlash > 0) b.hitFlash--;
  if (b.hurt > 0) b.hurt--;
  if (b.dying > 0) {
    b.dying--;
    if (b.dying === 0) openRank();
    return;
  }
  if (b.stun > 0) {
    b.stun--;
  } else {
    if (b.enrage > 0) b.enrage--;
    b.timer++;
    let speed = (1.35 + (b.maxHp - b.hp) * 0.55) * (b.enrage > 0 ? 1.5 : 1);
    if (b.timer % 170 < 42) {
      speed *= 1.85;
      b.dir = player.x < b.x ? -1 : 1;
    }
    const next = b.x + b.dir * speed;
    if (overlapsSolid(next, b.y, b.w, b.h)) b.dir *= -1;
    else b.x = next;
    if (b.x < b.minX) { b.x = b.minX; b.dir = 1; }
    if (b.x + b.w > b.maxX) { b.x = b.maxX - b.w; b.dir = -1; }
  }
  b.y = level.groundY - b.h;
  const box = { x: b.x + 10, y: b.y + 8, w: b.w - 20, h: b.h - 10 };
  if (!aabb(player, box)) return;
  const prevBottom = player.prevY + player.h;
  const stomp = player.vy > 0 && prevBottom <= b.y + 16;
  if (b.stun > 0 && stomp) {
    damageBoss();
    player.vy = -8;
    player.grounded = false;
    player.pounding = false;
  } else if (b.stun <= 0 && player.invuln <= 0) {
    hurtPlayer(b.x + b.w / 2);
  } else if (stomp) {
    player.vy = -6;
    player.grounded = false;
  }
}

function nearDoor(d) {
  if (d.open) return false;
  const r = { x: d.tx * TILE, y: d.ty * TILE, w: d.tw * TILE, h: d.th * TILE };
  if (d.kind === 'hatch') {
    const feet = player.y + player.h;
    const xOverlap = player.x < r.x + r.w && player.x + player.w > r.x;
    return xOverlap && feet >= r.y && feet <= r.y + 120;
  }
  return player.x < r.x + r.w + 24 && player.x + player.w > r.x - 40
    && player.y < r.y + r.h + 8 && player.y + player.h > r.y - 6;
}
function nearTerminal() {
  const t = level && level.terminal;
  const b = level && level.boss;
  if (!t || !player || (b && (b.stun > 0 || b.dying))) return false;
  const box = { x: t.x - 18, y: t.y - 16, w: t.w + 36, h: t.h + 28 };
  return aabb(player, box);
}

function tryInteract() {
  if (level.boss) {
    if (level.boss.dying || level.boss.stun > 0) return;
    if (nearTerminal()) openTrivia({ type: 'boss' });
    return;
  }
  const door = level.doors.find(nearDoor);
  if (door) openTrivia({ type: 'door', door });
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pickQuestion(topic) {
  const matches = (q) => q.topic === topic;
  let pool = QUESTIONS.filter((q) => !usedQ.has(q.id) && matches(q));
  if (!pool.length) {
    for (const q of QUESTIONS) if (q.topic === topic) usedQ.delete(q.id);
    pool = QUESTIONS.filter(matches);
  }
  if (!pool.length) return null;
  const q = pool[Math.floor(Math.random() * pool.length)];
  usedQ.add(q.id);
  return q;
}
function openTrivia(target) {
  const topic = target.type === 'boss' ? 'boss' : target.door.topic;
  const q = pickQuestion(topic);
  if (!q) return;
  session = {
    target,
    q,
    opts: shuffle(q.options.map((text) => ({ text, ok: text === q.correct }))),
    attempt: 0,
    locked: false,
    success: false,
    bonus: false,
  };
  state = 'trivia';
  setOverlay('trivia');
  renderTrivia();
}
function renderTrivia() {
  const letters = ['A', 'B', 'C', 'D'];
  const root = globalThis.document.getElementById('screen-trivia');
  const title = session.target.type === 'boss' ? 'TERMINAL' : (level.quizTitle || 'FIREWALL');
  root.innerHTML = `
    <div class="card">
      <h2>${title}</h2>
      ${session.q.kicker ? `<p class="kicker">${esc(session.q.kicker)}</p>` : ''}
      <p class="q">${esc(session.q.q)}</p>
      ${session.q.code ? `<pre class="code">${esc(session.q.code)}</pre>` : ''}
      <div class="opts">
        ${session.opts.map((o, i) => `<button type="button" class="opt" data-i="${i}"><span class="k">${letters[i]}</span>${esc(o.text)}</button>`).join('')}
      </div>
      <p class="explain" id="explain"></p>
      <div class="row">
        <button type="button" class="btn ghost" id="trivia-cancel">Cerrar</button>
        <button type="button" class="btn primary hidden" id="trivia-next">Seguir</button>
      </div>
    </div>`;
  root.querySelectorAll('.opt').forEach((btn) => {
    btn.addEventListener('click', () => pickOption(Number(btn.dataset.i)));
  });
  globalThis.document.getElementById('trivia-next').addEventListener('click', onTriviaNext);
  globalThis.document.getElementById('trivia-cancel').addEventListener('click', cancelTrivia);
}
function pickOption(i) {
  if (!session || session.locked || !session.opts[i]) return;
  session.locked = true;
  session.attempt++;
  const ok = session.opts[i].ok;
  globalThis.document.querySelectorAll('#screen-trivia .opt').forEach((btn, idx) => {
    btn.disabled = true;
    if (session.opts[idx].ok) btn.classList.add('good');
    else if (idx === i) btn.classList.add('bad');
  });
  globalThis.document.getElementById('explain').textContent = (ok ? '¡Correcto! ' : 'Casi. ') + session.q.explain;
  const next = globalThis.document.getElementById('trivia-next');
  next.classList.remove('hidden');
  if (ok) {
    session.success = true;
    session.bonus = session.attempt === 1;
    next.textContent = 'Seguir';
    AudioBus.good();
  } else {
    session.success = false;
    run.wrong++;
    if (session.target.type === 'door') session.target.door.failed = true;
    if (session.target.type === 'boss' && level.boss) level.boss.enrage = 380;
    next.textContent = 'Reintentar';
    AudioBus.bad();
    flash = { a: 0.22 * juice.level, color: '#ff3355' };
    bumpCamera(0.18, 0, 2);
  }
}
function onTriviaNext() {
  if (!session || !session.locked) return;
  if (session.success) commitTrivia();
  else {
    session.locked = false;
    globalThis.document.querySelectorAll('#screen-trivia .opt').forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove('good', 'bad');
    });
    globalThis.document.getElementById('explain').textContent = '';
    globalThis.document.getElementById('trivia-next').classList.add('hidden');
  }
}
function commitTrivia() {
  const target = session.target;
  const bonus = session.bonus;
  session = null;
  waitReleaseAction = true;
  state = 'play';
  setOverlay('play');
  if (target.type === 'door') openDoor(target.door, bonus);
  else stunBoss(bonus);
}
function cancelTrivia() {
  if (session && session.success) {
    commitTrivia();
    return;
  }
  session = null;
  waitReleaseAction = true;
  if (player) player.invuln = Math.max(player.invuln, 45);
  state = 'play';
  setOverlay('play');
}
function openDoor(door, bonus) {
  door.open = true;
  if (bonus) {
    run.score += 1000;
    popup(player.x, player.y - 40, '+1000', '#ffe14a');
  }
  popup(player.x, player.y - 64, '¡ABIERTO!', '#b6ff6a');
  flash = { a: 0.35 * juice.level, color: '#fff6c8' };
  bumpCamera(0.22, 0, -2);
  freeze(2);
  burst(player.x + player.w / 2, player.y, '#ffe14a', 14, 3.5);
  if (door.kind === 'hatch') {
    checkpoint = {
      x: (door.tx + door.tw / 2) * TILE - player.w / 2,
      y: door.ty * TILE - player.h,
    };
  } else {
    checkpoint = { x: (door.tx + door.tw) * TILE + 10, y: player.y };
  }
}
function stunBoss(bonus) {
  const b = level.boss;
  b.stun = 260;
  b.enrage = 0;
  if (bonus) {
    run.score += 800;
    popup(player.x, player.y - 30, '+800', '#ffe14a');
  }
  popup(b.x + b.w / 2, b.y - 20, '¡ATURDIDO!', '#fff');
  flash = { a: 0.3 * juice.level, color: '#fff6c8' };
  bumpCamera(0.28, 0, -3);
  b.hitFlash = 10;
}

function buildStars() {
  const timeOk = run.time <= level.par;
  const triviaOk = run.wrong === 0;
  if (level.boss) {
    return [
      { name: 'Tiempo dentro del par (' + fmtTime(level.par) + ')', ok: timeOk },
      { name: 'Trivia a la primera', ok: triviaOk },
      { name: 'Sin golpes', ok: run.hits === 0 },
      { name: 'Segfault derrotado', ok: true },
    ];
  }
  return [
    { name: 'Tiempo dentro del par (' + fmtTime(level.par) + ')', ok: timeOk },
    { name: 'Trivia a la primera', ok: triviaOk },
    { name: 'Todos los cafés', ok: run.coffeeGot >= run.coffeeTotal },
    { name: 'Todos los enemigos', ok: run.bugsGot >= run.bugsTotal },
    { name: 'Sin golpes ni caídas', ok: run.hits === 0 && run.deaths === 0 },
  ];
}
function rankFrom(stars) {
  const missed = stars.filter((s) => !s.ok).length;
  if (missed <= 0) return 'S';
  if (missed === 1) return 'A';
  if (missed === 2) return 'B';
  if (missed === 3) return 'C';
  return 'D';
}
function openRank() {
  if (ranked) return;
  ranked = true;
  const stars = buildStars();
  const rank = rankFrom(stars);
  const save = loadSave();
  save.levels = save.levels || {};
  const old = save.levels[level.id];
  const order = { D: 0, C: 1, B: 2, A: 3, S: 4 };
  save.levels[level.id] = {
    rank: old && order[old.rank] > order[rank] ? old.rank : rank,
    score: Math.max(run.score, old ? old.score : 0),
  };
  writeSave(save);
  state = 'rank';
  setOverlay('rank');
  const ids = LevelBank.list.map((l) => l.id);
  const next = ids[ids.indexOf(level.id) + 1];
  const root = globalThis.document.getElementById('screen-rank');
  root.innerHTML = `
    <div class="rank-wrap">
      <p class="rank-letter rank-${rank}">${rank}</p>
      <p class="rank-title">${RANK_BLURB[rank]}</p>
      <div class="stats">
        <span>${fmtScore(run.score)} pts</span>
        <span>${fmtTime(run.time)}</span>
        <span>${run.coffeeGot}/${run.coffeeTotal} cafés</span>
        <span>${run.bugsGot}/${run.bugsTotal} bugs</span>
      </div>
      <ul class="stars">
        ${stars.map((s) => `<li class="${s.ok ? 'on' : 'off'}">${s.ok ? '★' : '☆'} ${esc(s.name)}</li>`).join('')}
      </ul>
      <div class="row" style="justify-content:center">
        <button type="button" class="btn primary" id="rank-retry">Reintentar</button>
        ${next ? `<button type="button" class="btn" id="rank-next">Siguiente</button>` : ''}
        <button type="button" class="btn ghost" id="rank-menu">Menú</button>
      </div>
    </div>`;
  globalThis.document.getElementById('rank-retry').onclick = () => startLevel(level.id);
  const nextBtn = globalThis.document.getElementById('rank-next');
  if (nextBtn) nextBtn.onclick = () => startLevel(next);
  globalThis.document.getElementById('rank-menu').onclick = goTitle;
  if (rank === 'S' || rank === 'A') burst(player.x + player.w / 2, player.y, '#ffe14a', 28, 5);
}

function updatePlay() {
  poll();
  if (winning > 0) {
    winning--;
    player.vx = 0;
    player.vy = 0;
    updateCamera();
    if (winning === 0) openRank();
    return;
  }

  let dropped = false;
  if (input.downEdge && player.grounded && canDropThrough()) {
    player.y += 12;
    player.vy = 2;
    player.grounded = false;
    dropped = true;
  }

  player.wasGrounded = player.grounded;
  player.grounded = false;
  player.justLanded = false;
  player.landImpact = 0;
  player.prevY = player.y;

  if (input.jumpEdge) player.buffer = 8;
  else if (player.buffer > 0) player.buffer--;

  if (player.buffer > 0 && (player.wasGrounded || player.coyote > 0)) doJump(false);
  else if (player.buffer > 0 && player.wallSliding && canCling()) doJump(true);

  if (!dropped && input.downEdge && !player.wasGrounded && !player.pounding && !glitchOn(run, 'no-pound')) {
    player.pounding = true;
    player.vy = 12;
  }

  if (player.vy < 0 && !input.jumpHeld && !player.jumpCut) {
    player.vy *= 0.45;
    player.jumpCut = true;
  }

  accelPlayer();

  if (player.wasGrounded && player.vy >= 0 && !player.pounding) player.vy = 0.85;
  else {
    const g = glitchOn(run, 'heavy') ? GRAVITY * 1.75 : GRAVITY;
    player.vy = Math.min(MAX_FALL, player.vy + (player.pounding ? 0.75 : g));
  }

  const pounded = player.pounding;
  moveX();
  moveY();
  moveOneWay();

  if (player.grounded) {
    player.coyote = 8;
    if (pounded && player.justLanded) shockwave();
    player.pounding = false;
  } else if (player.coyote > 0) player.coyote--;

  player.wallSliding = !!(
    canCling() && !player.grounded && player.wallDir && input.dir === player.wallDir && player.vy > 0
  );
  if (player.wallSliding) player.vy = Math.min(player.vy, 1.7);

  if (player.justLanded) {
    player.squash = player.landImpact > 8 ? 0.55 : 0.68;
    if (!pounded) {
      burst(player.x + player.w / 2, player.y + player.h, '#e7c39a', player.landImpact > 8 ? 7 : 3, 1.4);
      if (player.landImpact > 6) AudioBus.land();
    }
  } else player.squash += ((player.grounded ? 1 : 1.12) - player.squash) * 0.2;
  if (player.grounded && Math.abs(player.vx) > 0.45) {
    player.cycle += 0.16 + Math.abs(player.vx) * 0.045;
  }
  if (player.invuln > 0) player.invuln--;

  if (player.y > level.h * TILE + 24) respawn();

  updateEnemies();
  updateBoss();

  for (const c of level.coffees) {
    if (c.got || !aabb(player, c)) continue;
    c.got = true;
    const word = bumpCombo();
    award(50, c.x, c.y, word);
    run.coffeeGot++;
    AudioBus.coffee();
    burst(c.x + 8, c.y + 8, '#ffd23f', 8, 2.2);
  }

  if (input.actionEdge) tryInteract();

  if (level.boss && level.boss.stun > 0) hudPrompt = '¡APLÁSTALO!';
  else if (level.boss && nearTerminal()) hudPrompt = 'E  RESPONDER';
  else if (level.doors.some(nearDoor)) hudPrompt = 'E  TRIVIA';
  else hudPrompt = '';

  if (level.exit && player.grounded && aabb(player, level.exit)) {
    winning = 48;
    player.vx = 0;
    popup(player.x, player.y - 30, '¡DEPLOY!', '#b6ff6a');
    AudioBus.win();
  }

  if (run.comboTimer > 0) {
    run.comboTimer--;
    if (run.comboTimer === 0) run.combo = 0;
  }
  run.time += 1 / 60;

  if (player.mach > 0.6 && player.grounded && tick % 3 === 0) {
    trails.push({
      x: player.x, y: player.y, w: player.w, h: player.h,
      facing: player.facing, squash: player.squash, cycle: player.cycle,
      mach: player.mach, grounded: true, invuln: 0, life: 8,
    });
  }
  trails = trails.filter((t) => --t.life > 0);
  if (player.grounded && player.mach > 0.72 && tick % 5 === 0) {
    burst(player.x + player.w / 2, player.y + player.h, '#e7c39a', 1, 1.2);
  }
  if (banner && banner.life > 0) banner.life--;
  updateCamera();
}

function updateFx() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.g;
    p.rot = (p.rot || 0) + (p.spin || 0);
    p.life--;
  }
  particles = particles.filter((p) => p.life > 0);
  for (const p of popups) {
    p.y -= 0.65;
    p.life--;
  }
  popups = popups.filter((p) => p.life > 0);
  if (hitstop <= 0) {
    trauma = Math.max(0, trauma - 0.04);
    kickX *= 0.78;
    kickY *= 0.78;
    if (Math.abs(kickX) < 0.15) kickX = 0;
    if (Math.abs(kickY) < 0.15) kickY = 0;
  }
  if (player && player.hitFlash > 0 && state === 'play' && hitstop <= 0) player.hitFlash--;
  if (flash.a > 0.02) flash.a *= 0.86;
  else flash.a = 0;
}

function tickFrame() {
  tick++;
  if (state === 'play') {
    if (hitstop > 0) hitstop--;
    else updatePlay();
  } else if (state === 'title') {
    titleActor.cycle += 0.24;
  }
  updateFx();
}

function canCling() {
  return !!(level && level.wallJump && !glitchOn(run, 'no-cling'));
}
function canDropThrough() {
  const foot = player.y + player.h;
  const ty = Math.floor(foot / TILE);
  const x0 = Math.floor(player.x / TILE);
  const x1 = Math.floor((player.x + player.w - 0.001) / TILE);
  let oneway = false;
  for (let tx = x0; tx <= x1; tx++) {
    if (cellSolid(tx, ty)) return false;
    if (cellOneWay(tx, ty)) oneway = true;
  }
  return oneway;
}
function drawBrick(px, py, seed) {
  const skin = (level && level.brick) || { a: '#ff4d32', b: '#ff6a3c', c: '#c43218' };
  ctx.fillStyle = seed % 2 ? skin.a : skin.b;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  ctx.fillRect(px, py, TILE, 5);
  ctx.fillStyle = skin.c;
  ctx.fillRect(px, py + TILE - 6, TILE, 6);
  if (seed % 5 === 0) {
    ctx.fillStyle = '#8a2414';
    ctx.beginPath();
    ctx.arc(px + 8 + (seed % 14), py + 15, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a0d08';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
}
function drawPlatform(px, py) {
  ctx.fillStyle = '#8d5a3c';
  ctx.fillRect(px, py, TILE, 12);
  ctx.fillStyle = '#ffd7a8';
  ctx.fillRect(px, py, TILE, 4);
  ctx.strokeStyle = '#1c0c08';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, TILE - 2, 11);
}
function bugEyes(y) {
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-5, y, 3, 0, Math.PI * 2);
  ctx.arc(6, y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c0c08';
  ctx.beginPath();
  ctx.arc(-4, y, 1.3, 0, Math.PI * 2);
  ctx.arc(7, y, 1.3, 0, Math.PI * 2);
  ctx.fill();
}
function drawBugBody(id) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1c0c08';
  if (id === 'heavy') {
    ctx.fillStyle = '#ff8a3a';
    ctx.fillRect(-14, -28, 28, 8);
    ctx.strokeRect(-14, -28, 28, 8);
    ctx.fillRect(-12, -19, 24, 8);
    ctx.strokeRect(-12, -19, 24, 8);
    ctx.fillRect(-10, -10, 20, 8);
    ctx.strokeRect(-10, -10, 20, 8);
    bugEyes(-24);
    return;
  }
  if (id === 'scramble') {
    ctx.save();
    ctx.rotate(tick / 10);
    ctx.strokeStyle = '#e6d7a2';
    ctx.beginPath();
    ctx.arc(0, -14, 16, 0, Math.PI * 2);
    ctx.moveTo(-12, -14);
    ctx.lineTo(12, -14);
    ctx.moveTo(0, -26);
    ctx.lineTo(0, -2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#8a9a48';
    ctx.beginPath();
    ctx.arc(0, -14, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    bugEyes(-16);
    return;
  }
  if (id === 'lag-cam') {
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.arc(0, -16, 12, Math.PI, 0);
    ctx.lineTo(10, -6);
    ctx.lineTo(-10, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(-4, -6, 8, 5);
    ctx.strokeRect(-4, -6, 8, 5);
    bugEyes(-18);
    return;
  }
  if (id === 'echo') {
    ctx.fillStyle = '#3ec1ff';
    ctx.fillRect(-12, -22, 22, 16);
    ctx.strokeRect(-12, -22, 22, 16);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(10, -18);
    ctx.lineTo(20, -14);
    ctx.lineTo(10, -10);
    ctx.fill();
    ctx.stroke();
    bugEyes(-16);
    return;
  }
  if (id === 'no-cling') {
    ctx.fillStyle = '#e0a85a';
    ctx.fillRect(-16, -28, 32, 6);
    ctx.strokeRect(-16, -28, 32, 6);
    ctx.beginPath();
    ctx.ellipse(0, -12, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#7a4e22';
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.lineTo(-20, -2);
    ctx.moveTo(12, -8);
    ctx.lineTo(20, -2);
    ctx.stroke();
    bugEyes(-16);
    return;
  }
  if (id === 'flip') {
    ctx.fillStyle = '#f4f0ff';
    ctx.beginPath();
    ctx.ellipse(0, -12, 15, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1c0c08';
    ctx.beginPath();
    ctx.arc(0, -12, 5, 0, Math.PI * 2);
    ctx.fill();
    bugEyes(-18);
    return;
  }
  ctx.fillStyle = '#f4ffe4';
  ctx.beginPath();
  ctx.ellipse(0, -14, 12, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1c0c08';
  ctx.beginPath();
  ctx.arc(0, -20, 4.5, 0, Math.PI * 2);
  ctx.arc(1, -8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(1, -4);
  ctx.quadraticCurveTo(-6, 2, 4, 4);
  ctx.stroke();
}
function drawBug(e) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h);
  if (e.hitFlash > 0) ctx.filter = 'brightness(3)';
  if (e.dead) ctx.scale(1.35, 0.32);
  drawBugBody(e.glitch || '');
  if (!e.dead && e.glitch && glitchOn(run, e.glitch) && GLITCHES[e.glitch]) {
    const name = GLITCHES[e.glitch].name;
    ctx.fillStyle = '#ffe14a';
    ctx.strokeStyle = '#1c0c08';
    ctx.lineWidth = 3;
    ctx.font = '800 13px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText(name, 0, -44);
    ctx.fillText(name, 0, -44);
  }
  ctx.restore();
}
function drawGhost(e) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
  if (e.hitFlash > 0) ctx.filter = 'brightness(3)';
  if (e.dead) ctx.scale(1.3, 0.35);
  const skin = e.skin || 'null';
  ctx.fillStyle = skin === 'head' ? 'rgba(186, 220, 255, .95)'
    : skin === 'oracle' ? 'rgba(255, 214, 140, .95)'
    : skin === 'note' ? 'rgba(214, 255, 196, .95)'
    : 'rgba(214, 196, 255, 0.95)';
  ctx.strokeStyle = '#1c0c08';
  ctx.lineWidth = 3;
  round(-16, -16, 32, 30, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1c0c08';
  ctx.font = '800 11px Nunito, sans-serif';
  ctx.textAlign = 'center';
  const tag = skin === 'head' ? '▶' : skin === 'oracle' ? '?' : skin === 'note' ? '//' : 'null';
  ctx.fillText(tag, 0, 4);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-6, -6, 3, 0, Math.PI * 2);
  ctx.arc(6, -6, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c0c08';
  ctx.beginPath();
  ctx.arc(-5, -6, 1.3, 0, Math.PI * 2);
  ctx.arc(7, -6, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawBoss(b) {
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h);
  if (b.hitFlash > 0) ctx.filter = 'brightness(2.6)';
  if (b.dying) ctx.globalAlpha = Math.max(0.15, b.dying / 75);
  if (b.stun > 0) ctx.rotate(Math.sin(tick / 3) * 0.12);
  ctx.fillStyle = b.enrage > 0 ? '#d2ff4a' : '#6ed63a';
  ctx.strokeStyle = '#1c0c08';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, -28, 40, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3d7a16';
  ctx.beginPath();
  ctx.arc(-10, -30, 6, 0, Math.PI * 2);
  ctx.arc(14, -22, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-14, -36, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(14, -36, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c0c08';
  ctx.beginPath();
  if (b.stun > 0) {
    ctx.arc(-14, -36, 3, 0, Math.PI * 2);
    ctx.arc(14, -36, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.arc(-12, -36, 3, 0, Math.PI * 2);
    ctx.arc(16, -36, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-18, -50);
  ctx.lineTo(-28, -68);
  ctx.lineTo(-8, -50);
  ctx.moveTo(18, -50);
  ctx.lineTo(30, -68);
  ctx.lineTo(8, -50);
  ctx.fillStyle = '#ff3b30';
  ctx.fill();
  ctx.font = '800 16px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1c0c08';
  const label = b.stun > 0 ? '¿¿??' : 'SEGFAULT';
  ctx.strokeText(label, 0, -78);
  ctx.fillStyle = '#ffe14a';
  ctx.fillText(label, 0, -78);
  ctx.restore();
}
function drawTerminal(t, glow) {
  ctx.save();
  ctx.translate(t.x, t.y);
  meat(0, 8, t.w, 14, 3, '#6b3a1f');
  meat(6, -18, t.w - 12, 28, 3, glow ? '#123' : '#141026');
  ctx.fillStyle = glow ? '#d6ffb0' : '#7dffb2';
  ctx.font = '800 11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('>_', 10, 2);
  ctx.restore();
}
function drawCoffee(c) {
  if (c.got) return;
  const bob = Math.sin(tick / 8 + c.x * 0.05) * 3;
  ctx.save();
  ctx.translate(c.x + 8, c.y + 8 + bob);
  meat(-7, -5, 14, 12, 3, '#fff');
  ctx.fillStyle = '#6b3a1f';
  ctx.fillRect(-5, -3, 10, 7);
  ctx.strokeStyle = '#1c0c08';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(8, 1, 4, -1.2, 1.2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -8);
  ctx.quadraticCurveTo(3, -14, 0, -18);
  ctx.stroke();
  ctx.restore();
}
function drawExit(r) {
  const bob = Math.sin(tick / 9) * 3;
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + bob);
  ctx.fillStyle = '#143222';
  ctx.strokeStyle = '#b6ff6a';
  ctx.lineWidth = 4;
  round(-r.w / 2 + 8, -r.h / 2 + 6, r.w - 16, r.h - 10, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b6ff6a';
  ctx.font = '800 18px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PUSH', 0, 6);
  ctx.restore();
}
function drawGate(d) {
  if (d.open) return;
  const x = d.tx * TILE;
  const y = d.ty * TILE;
  const w = d.tw * TILE;
  const h = d.th * TILE;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const o = (tick * 3) % 28;
  for (let i = -28; i < h + 28; i += 28) {
    ctx.fillStyle = '#161616';
    ctx.fillRect(x, y + i + o, w, 14);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x, y + i + o + 14, w, 14);
  }
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1c0c08';
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = '#1c0c08';
  ctx.font = '800 20px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TRIVIA', x + w / 2, y + h / 2 + 6);
}
function drawHatch(d) {
  const x = d.tx * TILE;
  const y = d.ty * TILE;
  const w = d.tw * TILE;
  const h = d.th * TILE;
  if (!d.open) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const o = (tick * 4) % 24;
    for (let i = -24; i < w + 24; i += 24) {
      ctx.fillStyle = '#161616';
      ctx.fillRect(x + i + o, y, 12, h);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(x + i + o + 12, y, 12, h);
    }
    ctx.restore();
    ctx.strokeStyle = '#1c0c08';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    drawTerminal({ x: x + w / 2 - 20, y: y + h + 6, w: 40, h: 32 }, true);
  } else {
    ctx.fillStyle = '#7af0ff';
    ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(x, y, w, 3);
    ctx.strokeStyle = '#1c0c08';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, 10);
  }
}
function textWidth(line) {
  return Math.max(ctx.measureText(line).width, String(line).length * 7.6);
}
function wrapText(text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? cur + ' ' + word : word;
    if (cur && ctx.measureText(next).width > maxWidth) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}
function drawSigns() {
  let best = null;
  let bestD = 999;
  for (const s of level.signs) {
    ctx.fillStyle = '#6b3a1f';
    ctx.fillRect(s.x, s.y - 36, 6, 36);
    ctx.fillStyle = '#ffe14a';
    ctx.strokeStyle = '#1c0c08';
    ctx.lineWidth = 3;
    round(s.x - 16, s.y - 58, 38, 24, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1c0c08';
    ctx.font = '800 14px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', s.x + 3, s.y - 41);
    const dist = Math.hypot((player.x + 11) - s.x, player.y - s.y);
    if (dist < bestD) { best = s; bestD = dist; }
  }
  if (!best || bestD > 130) return;
  ctx.font = '800 15px Nunito, sans-serif';
  ctx.textAlign = 'left';
  const maxW = viewW < DESKTOP_W ? Math.max(150, viewW * 0.72) : viewW - 24;
  const lines = best.lines.flatMap((line) => wrapText(line, maxW - 28));
  const bw = Math.min(maxW, Math.max(120, ...lines.map((line) => textWidth(line))) + 28);
  const bh = 16 + lines.length * 20;
  let left = best.x + 8 - bw / 2;
  left = Math.max(cam.x + 8, Math.min(left, cam.x + viewW - bw - 8));
  let top = best.y - 78 - bh;
  top = Math.max(cam.y + 8, Math.min(top, cam.y + viewH - bh - 8));
  ctx.fillStyle = '#fff6e4';
  ctx.strokeStyle = '#1c0c08';
  ctx.lineWidth = 3;
  round(left, top, bw, bh, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1c0c08';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, left + bw / 2, top + 22 + i * 20));
}
function drawLava() {
  if (level.floorRow == null) return;
  const row = level.floorRow;
  for (let x = 0; x < level.w;) {
    if (level.grid[row][x] !== 0) { x++; continue; }
    let x2 = x;
    while (x2 < level.w && level.grid[row][x2] === 0) x2++;
    const px = x * TILE;
    const py = row * TILE;
    const pw = (x2 - x) * TILE;
    ctx.fillStyle = '#2a0812';
    ctx.fillRect(px, py, pw, (level.h - row) * TILE);
    ctx.fillStyle = '#ff3b1f';
    ctx.fillRect(px, py, pw, 14);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(px, py + 6 + Math.sin(tick / 7 + x) * 2, pw, 4);
    x = x2;
  }
}
function drawMarkers() {
  if (!level.markers) return;
  for (const m of level.markers) {
    if (m.kind === 'rotor') {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(tick / 48);
      ctx.strokeStyle = '#e6d7a2';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, m.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-m.r + 4, 0);
      ctx.lineTo(m.r - 4, 0);
      ctx.moveTo(0, -m.r + 4);
      ctx.lineTo(0, m.r - 4);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#f6e7b4';
      ctx.font = '800 16px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, m.x, m.y - m.r - 8);
    } else if (m.kind === 'bit') {
      ctx.fillStyle = 'rgba(186, 220, 255, .45)';
      ctx.font = '800 20px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.t, m.x, m.y);
    } else if (m.kind === 'label') {
      ctx.fillStyle = 'rgba(255, 236, 180, .55)';
      ctx.font = '800 28px "Lilita One", Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.t, m.x, m.y);
    } else if (m.kind === 'plaque') {
      const maxW = viewW < DESKTOP_W ? Math.max(140, viewW * 0.7) : viewW - 24;
      ctx.font = '800 13px Nunito, sans-serif';
      const lines = (m.lines || []).flatMap((line) => wrapText(line, maxW - 16));
      const bw = Math.min(maxW, Math.max(120, textWidth(m.title || '') + 16, ...lines.map((line) => textWidth(line) + 16)));
      const bh = 26 + lines.length * 16;
      let x = m.x;
      let y = m.y;
      if (viewW < DESKTOP_W) {
        x = Math.max(cam.x + 8, Math.min(x, cam.x + viewW - bw - 8));
        const padTop = viewH > viewW ? 108 : 16;
        if (y - bh < cam.y + padTop) y = cam.y + padTop + bh;
        if (y > cam.y + viewH - 8) y = cam.y + viewH - 8;
      }
      if (x + bw < cam.x - 20 || x > cam.x + viewW + 20) continue;
      if (y < cam.y - 20 || y - bh > cam.y + viewH + 20) continue;
      ctx.fillStyle = '#fff6e4';
      ctx.strokeStyle = '#1c0c08';
      ctx.lineWidth = 3;
      round(x, y - bh, bw, bh, 8);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8a3d12';
      ctx.fillText(m.title || '', x + 8, y - bh + 16);
      ctx.fillStyle = '#1c0c08';
      ctx.font = '800 12px Nunito, sans-serif';
      lines.forEach((line, i) => ctx.fillText(line, x + 8, y - bh + 32 + i * 16));
    }
  }
}
function useScreen() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function useWorld(sx, sy) {
  const z = cssW / viewW;
  ctx.setTransform(dpr * z, 0, 0, dpr * z, (sx || 0) * dpr, (sy || 0) * dpr);
}
function drawBackdrop() {
  const sky = level.sky || { top: '#4b2a78', mid: '#241433', bot: '#140810' };
  const hues = level.hues || ['#2a1848', '#1b2744', '#3a1844'];
  ctx.save();
  useWorld(0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, sky.top);
  g.addColorStop(0.55, sky.mid);
  g.addColorStop(1, sky.bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
  const par = cam.x * 0.32;
  for (const b of level.bg) {
    const dx = b.x - par;
    if (dx > viewW + 20 || dx + b.w < -20) continue;
    ctx.fillStyle = hues[b.hue % hues.length];
    ctx.fillRect(dx, viewH - b.h, b.w, b.h);
    ctx.fillStyle = 'rgba(255, 220, 120, .33)';
    for (let wy = viewH - b.h + 12; wy < viewH - 16; wy += 18) {
      for (let wx = dx + 8; wx < dx + b.w - 10; wx += 16) {
        if (hash(wx | 0, wy | 0) % 4 === 0) ctx.fillRect(wx, wy, 7, 5);
      }
    }
  }
  ctx.restore();
}
function drawLevel() {
  drawBackdrop();
  const mag = trauma * trauma * 16;
  const sx = (trauma ? (Math.random() * 2 - 1) * mag : 0) + kickX;
  const sy = (trauma ? (Math.random() * 2 - 1) * mag : 0) + kickY;
  ctx.save();
  useWorld(sx, sy);
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  if (level.glyphs) {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff';
    ctx.font = '800 26px Nunito, sans-serif';
    for (const g of level.glyphs) ctx.fillText(g.t, g.x, g.y + Math.sin(tick / 28 + g.x) * 8);
    ctx.globalAlpha = 1;
  }
  drawMarkers();
  drawLava();
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 2);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 2);
  const x1 = Math.min(level.w - 1, Math.floor((cam.x + viewW) / TILE) + 2);
  const y1 = Math.min(level.h - 1, Math.floor((cam.y + viewH) / TILE) + 2);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const cell = level.grid[ty][tx];
      if (cell === 1) drawBrick(tx * TILE, ty * TILE, hash(tx, ty));
      else if (cell === 2) drawPlatform(tx * TILE, ty * TILE);
    }
  }
  for (const d of level.doors) (d.kind === 'hatch' ? drawHatch(d) : drawGate(d));
  if (level.terminal) drawTerminal(level.terminal, nearTerminal());
  if (level.exit) drawExit(level.exit);
  for (const c of level.coffees) drawCoffee(c);
  if (player) drawSigns();
  for (const e of level.enemies) (e.kind === 'ghost' ? drawGhost(e) : drawBug(e));
  if (level.boss) drawBoss(level.boss);
  for (const t of trails) drawHero(ctx, t, true, tick);
  drawHero(ctx, player, false, tick);
  for (const p of particles) {
    const t = Math.max(0, p.life / p.max);
    const s = p.size * (0.35 + 0.65 * t);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.fillStyle = p.color;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = '800 16px Nunito, sans-serif';
  for (const p of popups) {
    ctx.globalAlpha = Math.max(0, p.life / 48);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1c0c08';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.restore();
  useScreen();
  if (banner && banner.life > 0 && viewW >= DESKTOP_W) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, banner.life / 24);
    ctx.font = '40px "Lilita One", Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1c0c08';
    ctx.strokeText(banner.text, cssW / 2, Math.min(132, cssH * 0.24));
    ctx.fillStyle = '#ffe14a';
    ctx.fillText(banner.text, cssW / 2, Math.min(132, cssH * 0.24));
    ctx.restore();
  }
  if (player && state === 'play' && player.mach > 0.74) {
    ctx.save();
    ctx.globalAlpha = (player.mach - 0.74) * 2;
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 2;
    const dir = player.facing || 1;
    for (let i = 0; i < 12; i++) {
      const y = hash(i, 4) % cssH;
      const x = (hash(i, 7) + tick * 22) % (cssW + 160) - 80;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dir * (30 + player.mach * 70), y + ((i % 3) - 1));
      ctx.stroke();
    }
    ctx.restore();
  }
  if (flash.a > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.65, flash.a);
    ctx.fillStyle = flash.color;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.restore();
  }
}
function drawTitle() {
  useScreen();
  const g = ctx.createLinearGradient(0, 0, 0, cssH);
  g.addColorStop(0, '#5a32a8');
  g.addColorStop(1, '#1a0c18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cssW, cssH);
  for (let i = 0; i < 7; i++) {
    const x = ((i * 190 - tick * 0.7) % 1200 + 1200) % 1200 - 100;
    ctx.fillStyle = i % 2 ? '#2a1848' : '#1c2748';
    ctx.fillRect(x, 250, 130, 290);
  }
  for (let i = -1; i < 34; i++) drawBrick(i * TILE - (tick % TILE), 488, i + 4);
  drawHero(ctx, titleActor, false, tick);
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.font = '800 28px Nunito, sans-serif';
  ctx.fillText('{ }', 80 + Math.sin(tick / 20) * 8, 120);
  ctx.fillText('if', 180, 200);
  ctx.fillText('=>', 80, 300);
}

function syncHud() {
  if (!run || !player) return;
  const score = globalThis.document.getElementById('score');
  const loot = globalThis.document.getElementById('loot');
  const combo = globalThis.document.getElementById('combo');
  const bar = globalThis.document.getElementById('combo-bar');
  const timer = globalThis.document.getElementById('timer');
  const mach = globalThis.document.getElementById('mach-bar');
  const machLabel = globalThis.document.getElementById('mach-label');
  const prompt = globalThis.document.getElementById('prompt');
  const hp = globalThis.document.getElementById('boss-hp');
  if (score) score.textContent = fmtScore(run.score);
  if (loot) {
    loot.textContent = level.boss
      ? 'Responde en la terminal y aplasta'
      : '☕ ' + run.coffeeGot + '/' + run.coffeeTotal + '    🐛 ' + run.bugsGot + '/' + run.bugsTotal;
  }
  const glitchLine = globalThis.document.getElementById('glitches');
  if (glitchLine) {
    const names = activeGlitchNames(run);
    glitchLine.textContent = names.length ? 'Roto: ' + names.join(' · ') : '';
  }
  if (combo) combo.textContent = run.combo >= 2 ? 'x' + run.combo : '';
  if (bar) bar.style.transform = 'scaleX(' + (run.comboTimer / 170) + ')';
  if (timer) timer.textContent = fmtTime(run.time);
  if (mach) mach.style.width = Math.round(player.mach * 100) + '%';
  if (machLabel) {
    machLabel.textContent = glitchOn(run, 'no-turbo')
      ? 'ROTO'
      : player.mach > 0.82 ? '¡TURBO!' : player.mach > 0.4 ? 'CORRE' : 'PASO';
  }
  if (prompt) prompt.textContent = hudPrompt;
  if (hp) {
    hp.textContent = level.boss
      ? '●'.repeat(Math.max(0, level.boss.hp)) + '○'.repeat(Math.max(0, level.boss.maxHp - level.boss.hp))
      : '';
  }
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state === 'title' || !level) drawTitle();
  else drawLevel();
  if (state === 'play') syncHud();
  frame.classList.toggle('turbo', !!(player && state === 'play' && player.mach > 0.8));
}

function clearTouch() {
  touchPointers.clear();
  virt.left = virt.right = virt.jump = virt.down = virt.action = false;
  const root = globalThis.document.getElementById('touch');
  if (root) root.querySelectorAll('button').forEach((btn) => btn.classList.remove('held'));
}
function syncTouch() {
  virt.left = virt.right = virt.jump = virt.down = virt.action = false;
  for (const k of touchPointers.values()) virt[k] = true;
  globalThis.document.querySelectorAll('#touch button').forEach((btn) => {
    btn.classList.toggle('held', [...touchPointers.values()].includes(btn.dataset.k));
  });
}
function setOverlay(name) {
  if (name !== 'play') clearTouch();
  globalThis.document.getElementById('screen-title').classList.toggle('hidden', name !== 'title');
  globalThis.document.getElementById('screen-trivia').classList.toggle('hidden', name !== 'trivia');
  globalThis.document.getElementById('screen-pause').classList.toggle('hidden', name !== 'pause');
  globalThis.document.getElementById('screen-rank').classList.toggle('hidden', name !== 'rank');
  globalThis.document.getElementById('hud').classList.toggle('hidden', name !== 'play');
  globalThis.document.getElementById('touch').classList.toggle('hidden', name !== 'play');
}
function goTitle() {
  state = 'title';
  level = null;
  session = null;
  setOverlay('title');
  paintCards();
}
function openPause() {
  state = 'pause';
  setOverlay('pause');
  globalThis.document.getElementById('screen-pause').innerHTML = `
    <div class="card">
      <h2>PAUSA</h2>
      <p class="q">${esc(level ? level.name : '')}</p>
      <div class="row">
        <button type="button" class="btn primary" id="resume">Seguir</button>
        <button type="button" class="btn" id="retry">Reintentar</button>
        <button type="button" class="btn ghost" id="menu">Menú</button>
      </div>
    </div>`;
  globalThis.document.getElementById('resume').onclick = () => {
    waitReleaseAction = true;
    state = 'play';
    setOverlay('play');
  };
  globalThis.document.getElementById('retry').onclick = () => startLevel(level.id);
  globalThis.document.getElementById('menu').onclick = goTitle;
}
function paintCards() {
  const save = loadSave();
  globalThis.document.querySelectorAll('.level-card').forEach((btn) => {
    const best = save.levels && save.levels[btn.dataset.level];
    const el = btn.querySelector('.best');
    if (el) el.textContent = best ? 'Mejor ' + best.rank + ' · ' + fmtScore(best.score) : 'Sin jugar';
  });
}
function buildTitle() {
  const root = globalThis.document.getElementById('screen-title');
  const letters = 'CODE TOWER'.split('').map((ch) => `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  root.innerHTML = `
    <h1 class="logo">${letters}</h1>
    <p class="tagline">Aplasta bugs. Responde rápido. Llega al deploy.</p>
    <p class="who">Tú eres Píxel</p>
    <div class="levels" id="level-list"></div>
    <p class="help">Flechas o A D correr · Espacio saltar · Abajo en el aire golpea<br>Abajo en una losa, caes · E abre el techo · Cada bug rompe una cosa distinta</p>`;
  const list = globalThis.document.getElementById('level-list');
  for (const meta of LevelBank.list) {
    const btn = globalThis.document.createElement('button');
    btn.type = 'button';
    btn.className = 'level-card';
    btn.dataset.level = meta.id;
    btn.innerHTML = `<small>${esc(meta.chapter)}</small><strong>${esc(meta.name)}</strong><em>${esc(meta.blurb)}</em><div class="best"></div>`;
    btn.addEventListener('click', () => startLevel(meta.id));
    list.appendChild(btn);
  }
  paintCards();
}
function buildHud() {
  globalThis.document.getElementById('hud').innerHTML = `
    <div class="hud-top">
      <div>
        <div class="score" id="score">000000</div>
        <div class="subline" id="loot"></div>
        <div class="subline glitch-line" id="glitches"></div>
        <div class="combo" id="combo"></div>
        <div class="combo-track"><span id="combo-bar"></span></div>
      </div>
      <div>
        <div class="timer" id="timer">0:00</div>
        <div class="level-name" id="level-name"></div>
        <div class="level-name" id="boss-hp"></div>
      </div>
    </div>
    <div class="mach"><b id="mach-label">PASO</b><div class="mach-track"><span id="mach-bar"></span></div></div>
    <div id="prompt"></div>`;
}

function bindInput() {
  const block = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  globalThis.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (block.has(e.code)) e.preventDefault();
    onPress(e);
  });
  globalThis.addEventListener('keyup', (e) => { keys[e.code] = false; });
  globalThis.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    clearTouch();
  });
  globalThis.document.querySelectorAll('#touch button').forEach((btn) => {
    const k = btn.dataset.k;
    const drop = (e) => {
      touchPointers.delete(e.pointerId);
      syncTouch();
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* el dedo ya se fue */ }
      touchPointers.set(e.pointerId, k);
      syncTouch();
      AudioBus.ensure();
    });
    btn.addEventListener('pointerup', drop);
    btn.addEventListener('pointercancel', drop);
    btn.addEventListener('lostpointercapture', (e) => {
      if (btn.hasPointerCapture(e.pointerId)) return;
      drop(e);
    });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  globalThis.document.getElementById('juice').addEventListener('click', () => {
    const save = loadSave();
    const order = [1, 0.4, 0];
    const idx = order.findIndex((n) => Math.abs(n - juice.level) < 0.05);
    save.juice = order[(idx + 1) % order.length];
    writeSave(save);
    applyJuice();
    AudioBus.click();
  });
  globalThis.document.getElementById('mute').addEventListener('click', () => {
    const save = loadSave();
    save.mute = !save.mute;
    writeSave(save);
    applyMute();
    if (!save.mute) AudioBus.click();
  });
  globalThis.document.getElementById('full').addEventListener('click', () => {
    if (!globalThis.document.fullscreenElement) globalThis.document.documentElement.requestFullscreen?.();
    else globalThis.document.exitFullscreen?.();
  });
}
function onPress(e) {
  AudioBus.ensure();
  if (state === 'title') {
    const digit = /^Digit([1-9])$/.exec(e.code) || /^Numpad([1-9])$/.exec(e.code);
    const n = digit ? Number(digit[1]) : 0;
    if (e.code === 'Enter') startLevel(LevelBank.list[0].id);
    else if (n >= 1 && n <= LevelBank.list.length) startLevel(LevelBank.list[n - 1].id);
  } else if (state === 'play') {
    if (e.code === 'Escape') openPause();
  } else if (state === 'pause') {
    if (e.code === 'Escape') {
      waitReleaseAction = true;
      state = 'play';
      setOverlay('play');
    }
  } else if (state === 'trivia') {
    const map = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
    if (map[e.code] != null) pickOption(map[e.code]);
    if (e.code === 'Escape') cancelTrivia();
    if ((e.code === 'Enter' || e.code === 'Space') && session && session.locked) {
      e.preventDefault();
      onTriviaNext();
    }
  } else if (state === 'rank' && e.code === 'Enter') {
    startLevel(level.id);
  }
}
function applyMute() {
  const save = loadSave();
  AudioBus.muted = !!save.mute;
  const btn = globalThis.document.getElementById('mute');
  if (btn) btn.textContent = AudioBus.muted ? '🔇' : '🔊';
}
function applyJuice() {
  const save = loadSave();
  if (typeof save.juice === 'number') juice.level = save.juice;
  else if (globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) juice.level = 0.4;
  else juice.level = 1;
  const btn = globalThis.document.getElementById('juice');
  if (!btn) return;
  btn.textContent = juice.level <= 0 ? 'no' : juice.level < 1 ? '½' : 'FX';
  btn.title = juice.level <= 0 ? 'Sin sacudida ni destellos' : juice.level < 1 ? 'Efectos suaves' : 'Efectos completos';
}
function isHandheld() {
  const w = globalThis.innerWidth || DESKTOP_W;
  const h = globalThis.innerHeight || DESKTOP_H;
  const coarse = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return coarse || w < 900 || h < 500;
}
function layoutView(w, h) {
  if (!isHandheld()) {
    viewW = DESKTOP_W;
    viewH = DESKTOP_H;
    return;
  }
  const aspect = w / Math.max(1, h);
  const minViewH = 220;
  const maxTilesW = h > w ? 8 : 11;
  let vw = maxTilesW * TILE;
  let vh = vw / aspect;
  if (vh < minViewH) {
    vh = minViewH;
    vw = vh * aspect;
  }
  const capW = 14 * TILE;
  if (vw > capW) {
    vw = capW;
    vh = vw / aspect;
  }
  viewW = vw;
  viewH = vh;
}
function placeBox(el, mode, scale) {
  if (mode === 'fill') {
    el.style.transform = 'none';
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.margin = '0';
    return;
  }
  el.style.transform = 'scale(' + scale + ')';
  el.style.left = '50%';
  el.style.top = '50%';
  el.style.width = DESKTOP_W + 'px';
  el.style.height = DESKTOP_H + 'px';
  el.style.margin = (-DESKTOP_H / 2) + 'px 0 0 ' + (-DESKTOP_W / 2) + 'px';
}
function fit() {
  const w = globalThis.innerWidth || DESKTOP_W;
  const h = globalThis.innerHeight || DESKTOP_H;
  const phone = isHandheld();
  globalThis.document.body.classList.toggle('phone', phone);
  if (!phone) {
    dpr = 1;
    cssW = DESKTOP_W;
    cssH = DESKTOP_H;
    layoutView(w, h);
    canvas.width = DESKTOP_W;
    canvas.height = DESKTOP_H;
    canvas.style.width = DESKTOP_W + 'px';
    canvas.style.height = DESKTOP_H + 'px';
    const s = Math.min(w / DESKTOP_W, h / DESKTOP_H);
    placeBox(frame, 'stage', s);
    frame.style.borderRadius = '18px';
    globalThis.document.querySelectorAll('.overlay').forEach((el) => placeBox(el, 'stage', s));
  } else {
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    cssW = w;
    cssH = h;
    layoutView(w, h);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    placeBox(frame, 'fill');
    frame.style.borderRadius = '0';
    globalThis.document.querySelectorAll('.overlay').forEach((el) => placeBox(el, 'fill'));
  }
  if (player && level && state === 'play') {
    snapCam = true;
    updateCamera();
  }
}

function releaseKeys() {
  for (const k of Object.keys(keys)) keys[k] = false;
  prevJump = false;
  prevDown = false;
  prevAction = false;
  input.jumpHeld = false;
  input.left = false;
  input.right = false;
  input.dir = 0;
}
function finishTest(ok, detail) {
  const pre = globalThis.document.createElement('pre');
  pre.id = 'test-result';
  pre.textContent = (ok ? 'PASS' : 'FAIL') + '\n' + detail;
  globalThis.document.body.appendChild(pre);
}
function runAutotest() {
  const logs = [];
  let failed = false;
  const assert = (cond, msg) => {
    logs.push((cond ? 'OK  ' : 'FAIL ') + msg);
    if (!cond) failed = true;
  };
  assert(QUESTIONS.length >= 16, 'hay preguntas');
  assert(QUESTIONS.every((q) => q.options.includes(q.correct)), 'cada respuesta está en sus opciones');
  const jargon = /Steckerbrett|Umkehrwalze|Anillo 0|cálculo lambda|RedSea|LoseThos/;
  assert(QUESTIONS.every((q) => !jargon.test([q.q, q.correct, ...q.options].join(' '))), 'las preguntas se entienden sin jerga');
  assert(QUESTIONS.find((q) => q.id === 'prec').correct === '8', 'precedencia');
  assert(QUESTIONS.find((q) => q.id === 'mod').correct === '1', 'modulo');
  assert(new Set(QUESTIONS.map((q) => q.id)).size === QUESTIONS.length, 'ids únicos');
  assert(LevelBank.build('tower').doors.length === 2, 'dos hatches');
  assert(LevelBank.build('boss').boss.hp === 3, 'jefe con 3 vidas');

  startLevel('hello');
  releaseKeys();
  const floorY = player.y;
  const x0 = player.x;
  for (let i = 0; i < 50; i++) {
    keys.ArrowRight = true;
    tickFrame();
  }
  assert(player.x > x0 + 30, 'avanza en el suelo (' + Math.round(player.x - x0) + 'px)');
  assert(Math.abs(player.y - floorY) < 3, 'sigue en el piso y=' + player.y.toFixed(2));

  releaseKeys();
  startLevel('hello');
  const y0 = player.y;
  keys.Space = true;
  for (let i = 0; i < 10; i++) tickFrame();
  assert(player.y < y0 - 20, 'salta (' + Math.round(y0 - player.y) + 'px)');

  releaseKeys();
  startLevel('hello');
  const door = level.doors[0];
  assert(door.kind === 'hatch', 'hello se cierra con un techo');
  assert(overlapsSolid(8 * TILE, door.ty * TILE + 4, 8, 8), 'techo cerrado es sólido');
  const lipH = (door.ty + door.th) * TILE;
  player.x = 8 * TILE;
  player.y = lipH + 4;
  player.vy = -12;
  player.vx = 0;
  player.grounded = false;
  player.coyote = 0;
  let helloMin = player.y;
  for (let i = 0; i < 20; i++) {
    tickFrame();
    if (player.y < helloMin) helloMin = player.y;
  }
  assert(helloMin >= lipH - 2, 'el techo cerrado frena el salto minY=' + helloMin.toFixed(1));
  door.open = true;
  assert(!overlapsSolid(8 * TILE, door.ty * TILE + 4, 8, 8), 'techo abierto no bloquea');

  releaseKeys();
  startLevel('hello');
  const bugE = {
    kind: 'bug', x: 280, y: 300, w: 28, h: 24, dir: 1, speed: 0, dead: false, timer: 0,
  };
  level.enemies = [bugE];
  player.x = 280;
  player.y = bugE.y - player.h - 6;
  player.vy = 8;
  player.vx = 0;
  player.grounded = false;
  player.coyote = 0;
  const score0 = run.score;
  tickFrame();
  assert(bugE.dead, 'aplastar un bug lo elimina');
  assert(run.score > score0, 'aplastar suma puntos');

  releaseKeys();
  startLevel('tower');
  const hatch = level.doors[0];
  assert(hatch.kind === 'hatch', 'primer tope es hatch');
  hatch.open = true;
  player.x = 8 * TILE;
  player.y = hatch.ty * TILE - player.h - 80;
  player.vy = 0;
  player.vx = 0;
  player.grounded = false;
  player.coyote = 0;
  for (let i = 0; i < 140; i++) tickFrame();
  assert(
    Math.abs(player.y + player.h - hatch.ty * TILE) < 3,
    'aterriza en el hatch abierto y=' + player.y.toFixed(1),
  );

  releaseKeys();
  startLevel('tower');
  const closed = level.doors[0];
  const underside = (closed.ty + closed.th) * TILE;
  player.x = 8 * TILE;
  player.y = underside + 4;
  player.vy = -12;
  player.vx = 0;
  player.grounded = false;
  player.coyote = 0;
  let minY = player.y;
  for (let i = 0; i < 20; i++) {
    tickFrame();
    if (player.y < minY) minY = player.y;
  }
  assert(minY >= underside - 2, 'el hatch cerrado frena el salto minY=' + minY.toFixed(1));

  assert(LevelBank.list.length === 6, 'seis niveles');
  for (const tag of ['enigma', 'turing', 'temple']) {
    const themed = QUESTIONS.filter((q) => q.tag === tag);
    assert(themed.length >= 5, tag + ' tiene preguntas (' + themed.length + ')');
  }
  const beats = [
    ['hello', ['hello']],
    ['tower', ['stack', 'frames']],
    ['enigma', ['enigma']],
    ['cinta', ['turing']],
    ['templo', ['temple', 'screen']],
  ];
  for (const [id, topics] of beats) {
    const got = LevelBank.build(id).doors.map((d) => d.topic);
    assert(got.join(',') === topics.join(','), id + ' pregunta en su tramo (' + got.join(',') + ')');
    for (const topic of topics) {
      const themed = QUESTIONS.filter((q) => q.topic === topic);
      assert(themed.length >= 4, topic + ' tiene preguntas del cartel (' + themed.length + ')');
    }
  }
  assert(QUESTIONS.filter((q) => q.topic === 'boss').length >= 4, 'el jefe pregunta por null');
  const machine = LevelBank.build('enigma');
  assert(machine.quiz === 'enigma' && machine.doors[0].kind === 'hatch', 'enigma se cierra con un techo');
  assert(machine.wallJump === true, 'enigma se trepa');
  const tape = LevelBank.build('cinta');
  assert(tape.quiz === 'turing' && tape.doors[0].kind === 'hatch', 'la cinta se cierra con la bombe');
  const temple = LevelBank.build('templo');
  assert(temple.doors.length === 2 && temple.wallJump, 'el templo tiene dos techos');
  assert(temple.doors[0].ty === 30 && temple.doors[1].ty === 18, 'los techos caen en el ritmo');
  assert(
    temple.grid[23][13] === 2 && temple.grid[22][13] === 0 && temple.grid[22][11] === 1,
    'el pozo es más hondo que el salto',
  );
  for (const meta of LevelBank.list) {
    const lv = LevelBank.build(meta.id);
    if (!lv.exit) continue;
    const inside = lv.coffees.some((c) =>
      c.x < lv.exit.x + lv.exit.w && c.x + c.w > lv.exit.x
      && c.y < lv.exit.y + lv.exit.h && c.y + c.h > lv.exit.y);
    assert(!inside, meta.id + ' deja el café fuera de la salida');
  }

  releaseKeys();
  startLevel('enigma');
  const gate = level.doors[0];
  const lipE = (gate.ty + gate.th) * TILE;
  player.x = 8 * TILE;
  player.y = lipE + 4;
  player.vy = -12;
  player.vx = 0;
  player.grounded = false;
  player.coyote = 0;
  let enigmaMin = player.y;
  for (let i = 0; i < 20; i++) {
    tickFrame();
    if (player.y < enigmaMin) enigmaMin = player.y;
  }
  assert(enigmaMin >= lipE - 2, 'el techo de enigma frena el salto');

  releaseKeys();
  startLevel('templo');
  const roof = level.doors[0];
  const lip = (roof.ty + roof.th) * TILE;
  player.x = 8 * TILE;
  player.y = lip + 4;
  player.vy = -12;
  player.vx = 0;
  player.grounded = false;
  player.coyote = 0;
  let templeMin = player.y;
  for (let i = 0; i < 20; i++) {
    tickFrame();
    if (player.y < templeMin) templeMin = player.y;
  }
  assert(templeMin >= lip - 2, 'el techo del templo frena el salto');

  releaseKeys();
  startLevel('hello');
  assert(run.glitches['short-jump'], 'el salto empieza roto');
  const brokenY = player.y;
  keys.Space = true;
  for (let i = 0; i < 10; i++) tickFrame();
  const brokenHop = brokenY - player.y;
  releaseKeys();
  startLevel('hello');
  const carrier = level.enemies.find((e) => e.glitch === 'short-jump');
  assert(Math.abs(carrier.y + carrier.h - level.groundY) < 4, 'el bug del salto está en el suelo');
  player.x = carrier.x;
  player.y = carrier.y - player.h - 6;
  player.vy = 8;
  player.vx = 0;
  player.grounded = false;
  player.coyote = 0;
  tickFrame();
  assert(carrier.dead && !run.glitches['short-jump'], 'aplastar arregla el salto');
  hitstop = 0;
  player.y = level.groundY - player.h;
  player.vy = 0;
  player.grounded = true;
  player.wasGrounded = true;
  keys.Space = true;
  const fixedY = player.y;
  for (let i = 0; i < 10; i++) tickFrame();
  assert(fixedY - player.y > brokenHop + 8, 'el salto arreglado llega más alto');

  releaseKeys();
  startLevel('hello');
  const deaths0 = run.deaths;
  player.y = level.h * TILE + 80;
  tickFrame();
  assert(run.deaths === deaths0 + 1, 'caer fuera respawnea');

  releaseKeys();
  startLevel('hello');
  const ceilTx = Math.floor((player.x + 4) / TILE);
  const headTy = Math.floor(player.y / TILE);
  level.grid[headTy][ceilTx] = 1;
  const xStick = player.x;
  const yStick = player.y;
  tickFrame();
  assert(Math.abs(player.x - xStick) < 1, 'un techo bajo no escupe de lado');
  assert(player.y > yStick - 8, 'un techo bajo no absorbe hacia arriba');

  releaseKeys();
  startLevel('hello');
  player.x = 8 * TILE;
  player.y = 25 * TILE - player.h;
  player.vy = 0;
  player.vx = 0;
  player.grounded = true;
  keys.ArrowDown = true;
  tickFrame();
  assert(player.y + player.h > 25 * TILE + 8, 'abajo suelta la losa');

  releaseKeys();
  startLevel('hello');
  player.x = level.exit.x + 4;
  player.y = level.exit.y + 4;
  player.vy = 0;
  player.grounded = false;
  winning = 0;
  tickFrame();
  assert(winning === 0, 'la salida no cuenta en el aire');

  releaseKeys();
  startLevel('templo');
  run.glitches = { 'no-cling': true };
  player.x = 12 * TILE + 4;
  player.y = 23 * TILE - player.h;
  player.vy = 0;
  player.vx = 0;
  player.grounded = true;
  keys.Space = true;
  let bestFoot = player.y + player.h;
  for (let i = 0; i < 80; i++) {
    tickFrame();
    const foot = player.y + player.h;
    if (foot < bestFoot) bestFoot = foot;
  }
  assert(bestFoot > 18 * TILE + 16, 'sin trepar no se sale del pozo (' + Math.round(bestFoot) + ')');

  releaseKeys();
  startLevel('boss');
  const zone = {
    x: level.terminal.x - 18,
    y: level.terminal.y - 16,
    w: level.terminal.w + 36,
    h: level.terminal.h + 28,
  };
  assert(!aabb(player, zone), 'no naces dentro de la terminal');
  player.y = 4 * TILE;
  player.invuln = 99999;
  let bossClip = false;
  for (let i = 0; i < 240; i++) {
    tickFrame();
    const b = level.boss;
    if (overlapsSolid(b.x, b.y, b.w, b.h)) bossClip = true;
  }
  assert(!bossClip, 'el jefe no atraviesa los pilares');

  releaseKeys();
  startLevel('cinta');
  player.invuln = 99999;
  let ghostClip = false;
  for (let i = 0; i < 90; i++) {
    tickFrame();
    for (const e of level.enemies) {
      if (e.kind !== 'ghost') continue;
      const x0 = Math.floor(e.x / TILE);
      const y0 = Math.floor(e.y / TILE);
      const x1 = Math.floor((e.x + e.w - 0.001) / TILE);
      const y1 = Math.floor((e.y + e.h - 0.001) / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (level.grid[ty] && level.grid[ty][tx]) ghostClip = true;
        }
      }
    }
  }
  assert(!ghostClip, 'el fantasma no entra en las plataformas');

  finishTest(!failed, logs.join('\n'));
}

function boot() {
  AudioBus.install();
  buildTitle();
  buildHud();
  bindInput();
  applyMute();
  applyJuice();
  fit();
  globalThis.addEventListener('resize', fit);
  globalThis.addEventListener('error', (e) => {
    let el = globalThis.document.querySelector('.crash');
    if (!el) {
      el = globalThis.document.createElement('pre');
      el.className = 'crash';
      globalThis.document.body.appendChild(el);
    }
    el.textContent = (e.message || 'error') + (e.error && e.error.stack ? '\n' + e.error.stack : '');
  });
  if (params.has('autotest')) {
    AudioBus.muted = true;
    try { runAutotest(); }
    catch (err) { finishTest(false, String(err && err.stack || err)); }
    return;
  }
  const play = params.get('play');
  if (play) startLevel(play);
  else setOverlay('title');
  draw();
  requestAnimationFrame(function loop(t) {
    loop.now = loop.now || t;
    const dt = t - loop.now;
    loop.acc = (loop.acc || 0) + Math.min(48, dt);
    loop.now = t;
    while (loop.acc >= 1000 / 60) {
      tickFrame();
      loop.acc -= 1000 / 60;
    }
    draw();
    requestAnimationFrame(loop);
  });
}

boot();
