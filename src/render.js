// Procedural Canvas 2D rendering. Draws the state; never mutates it.
import { W, H } from './world.js';
import { CHORE_TYPES, INTERACT_RANGE, choresDoneCount } from './chores.js';
import { QUEST_TEMPLATES, primaryQuest, questTarget } from './quests.js';
import { WIFE, sightDistance } from './wife.js';
import { clockMinutes, END_MESSAGES } from './game.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function text(c, s, x, y, size = 14, color = '#fff', align = 'left', weight = 'bold') {
  c.font = `${weight} ${size}px ${FONT}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(s, x, y);
}
const fmtClock = (mins) => {
  const h = Math.floor(mins / 60), m = Math.floor(mins % 60);
  const hh = h > 12 ? h - 12 : h;
  return `${hh}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

// Deterministic pseudo-random for static decoration.
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

function drawLawn(c, s) {
  c.fillStyle = '#5cae4b';
  c.fillRect(0, 0, W, H);
  for (let y = 100, i = 0; y < H; y += 30, i++) {
    c.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    c.fillRect(0, y, W, 30);
  }
  // curb / road
  const cb = s.world.curb;
  c.fillStyle = '#b9b7b0'; c.fillRect(cb.x, cb.y, cb.w, 6);
  c.fillStyle = '#55585e'; c.fillRect(cb.x, cb.y + 6, cb.w, cb.h - 6);
  c.fillStyle = '#e8d36a';
  for (let x = 20; x < W; x += 80) c.fillRect(x, cb.y + 18, 36, 3);
  // driveway
  c.fillStyle = '#a9a69d'; c.fillRect(780, 410, 180, 100);
  // path from door
  c.fillStyle = '#c9b78f';
  rr(c, 462, 150, 36, 90, 6); c.fill();
  // patio
  const p = s.world.patio;
  c.fillStyle = '#cfc6b4'; c.fillRect(p.x, p.y, p.w, p.h);
  c.strokeStyle = 'rgba(0,0,0,0.12)';
  for (let x = p.x; x <= p.x + p.w; x += 32) { c.beginPath(); c.moveTo(x, p.y); c.lineTo(x, p.y + p.h); c.stroke(); }
}

function drawHouse(c, s, t) {
  c.fillStyle = '#b5523b'; c.fillRect(0, 0, W, 78); // roof
  c.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 10; y < 78; y += 14) c.fillRect(0, y, W, 2);
  c.fillStyle = '#efe3c8'; c.fillRect(0, 78, W, 22); // wall
  c.fillStyle = '#8a3a29'; c.fillRect(0, 74, W, 5);
  // windows
  for (const x of [120, 280, 680, 840]) {
    c.fillStyle = '#7fb5d6'; c.fillRect(x - 22, 82, 44, 14);
    c.strokeStyle = '#fff'; c.strokeRect(x - 22, 82, 44, 14);
  }
  // door (rattles during warning)
  let off = 0;
  if (s.wife.phase === 'warning') off = Math.sin(t * 60) * 2;
  const open = s.wife.phase === 'out';
  c.fillStyle = open ? '#2b1d14' : '#6b4226';
  c.fillRect(462 + off, 62, 36, 38);
  if (!open) { c.fillStyle = '#e6c15a'; c.beginPath(); c.arc(490 + off, 82, 2.5, 0, 7); c.fill(); }
}

function drawFlowerBed(c, ch) {
  c.fillStyle = ch.done ? '#4a2f1d' : '#6a4529';
  rr(c, ch.x - 34, ch.y - 12, 68, 26, 8); c.fill();
  const cols = ['#ff6b8b', '#ffd23f', '#c78bff', '#ff9a3c'];
  for (let i = 0; i < 8; i++) {
    const fx = ch.x - 28 + i * 8, fy = ch.y - 3 + (i % 2) * 8;
    c.strokeStyle = '#2f7a2f'; c.beginPath(); c.moveTo(fx, fy + 4); c.lineTo(fx, fy); c.stroke();
    c.fillStyle = ch.done || ch.progress > 0 ? cols[i % 4] : '#a58a6a'; // wilted until watered
    c.beginPath(); c.arc(fx, fy - 1, ch.done ? 3.5 : 2.5, 0, 7); c.fill();
  }
  if (ch.done) { c.fillStyle = 'rgba(120,200,255,0.8)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(ch.x - 14 + i * 14, ch.y + 2, 1.6, 0, 7); c.fill(); } }
}
function drawLeafPile(c, ch) {
  if (ch.done) { c.fillStyle = 'rgba(0,0,0,0.06)'; c.beginPath(); c.ellipse(ch.x, ch.y, 18, 8, 0, 0, 7); c.fill(); return; }
  const k = 1 - ch.progress / ch.work * 0.6;
  const cols = ['#d9792b', '#c4561f', '#e8a23a', '#a8451a'];
  for (let i = 0; i < 16; i++) {
    c.fillStyle = cols[i % 4];
    c.beginPath(); c.arc(ch.x + (hash(i + ch.id) - 0.5) * 36 * k, ch.y + (hash(i * 3 + ch.id) - 0.5) * 22 * k, 6 * k + 1, 0, 7); c.fill();
  }
}
function drawBush(c, ch) {
  const f = ch.done ? 1 : 0;
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(ch.x, ch.y + 14, 26, 7, 0, 0, 7); c.fill();
  c.fillStyle = f ? '#2f8a3a' : '#2c7a35';
  if (f) { rr(c, ch.x - 22, ch.y - 16, 44, 32, 10); c.fill(); c.fillStyle = '#3aa24a'; rr(c, ch.x - 18, ch.y - 14, 36, 8, 4); c.fill(); }
  else {
    for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(ch.x + (hash(i + ch.id * 7) - 0.5) * 44, ch.y + (hash(i * 5 + ch.id) - 0.5) * 30, 11 - ch.progress / ch.work * 4, 0, 7); c.fill(); }
  }
}
function drawLawnPatch(c, ch) {
  if (ch.done) { c.fillStyle = 'rgba(160,230,120,0.35)'; rr(c, ch.x - 36, ch.y - 24, 72, 48, 14); c.fill(); return; }
  const k = 1 - ch.progress / ch.work * 0.6;
  c.fillStyle = '#3f8a35'; rr(c, ch.x - 36, ch.y - 24, 72, 48, 14); c.fill();
  c.strokeStyle = '#2d6e2a'; c.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) {
    const gx = ch.x - 32 + hash(i + ch.id) * 64, gy = ch.y - 18 + hash(i * 2 + ch.id) * 40;
    c.beginPath(); c.moveTo(gx, gy + 4); c.lineTo(gx + (hash(i) - 0.5) * 4, gy - 10 * k); c.stroke();
  }
  c.lineWidth = 1;
}

function drawChore(c, ch, t) {
  if (ch.type === 'water') drawFlowerBed(c, ch);
  else if (ch.type === 'rake') drawLeafPile(c, ch);
  else if (ch.type === 'trim') drawBush(c, ch);
  else drawLawnPatch(c, ch);
  if (ch.done) {
    text(c, '✓', ch.x, ch.y - 30, 16, '#fff');
  } else if (ch.progress > 0) {
    const frac = ch.progress / ch.work;
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.beginPath(); c.arc(ch.x, ch.y - 34, 10, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#ffd23f';
    c.beginPath(); c.arc(ch.x, ch.y - 34, 10, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); c.stroke();
    c.lineWidth = 1;
  }
}

function drawObstacle(c, o, s) {
  c.fillStyle = 'rgba(0,0,0,0.18)';
  if (o.kind === 'house') return;
  if (o.kind === 'shed') {
    c.fillRect(o.x + 6, o.y + o.h - 2, o.w, 8);
    c.fillStyle = '#9b6b43'; c.fillRect(o.x, o.y + 18, o.w, o.h - 18);
    c.fillStyle = '#6e7a86'; c.fillRect(o.x - 4, o.y, o.w + 8, 26);
    c.fillStyle = '#4a3320'; c.fillRect(o.x + o.w / 2 - 14, o.y + o.h - 38, 28, 38);
    c.fillStyle = 'rgba(0,0,0,0.15)';
    for (let x = o.x; x < o.x + o.w; x += 10) c.fillRect(x, o.y + 18, 1, o.h - 18);
  } else if (o.kind === 'hedge') {
    c.fillRect(o.x + 3, o.y + o.h - 3, o.w, 7);
    c.fillStyle = '#256b2f'; rr(c, o.x, o.y, o.w, o.h, 10); c.fill();
    c.fillStyle = '#318a3d';
    for (let i = 0; i < (o.w * o.h) / 90; i++) { c.beginPath(); c.arc(o.x + 5 + hash(i + o.x) * (o.w - 10), o.y + 5 + hash(i * 3 + o.y) * (o.h - 10), 4, 0, 7); c.fill(); }
  } else if (o.kind === 'tree') {
    c.fillStyle = '#6b4226'; c.fillRect(o.x + 6, o.y, 18, o.h);
  } else if (o.kind === 'car') {
    c.fillRect(o.x + 4, o.y + o.h - 4, o.w, 8);
    c.fillStyle = '#c0392b'; rr(c, o.x, o.y, o.w, o.h, 12); c.fill();
    c.fillStyle = '#8fc3e0'; rr(c, o.x + 22, o.y + 8, 30, o.h - 16, 4); c.fill(); rr(c, o.x + 78, o.y + 8, 22, o.h - 16, 4); c.fill();
    c.fillStyle = '#222'; for (const [wx, wy] of [[14, -3], [86, -3], [14, o.h - 5], [86, o.h - 5]]) c.fillRect(o.x + wx, o.y + wy, 20, 8);
  } else if (o.kind === 'bench') {
    c.fillRect(o.x + 2, o.y + o.h - 2, o.w, 6);
    c.fillStyle = '#8b5a2b'; rr(c, o.x, o.y, o.w, o.h, 4); c.fill();
    c.fillStyle = '#a8713a'; for (let i = 0; i < 3; i++) c.fillRect(o.x + 3, o.y + 3 + i * 7, o.w - 6, 4);
  }
}
function drawTreeCanopy(c, s) {
  const t = s.world.decor.treeCanopy;
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(t.x + 8, t.y + 30, t.r, t.r * 0.5, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(38,120,48,0.92)';
  for (const [dx, dy, r] of [[0, 0, t.r], [-24, 12, 28], [24, 10, 30], [0, -24, 28]]) { c.beginPath(); c.arc(t.x + dx, t.y + dy - 20, r, 0, 7); c.fill(); }
  // the cat
  if (s.quests.some((q) => q.templateId === 'cat' && q.stage === 'fetch')) {
    c.fillStyle = '#e0a458'; c.beginPath(); c.arc(t.x + 18, t.y - 6, 7, 0, 7); c.fill();
    c.beginPath(); c.moveTo(t.x + 13, t.y - 11); c.lineTo(t.x + 15, t.y - 18); c.lineTo(t.x + 18, t.y - 12); c.fill();
    c.beginPath(); c.moveTo(t.x + 20, t.y - 12); c.lineTo(t.x + 23, t.y - 18); c.lineTo(t.x + 24, t.y - 10); c.fill();
  }
}
function drawDecor(c, s) {
  const m = s.world.decor.mailbox;
  c.fillStyle = '#555'; c.fillRect(m.x - 2, m.y, 4, 16);
  c.fillStyle = '#2a5db0'; rr(c, m.x - 12, m.y - 10, 24, 14, 5); c.fill();
  c.fillStyle = '#e63946'; c.fillRect(m.x + 10, m.y - 16, 3, 10);
  const b = s.world.decor.bins;
  const out = s.quests.some((q) => q.templateId === 'bins' && q.stage === 'deliver');
  if (!out) for (const [dx, col] of [[-16, '#3b6e8f'], [8, '#3d7a4a']]) {
    c.fillStyle = col; rr(c, b.x + dx, b.y, 20, 26, 3); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(b.x + dx - 1, b.y, 22, 4);
  }
}

function drawPerson(c, x, y, shirt, hair, facing, moving, t, skirt) {
  const bob = moving ? Math.sin(t * 14) * 1.5 : 0;
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(x, y + 12, 9, 4, 0, 0, 7); c.fill();
  c.fillStyle = skirt ? '#7a5aa6' : '#2f4b7c';
  const step = moving ? Math.sin(t * 14) * 3 : 0;
  if (skirt) { c.beginPath(); c.moveTo(x - 7, y); c.lineTo(x + 7, y); c.lineTo(x + 10, y + 11); c.lineTo(x - 10, y + 11); c.fill(); }
  else { c.fillRect(x - 5, y + 2, 4, 10 + step); c.fillRect(x + 1, y + 2, 4, 10 - step); }
  c.fillStyle = shirt; rr(c, x - 7, y - 9 + bob, 14, 14, 4); c.fill();
  c.fillStyle = '#f2c9a0'; c.beginPath(); c.arc(x, y - 14 + bob, 6.5, 0, 7); c.fill();
  c.fillStyle = hair; c.beginPath(); c.arc(x, y - 16 + bob, 6.8, Math.PI, 0); c.fill();
  if (skirt) { c.fillRect(x - 7, y - 16 + bob, 3, 12); c.fillRect(x + 4, y - 16 + bob, 3, 12); }
  c.fillStyle = '#222'; c.fillRect(x + facing * 2 - 1, y - 14 + bob, 1.5, 2); c.fillRect(x + facing * 2 + 3, y - 14 + bob, 1.5, 2);
}

function drawWife(c, s, t) {
  const w = s.wife;
  if (w.phase === 'out') {
    if (s.flags.showVisionCone) {
      const a0 = w.dir - WIFE.fov / 2, a1 = w.dir + WIFE.fov / 2;
      const g = c.createRadialGradient(w.x, w.y, 10, w.x, w.y, WIFE.range);
      g.addColorStop(0, w.spotted ? 'rgba(255,80,60,0.38)' : 'rgba(255,240,120,0.32)');
      g.addColorStop(1, w.spotted ? 'rgba(255,80,60,0.05)' : 'rgba(255,240,120,0.04)');
      c.fillStyle = g;
      // Cone clipped by sight blockers (same rule as canSee), so hiding spots look hidden.
      const RAYS = 48;
      c.beginPath(); c.moveTo(w.x, w.y);
      for (let i = 0; i <= RAYS; i++) {
        const a = a0 + ((a1 - a0) * i) / RAYS, d = sightDistance(w, a, s.world.obstacles);
        c.lineTo(w.x + Math.cos(a) * d, w.y + Math.sin(a) * d);
      }
      c.closePath(); c.fill();
    }
    drawPerson(c, w.x, w.y, '#e86a9a', '#5a3825', 1, false, t, true);
  } else if (w.phase === 'warning') {
    const blink = Math.floor(t * 6) % 2 === 0;
    // y=50 keeps the badge below the 34 px HUD bar (it was half hidden at y=40).
    if (blink) { c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(480, 50, 14, 0, 7); c.fill(); text(c, '!', 480, 51, 22, '#7a1f1f', 'center'); }
  }
}

function drawBubble(c, wife) {
  if (!wife.bubble) return;
  c.font = `bold 14px ${FONT}`;
  const lines = wrap(c, wife.bubble.text, 260);
  const bw = Math.max(...lines.map((l) => c.measureText(l).width)) + 24, bh = lines.length * 18 + 16;
  const bx = Math.min(W - bw - 8, Math.max(8, wife.x + 20)), by = wife.y - 30 + 12;
  c.fillStyle = '#fff'; c.strokeStyle = '#333'; c.lineWidth = 2;
  rr(c, bx, by, bw, bh, 10); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(bx + 8, by); c.lineTo(wife.x + 6, wife.y - 8); c.lineTo(bx + 22, by); c.fillStyle = '#fff'; c.fill();
  c.lineWidth = 1;
  lines.forEach((l, i) => text(c, l, bx + 12, by + 17 + i * 18, 14, '#222'));
}
function wrap(c, str, maxW) {
  const words = str.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (c.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawQuestMarkers(c, s, t) {
  const pulse = 1 + Math.sin(t * 5) * 0.15;
  const mark = (x, y, label, color) => {
    c.strokeStyle = color; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, 16 * pulse, 0, 7); c.stroke();
    c.lineWidth = 1;
    text(c, label, x, y - 28, 12, '#fff', 'center');
  };
  for (const q of s.quests) {
    const tg = questTarget(q);
    mark(tg.x, tg.y, q.stage === 'fetch' ? `${tg.label}` : `Deliver: ${tg.label}`, q.stage === 'fetch' ? '#4fc3f7' : '#ffd23f');
  }
}

function drawArrow(c, s, t) {
  const q = primaryQuest(s);
  if (!q) return;
  const tg = questTarget(q), p = s.player;
  const d = Math.hypot(tg.x - p.x, tg.y - p.y);
  if (d < 60) return;
  const a = Math.atan2(tg.y - p.y, tg.x - p.x), r = 34 + Math.sin(t * 6) * 2;
  c.save();
  c.translate(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
  c.rotate(a);
  c.fillStyle = '#ffd23f'; c.strokeStyle = '#7a5a00';
  c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -8); c.lineTo(-3, 0); c.lineTo(-6, 8); c.closePath(); c.fill(); c.stroke();
  c.restore();
}

function drawHUD(c, s) {
  c.fillStyle = 'rgba(15,20,25,0.78)'; c.fillRect(0, 0, W, 34);
  text(c, fmtClock(clockMinutes(s)), 14, 17, 18, '#ffe9a8');
  // sun progress
  const f = Math.min(1, s.time / s.dayLength);
  c.fillStyle = '#334'; rr(c, 120, 12, 120, 10, 5); c.fill();
  c.fillStyle = '#f5a623'; rr(c, 120, 12, Math.max(6, 120 * f), 10, 5); c.fill();
  // harmony
  text(c, 'Harmony', 270, 17, 13, '#ddd');
  const hf = s.harmony / 100;
  c.fillStyle = '#334'; rr(c, 335, 10, 150, 14, 7); c.fill();
  c.fillStyle = hf > 0.5 ? '#5ed26a' : hf > 0.25 ? '#f0c040' : '#ee5555';
  rr(c, 335, 10, Math.max(8, 150 * hf), 14, 7); c.fill();
  // Dark digits only when the fill reaches the centre of the bar; otherwise they sit on the dark track.
  text(c, String(Math.round(s.harmony)), 410, 17, 11, hf >= 0.55 ? '#112' : '#fff', 'center');
  text(c, `Chores ${choresDoneCount(s.chores)}/${s.chores.length}`, 510, 17, 15, '#fff');
  if (s.carry != null) {
    const q = s.quests.find((x) => x.id === s.carry);
    text(c, `Carrying: ${q ? q.title : '?'}`, 640, 17, 13, '#4fc3f7');
  }
  // quest list
  if (s.quests.length) {
    const h = 24 + s.quests.length * 20;
    c.fillStyle = 'rgba(15,20,25,0.72)'; rr(c, W - 236, 42, 228, h, 8); c.fill();
    text(c, 'Side quests', W - 224, 56, 12, '#aab');
    s.quests.forEach((q, i) => {
      const y = 76 + i * 20, low = q.timeLeft < 10;
      text(c, `${q.title} (${q.stage === 'fetch' ? 'fetch' : 'deliver'})`, W - 224, y, 13, '#fff');
      text(c, `${Math.ceil(q.timeLeft)}s`, W - 18, y, 13, low ? '#ff7070' : '#ffe9a8', 'right');
    });
  }
}

function overlay(c, alpha = 0.6) { c.fillStyle = `rgba(10,14,20,${alpha})`; c.fillRect(0, 0, W, H); }

function drawTitle(c, s, t) {
  overlay(c, 0.72);
  text(c, 'SIDE QUEST', W / 2, 150, 64, '#ffd23f', 'center');
  text(c, 'Finish the garden before sunset. Your wife has other plans.', W / 2, 205, 18, '#fff', 'center', 'normal');
  const lines = [
    'WASD / arrows: walk     Hold Space or E: work, pick up, deliver',
    'Chores: rake leaves, trim bushes, mow long grass, water flowers',
    'Stay out of her line of sight (hedges and the shed block it) to dodge errands.',
    'Keep Harmony up: finished errands help, missed ones hurt. P / Esc pauses.',
  ];
  lines.forEach((l, i) => text(c, l, W / 2, 275 + i * 26, 15, '#cde', 'center', 'normal'));
  if (Math.floor(t * 2) % 2 === 0) text(c, 'Press Space or Enter to start', W / 2, 430, 22, '#ffd23f', 'center');
  text(c, `mode: ${s.flags.wifeMode}  difficulty: ${s.flags.difficulty}`, W / 2, 480, 13, '#8a9', 'center', 'normal');
}
function drawPause(c) {
  overlay(c, 0.55);
  text(c, 'PAUSED', W / 2, H / 2 - 10, 54, '#fff', 'center');
  text(c, 'Press P or Esc to resume', W / 2, H / 2 + 40, 18, '#cde', 'center', 'normal');
}
function drawEnd(c, s) {
  overlay(c, 0.72);
  const won = s.phase === 'won';
  text(c, won ? 'DAY COMPLETE!' : s.endReason === 'harmony' ? 'HARMONY LOST' : 'SUNSET', W / 2, 120, 52, won ? '#7fe08a' : '#ff8a6a', 'center');
  text(c, END_MESSAGES[s.endReason], W / 2, 175, 24, '#fff', 'center');
  const st = s.stats;
  const rows = [
    ['Chores done', `${choresDoneCount(s.chores)} / ${s.chores.length}`],
    ['Quests completed', st.questsCompleted],
    ['Quests failed', st.questsFailed],
    ['Quests avoided', st.questsAvoided],
    ['Harmony', Math.round(s.harmony)],
    ['Score', s.score],
  ];
  rows.forEach(([k, v], i) => {
    const y = 235 + i * 32;
    text(c, k, W / 2 - 130, y, 20, i === 5 ? '#ffd23f' : '#cde', 'left', i === 5 ? 'bold' : 'normal');
    text(c, String(v), W / 2 + 130, y, 20, i === 5 ? '#ffd23f' : '#fff', 'right');
  });
  text(c, 'Press R to play again', W / 2, 468, 22, '#ffd23f', 'center');
}

function drawDebug(c, s, info) {
  c.strokeStyle = 'rgba(255,0,255,0.9)';
  for (const o of s.world.obstacles) c.strokeRect(o.x, o.y, o.w, o.h);
  c.strokeStyle = 'rgba(0,255,255,0.8)';
  const p = s.player;
  c.strokeRect(p.x - 8, p.y - 8, 16, 16);
  c.beginPath(); c.arc(p.x, p.y, INTERACT_RANGE, 0, 7); c.stroke();
  for (const ch of s.chores) { c.beginPath(); c.arc(ch.x, ch.y, 3, 0, 7); c.stroke(); }
  const lines = [
    `fps ${info.fps.toFixed(0)}  phase ${s.phase}  t ${s.time.toFixed(1)}/${s.dayLength}  seed ${s.seed}`,
    `wife ${s.wife.phase} timer ${s.wife.timer.toFixed(1)} dir ${(s.wife.dir * 57.3).toFixed(0)}deg spotted ${s.wife.spotted}`,
    `player ${p.x.toFixed(0)},${p.y.toFixed(0)} carry ${s.carry} quests ${s.quests.length}  harmony ${s.harmony.toFixed(1)}`,
  ];
  c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(0, H - 56, 620, 56);
  lines.forEach((l, i) => text(c, l, 8, H - 44 + i * 16, 12, '#0f0', 'left', 'normal'));
}

export function render(c, s, info = { fps: 60, time: 0 }) {
  const t = info.time;
  c.clearRect(0, 0, W, H);
  drawLawn(c, s);
  drawHouse(c, s, t);
  drawDecor(c, s);
  for (const ch of s.chores) drawChore(c, ch, t);
  for (const o of s.world.obstacles) drawObstacle(c, o, s);
  if (s.phase !== 'title') drawQuestMarkers(c, s, t);
  drawWife(c, s, t);
  const p = s.player;
  drawPerson(c, p.x, p.y, '#f28c28', '#3a2a1a', p.facing, p.moving, t, false);
  if (s.carry != null) { c.fillStyle = '#4fc3f7'; c.strokeStyle = '#fff'; c.fillRect(p.x - 5, p.y - 36, 10, 10); c.strokeRect(p.x - 5, p.y - 36, 10, 10); }
  drawTreeCanopy(c, s);
  if (s.phase === 'playing' || s.phase === 'paused') drawArrow(c, s, t);
  drawBubble(c, s.wife);
  if (s.phase !== 'title') drawHUD(c, s);
  if (s.flags.debug) drawDebug(c, s, info);
  if (s.phase === 'title') drawTitle(c, s, t);
  else if (s.phase === 'paused') drawPause(c);
  else if (s.phase === 'won' || s.phase === 'lost') drawEnd(c, s);
}
