// Canvas 2D top-down view (V-1, T-5, A-1; browser only): the train in metres, the attendant, passengers, the landscape
// outside, platforms and the train strip. Procedural, no image files. DPR-aware (capped at 2). The renderer only reads
// the game state; its own state is the camera, the landscape scroll and a few fades.
import { CFG } from './config.js';
import { carAt, rowAt } from './train.js';
import { needActions } from './passengers.js';
import { questActions } from './quests.js';

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const NEED_ICON = { ticket: '🎫', coffee: '☕', snack: '🥪', question: '❓', seat: '💺' };
const ROLE_ICON = { rescue: '🚨', connection: '🔁', nervous: '😰', lost: '🧳', sick: '🤒' };
const ITEM_ICON = { coffee: '☕', snack: '🥪', water: '💧', kit: '🩹', bag: '🧳' };
const BODY_HALF = 2.25, FLOOR_HALF = 2.0, V_MAX = 16, SEAT_Y = [1.6, 0.9];
const CLOTHES = ['#3f6fa5', '#a5533f', '#6a8f4e', '#8a5ea5', '#b08a3a', '#4d8f8f', '#a5497a', '#6b6f78'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// A small integer hash -> 0..1, for landscape objects that stay put as the train moves.
function rnd(i, k) {
  let x = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(k | 0, 0x165667b1);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
export const stressColor = (s, l = 52) => `hsl(${Math.max(0, 120 - clamp(s, 0, 100) * 1.2).toFixed(0)} 72% ${l}%)`;

export function createRenderer(canvas, strip) {
  const ctx = canvas.getContext('2d'), sctx = strip.getContext('2d');
  let W = 0, H = 0, SW = 0, SH = 0, dpr = 1;
  const cam = { x: 0, init: false };
  const fx = { scroll: 0, vel: 0, platform: 0, broken: 0, seed: 1 };
  let time = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    SW = strip.clientWidth; SH = strip.clientHeight;
    strip.width = Math.max(1, Math.round(SW * dpr)); strip.height = Math.max(1, Math.round(SH * dpr));
    return { w: W, h: H };
  }
  function clear() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  function reset(s) {
    cam.init = false; fx.scroll = 0; fx.vel = 0; fx.seed = s ? s.seed : 1;
    fx.platform = s && s.route.phase === 'dwell' ? 1 : 0; fx.broken = 0;
  }

  // ---- layout: metres -> pixels
  let ppm = 30, cy = 0;
  const sx = (x) => W / 2 + (x - cam.x) * ppm;
  const sy = (y) => cy + y * ppm;
  const font = (px, bold) => `${bold ? '700 ' : ''}${Math.round(px)}px ${EMOJI}`;
  function emoji(ch, x, y, m) { // centred emoji of `m` metres
    ctx.font = font(m * ppm); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
    ctx.fillText(ch, sx(x), sy(y) + m * ppm * 0.05);
  }
  function rect(x0, y0, x1, y1, fill, r = 0) {
    ctx.fillStyle = fill; ctx.beginPath();
    if (r && ctx.roundRect) ctx.roundRect(sx(x0), sy(y0), (x1 - x0) * ppm, (y1 - y0) * ppm, r * ppm); else ctx.rect(sx(x0), sy(y0), (x1 - x0) * ppm, (y1 - y0) * ppm);
    ctx.fill();
  }
  function disc(x, y, r, fill, stroke, lw = 0.05) {
    ctx.beginPath(); ctx.arc(sx(x), sy(y), r * ppm, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw * ppm; ctx.stroke(); }
  }

  // ---- landscape (T-5)
  const hash = (i, k) => rnd(i, k * 131 + fx.seed);
  // Objects of one layer: every `cell` metres one candidate; fn(i, gx) draws it. gx is in train metres.
  function layer(f, cell, fn) {
    const half = W / ppm / 2 + 6, lo = cam.x - half, hi = cam.x + half, off = fx.scroll * f;
    for (let i = Math.floor((lo + off) / cell); i <= Math.ceil((hi + off) / cell); i++) fn(i, i * cell - off);
  }
  function landscape() {
    ctx.fillStyle = '#35603f'; ctx.fillRect(0, 0, W, H);
    // far fields: patches of a few greens and plough lines, slow parallax
    for (const side of [-1, 1]) {
      layer(0.4, 18, (i, gx) => {
        const w = 10 + hash(i, 1) * 14, shade = hash(i, 2);
        const y0 = side * 3.5, y1 = side * (14 + hash(i, 3) * 4);
        rect(gx, Math.min(y0, y1), gx + w, Math.max(y0, y1), shade < 0.34 ? '#3d6a45' : shade < 0.67 ? '#4a7a4c' : '#5c7f46');
        if (shade > 0.67) { ctx.strokeStyle = 'rgba(40,70,35,.45)'; ctx.lineWidth = 1; for (let k = 0; k < w; k += 1.5) { ctx.beginPath(); ctx.moveTo(sx(gx + k), sy(y0)); ctx.lineTo(sx(gx + k), sy(y1)); ctx.stroke(); } }
        if (hash(i, 4) > 0.8) { // a small house
          const hy = side * (6.5 + hash(i, 5) * 3), hx = gx + 2 + hash(i, 6) * 5;
          rect(hx, hy - 0.9, hx + 2.2, hy + 0.9, '#b9a58c'); rect(hx - 0.1, hy - 0.5, hx + 2.3, hy + 0.5, '#8d4b3b');
        }
      });
    }
    // trees and bushes, medium parallax
    for (const side of [-1, 1]) {
      layer(0.7, 4.5, (i, gx) => {
        if (hash(i, 7 + side) < 0.45) return;
        const y = side * (4.6 + hash(i, 8) * 5), r = 0.5 + hash(i, 9) * 0.8;
        disc(gx, y + side * 0.12, r, 'rgba(0,0,0,.18)');
        disc(gx, y, r, hash(i, 10) > 0.5 ? '#2f5f35' : '#3b7a3f');
        disc(gx - r * 0.25, y - r * 0.25, r * 0.5, 'rgba(255,255,255,.08)');
      });
    }
    // gravel next to the train and fence posts, full speed
    rect(cam.x - W / ppm, -3.3, cam.x + W / ppm, -BODY_HALF + 0.05, '#6f6b66'); rect(cam.x - W / ppm, BODY_HALF - 0.05, cam.x + W / ppm, 3.3, '#6f6b66');
    for (const side of [-1, 1]) {
      ctx.strokeStyle = 'rgba(30,30,30,.55)'; ctx.lineWidth = Math.max(1, 0.05 * ppm);
      ctx.beginPath(); ctx.moveTo(0, sy(side * 3.5)); ctx.lineTo(W, sy(side * 3.5)); ctx.stroke();
      layer(1, 4, (i, gx) => { disc(gx, side * 3.5, 0.11, '#4a3a2a'); });
    }
    // masts
    layer(1, 24, (i, gx) => { rect(gx - 0.15, -3.9, gx + 0.15, -3.5, '#555'); disc(gx, -3.7, 0.22, '#777', '#444'); });
  }

  function platform(s, alpha) {
    if (alpha <= 0.01) return;
    ctx.save(); ctx.globalAlpha = alpha;
    const x0 = -6, x1 = s.train.length + 6, name = s.route.stations[s.route.at];
    rect(x0, BODY_HALF + 0.35, x1, BODY_HALF + 4.6, '#b8b2a4');
    rect(x0, BODY_HALF + 0.35, x1, BODY_HALF + 0.62, '#e6c13a'); // the yellow edge
    for (let x = x0; x < x1; x += 2) rect(x, BODY_HALF + 0.62, x + 0.04, BODY_HALF + 4.6, 'rgba(0,0,0,.08)');
    for (let x = 3; x < x1; x += 16) { // station signs
      rect(x - 0.08, BODY_HALF + 1.2, x + 0.08, BODY_HALF + 2.3, '#444');
      rect(x - 3, BODY_HALF + 1.0, x + 3, BODY_HALF + 2.0, '#1f4e79', 0.15);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(clamp(0.62 * ppm, 12, 30))}px system-ui, sans-serif`;
      ctx.fillText(name, sx(x), sy(BODY_HALF + 1.5), 5.8 * ppm);
    }
    for (let x = 9; x < x1; x += 16) { rect(x - 1, BODY_HALF + 3.4, x + 1, BODY_HALF + 4.0, '#7a5b3a', 0.1); } // benches
    for (let x = 0; x < x1; x += 7.3) { const q = Math.floor(x); if (hash(q, 21) > 0.5) disc(x + hash(q, 22) * 3, BODY_HALF + 2.8 + hash(q, 23), 0.28, CLOTHES[q % CLOTHES.length]); }
    ctx.restore();
  }

  function brokenTrain(s, k) {
    if (k <= 0.01) return;
    const yOff = (1 - k) * -3, y0 = -7.4 + yOff, y1 = -3.0 + yOff;
    const lo = cam.x - W / ppm, hi = cam.x + W / ppm;
    rect(lo, y0, hi, y1, '#7d3a3a', 0.2); rect(lo, y0 + 0.25, hi, y1 - 0.25, '#5d2a2a');
    for (let x = Math.floor(lo); x < hi; x += 1.5) rect(x, y1 - 0.2, x + 0.8, y1 - 0.02, '#a9c4d6');
    for (let x = Math.floor(lo / 7) * 7; x < hi; x += 7) {
      const on = Math.sin(time * 6 + x) > 0;
      disc(x, (y0 + y1) / 2, 0.22, on ? '#ffb000' : '#6a4a10');
      if (on) disc(x, (y0 + y1) / 2, 0.55, 'rgba(255,176,0,.25)');
    }
    for (let i = 0; i < 5; i++) { const t = (time * 0.4 + i / 5) % 1; disc(cam.x + 3 + t * 2, y1 - 0.4 - t * 2.2, 0.4 + t * 0.7, `rgba(210,210,210,${(0.4 * (1 - t)).toFixed(2)})`); }
  }

  // ---- the train
  function door(bx, ax) { // gangway between two cars at bx; the doors slide open when the attendant is close
    rect(bx - 0.28, -1.15, bx + 0.28, 1.15, '#2f343a'); // the bellows
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    for (const o of [-0.2, 0, 0.2]) { ctx.beginPath(); ctx.moveTo(sx(bx + o), sy(-1.15)); ctx.lineTo(sx(bx + o), sy(1.15)); ctx.stroke(); }
    const open = clamp(1.6 - Math.abs(ax - bx), 0, 1) * 0.5;
    rect(bx - 0.07, -1.0, bx + 0.07, -0.5 - open, '#9aa5ad'); rect(bx - 0.07, 0.5 + open, bx + 0.07, 1.0, '#9aa5ad');
  }

  function car(c, s) {
    const x0 = c.start, x1 = c.end, cafe = c.kind === 'cafe';
    rect(x0 + 0.03, -BODY_HALF, x1 - 0.03, BODY_HALF, cafe ? '#8a5a2e' : '#40678d', 0.25);
    for (let x = x0 + 1; x < x1 - 1; x += 2) rect(x + 0.4, -BODY_HALF, x + 1.4, -BODY_HALF + 0.14, '#bfe0f2'), rect(x + 0.4, BODY_HALF - 0.14, x + 1.4, BODY_HALF, '#bfe0f2');
    rect(x0 + 0.15, -FLOOR_HALF, x1 - 0.15, FLOOR_HALF, '#cdc6b8', 0.12);
    rect(x0 + 0.15, -0.5, x1 - 0.15, 0.5, '#8197b0'); // aisle carpet
    rect(x0 + 0.15, -FLOOR_HALF, x0 + CFG.train.vestibule, FLOOR_HALF, 'rgba(120,130,140,.45)'); // vestibules
    rect(x1 - CFG.train.vestibule, -FLOOR_HALF, x1 - 0.15, FLOOR_HALF, 'rgba(120,130,140,.45)');
    if (cafe) cafeCounter(s);
  }

  function cafeCounter(s) {
    const cx = s.train.counterX, near = Math.abs(s.attendant.x - cx) <= CFG.attendant.reach;
    rect(cx - 2.6, 0.75, cx + 2.6, FLOOR_HALF, '#5b3a1e', 0.12); rect(cx - 2.5, 0.85, cx + 2.5, 1.5, '#c99b64', 0.08);
    rect(cx - 1.9, 1.5, cx - 1.1, 1.95, '#2d2d33', 0.06); disc(cx - 1.5, 1.7, 0.12, '#e84a3a');
    for (const [i, e] of ['☕', '🥪', '💧'].entries()) emoji(e, cx + 0.2 + i * 0.85, 1.15, 0.6);
    for (const x of [cx - 3.5, cx + 3.5]) { disc(x, -1.25, 0.45, '#8c6a43'); disc(x, -1.25, 0.32, '#a78558'); }
    if (near) { ctx.strokeStyle = `rgba(255,200,87,${0.6 + 0.3 * Math.sin(time * 6)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(sx(cx - 2.6), sy(0.75), 5.2 * ppm, 1.25 * ppm, 8); ctx.stroke(); }
  }

  function cab(s) {
    const c = s.train.cab, x0 = c.start, x1 = c.end;
    ctx.fillStyle = '#34536f'; ctx.beginPath();
    ctx.moveTo(sx(x0 + 0.03), sy(-BODY_HALF)); ctx.lineTo(sx(x1 - 1.6), sy(-BODY_HALF));
    ctx.quadraticCurveTo(sx(x1 + 0.1), sy(-BODY_HALF + 0.2), sx(x1), sy(-0.9));
    ctx.lineTo(sx(x1), sy(0.9)); ctx.quadraticCurveTo(sx(x1 + 0.1), sy(BODY_HALF - 0.2), sx(x1 - 1.6), sy(BODY_HALF));
    ctx.lineTo(sx(x0 + 0.03), sy(BODY_HALF)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9fb4c4'; ctx.beginPath();
    ctx.moveTo(sx(x0 + 0.2), sy(-FLOOR_HALF)); ctx.lineTo(sx(x1 - 1.6), sy(-FLOOR_HALF));
    ctx.quadraticCurveTo(sx(x1 - 0.2), sy(-FLOOR_HALF + 0.2), sx(x1 - 0.2), sy(-0.8));
    ctx.lineTo(sx(x1 - 0.2), sy(0.8)); ctx.quadraticCurveTo(sx(x1 - 0.2), sy(FLOOR_HALF - 0.2), sx(x1 - 1.6), sy(FLOOR_HALF));
    ctx.lineTo(sx(x0 + 0.2), sy(FLOOR_HALF)); ctx.closePath(); ctx.fill();
    rect(x1 - 0.55, -1.2, x1 - 0.25, 1.2, '#1a2836', 0.1); // the windscreen
    // console
    const qs = s.quests.active.filter((q) => (q.type === 'connection' && q.stage === 'radio') || (q.type === 'sick' && q.stage === 'fetch'));
    rect(x1 - 1.5, -1.3, x1 - 0.85, 1.3, '#2a3744', 0.1);
    for (let k = 0; k < 6; k++) disc(x1 - 1.35 + (k % 2) * 0.3, -0.95 + k * 0.38, 0.09, ['#e84a3a', '#5ed39a', '#ffc857'][k % 3]);
    rect(x1 - 1.9, -0.4, x1 - 1.6, 0.4, '#556', 0.05); // driver seat
    if (qs.length) {
      const q = qs[0], p = 0.5 + 0.5 * Math.sin(time * 6);
      disc(c.x, 0, 1.1 + 0.15 * p, `rgba(255,200,87,${(0.15 + 0.15 * p).toFixed(2)})`, 'rgba(255,200,87,.85)', 0.06);
      emoji(q.type === 'sick' ? '🩹' : '📻', c.x, -1.3, 0.85);
    }
  }

  function seats(s, target) {
    const row = target && target.rowId !== undefined ? target.rowId : -1;
    for (const r of s.train.rows) {
      if (r.id === row) rect(r.x - 1, -FLOOR_HALF, r.x + 1, FLOOR_HALF, `rgba(255,200,87,${(0.14 + 0.08 * Math.sin(time * 6)).toFixed(2)})`);
    }
    for (const st of s.train.seats) {
      const y = (st.side === 'L' ? -1 : 1) * SEAT_Y[st.slot], free = s.seatOwner[st.id] === null;
      rect(st.x - 0.42, y - 0.36, st.x + 0.38, y + 0.36, free ? '#5d4a7a' : '#4b3c63', 0.1);
      rect(st.x - 0.5, y - 0.38, st.x - 0.3, y + 0.38, '#3d3059', 0.08);
    }
  }

  // ---- passengers and the attendant
  const pos = (s, p) => {
    if (p.seat !== null && !p.following) { const st = s.train.seats[p.seat]; return { x: st.x, y: (st.side === 'L' ? -1 : 1) * SEAT_Y[st.slot], seated: st }; }
    if (p.following) return { x: p.x, y: 0.12 * (p.id % 3 - 1) };
    return { x: p.x, y: ((p.id * 7 + (p.spot || 0)) % 5 - 2) * 0.17 };
  };

  function person(x, y, stress, id, bob = 0, mood = true) {
    const r = 0.31, py = y + bob;
    ctx.beginPath(); ctx.ellipse(sx(x), sy(py + 0.3), 0.38 * ppm, 0.2 * ppm, 0, 0, Math.PI * 2); ctx.fillStyle = CLOTHES[id % CLOTHES.length]; ctx.fill();
    disc(x, py, r, stressColor(stress), 'rgba(0,0,0,.55)', 0.045);
    if (r * ppm >= 5.5 && mood) {
      disc(x - 0.1, py - 0.06, 0.04, '#222'); disc(x + 0.1, py - 0.06, 0.04, '#222');
      ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, 0.035 * ppm); ctx.beginPath();
      const m = stress < 35 ? 1 : stress < 70 ? 0 : -1; // smile, flat, frown
      ctx.arc(sx(x), sy(py + (m > 0 ? 0.06 : m < 0 ? 0.2 : 0.14)), 0.1 * ppm, m > 0 ? 0.15 * Math.PI : m < 0 ? 1.15 * Math.PI : 0, m > 0 ? 0.85 * Math.PI : m < 0 ? 1.85 * Math.PI : 0);
      if (m === 0) { ctx.moveTo(sx(x - 0.09), sy(py + 0.14)); ctx.lineTo(sx(x + 0.09), sy(py + 0.14)); }
      ctx.stroke();
    }
  }

  function bubble(x, y, ch, stress, hot, leaderTo) {
    const k = hot ? 1 + 0.13 * Math.sin(time * 11) : 1, rr = Math.max(0.4, 11 / ppm) * k;
    const shake = stress >= 90 ? Math.sin(time * 40) * 0.05 : 0;
    if (leaderTo !== undefined) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx(x), sy(y)); ctx.lineTo(sx(x), sy(leaderTo)); ctx.stroke(); }
    disc(x + shake, y, rr, '#fff', hot ? stressColor(100) : stressColor(stress, 45), hot ? 0.09 : 0.06);
    emoji(ch, x + shake, y, rr * 1.35);
  }

  function badge(x, y, ch) {
    const r = Math.max(0.2, 7 / ppm);
    disc(x, y, r, 'rgba(255,255,255,.92)', 'rgba(0,0,0,.4)', 0.03); emoji(ch, x, y, r * 1.5);
  }

  function passengers(s) {
    const list = s.passengers.map((p) => ({ p, ...pos(s, p) })).sort((a, b) => a.y - b.y);
    for (const q of list) person(q.x, q.y, q.p.stress, q.p.id);
    for (const q of list) { // bubbles on top
      const { p } = q;
      if (p.need) {
        const hot = p.stress >= 70;
        if (q.seated) { const side = q.seated.side === 'L' ? -1 : 1, bx = q.x + (q.seated.slot === 0 ? -0.5 : 0.5), by = side * 2.55; bubble(bx, by, NEED_ICON[p.need], p.stress, hot, q.y + side * 0.32); }
        else bubble(q.x, q.y - 1.0, NEED_ICON[p.need], p.stress, hot);
      }
      if (p.role) { const sd = q.seated ? q.seated.slot === 0 ? -1 : 1 : 1; badge(q.x - 0.3 * sd, q.y - 0.3, ROLE_ICON[p.role]); }
    }
  }

  function attendant(s, target) {
    const a = s.attendant, bob = a.moving ? Math.sin(time * 16) * 0.05 : 0, f = a.facing;
    // the lead line to the followers
    let px = a.x;
    ctx.strokeStyle = 'rgba(255,200,87,.7)'; ctx.lineWidth = Math.max(1.5, 0.05 * ppm); ctx.setLineDash([4, 4]);
    for (const id of s.followers) { const p = s.passengers.find((q) => q.id === id); if (!p) continue; ctx.beginPath(); ctx.moveTo(sx(px), sy(0)); ctx.lineTo(sx(p.x), sy(pos(s, p).y)); ctx.stroke(); px = p.x; }
    ctx.setLineDash([]);
    // action target ring
    if (target && target.pid) {
      const p = s.passengers.find((q) => q.id === target.pid);
      if (p) { const q = pos(s, p); disc(q.x, q.y, 0.52 + 0.04 * Math.sin(time * 8), null, 'rgba(255,200,87,.95)', 0.06); }
    }
    const x = a.x, y = bob;
    ctx.beginPath(); ctx.ellipse(sx(x), sy(y + 0.32), 0.44 * ppm, 0.24 * ppm, 0, 0, Math.PI * 2); ctx.fillStyle = '#1d3b66'; ctx.fill();
    ctx.strokeStyle = '#ffc857'; ctx.lineWidth = Math.max(1, 0.04 * ppm); ctx.stroke(); // a gold trim
    disc(x, y, 0.33, '#f0c9a0', 'rgba(0,0,0,.6)', 0.05);
    disc(x + f * 0.1, y + 0.02, 0.035, '#222'); disc(x + f * 0.1 - 0.12 * f, y + 0.02, 0.035, '#222');
    // cap: a dark crown and a brim towards the facing direction
    ctx.beginPath(); ctx.arc(sx(x), sy(y - 0.1), 0.34 * ppm, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#1d3b66'; ctx.fill();
    rect(f > 0 ? x : x - 0.42, y - 0.12, f > 0 ? x + 0.42 : x, y - 0.03, '#10243f', 0.03);
    rect(x - 0.34, y - 0.17, x + 0.34, y - 0.12, '#ffc857');
    if (s.carried) emoji(ITEM_ICON[s.carried], x + f * 0.62, y - 0.05 + 0.02, 0.62);
    // hold progress ring
    if (s.hold) {
      let hx = x, hy = y;
      if (s.hold.pid) { const p = s.passengers.find((q) => q.id === s.hold.pid); if (p) { const q = pos(s, p); hx = q.x; hy = q.y; } }
      ctx.lineCap = 'round'; ctx.lineWidth = Math.max(3, 0.12 * ppm);
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(sx(hx), sy(hy), 0.66 * ppm, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffc857'; ctx.beginPath(); ctx.arc(sx(hx), sy(hy), 0.66 * ppm, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.hold.progress); ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  // The action the attendant's key would run now (mirrors game.js actionsAt): highlights the row or passenger.
  function actionTarget(s) {
    const ax = s.attendant.x, A = CFG.attendant, list = [];
    const near = needActions(s, ax), qa = questActions(s, ax);
    list.push(...near, ...qa);
    const c = list.filter((x) => Math.abs(x.x - ax) <= x.reach).sort((a, b) => b.prio - a.prio || b.stress - a.stress || Math.abs(a.x - ax) - Math.abs(b.x - ax))[0];
    if (!c) return null;
    const row = c.key.startsWith('seat:') ? rowAt(s.train, ax, A.rowReach) : null;
    return { pid: c.pid, x: c.x, rowId: row ? row.id : c.pid ? (rowAt(s.train, c.x, 1.0) || {}).id : undefined };
  }

  function lostBag(s) {
    for (const q of s.quests.active) {
      if (q.type === 'lost' && q.stage === 'find' && carAt(s.train, s.attendant.x).index === q.bag.car) {
        const p = 0.5 + 0.5 * Math.sin(time * 6);
        disc(q.bag.x, 0.15, 0.6 + 0.1 * p, `rgba(255,200,87,${(0.2 + 0.15 * p).toFixed(2)})`, 'rgba(255,200,87,.9)', 0.05);
        emoji('🧳', q.bag.x, 0.15, 0.85);
      }
    }
  }

  // ---- the train strip (A-1): the whole train, the camera window, the attendant, a dot per open need
  function drawStrip(s) {
    const c = sctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, SW, SH);
    if (!s) return;
    const m = 8, len = s.train.length, X = (x) => m + (x / len) * (SW - 2 * m);
    for (const car_ of s.train.cars) {
      c.fillStyle = car_.kind === 'cafe' ? '#8a5a2e' : '#40678d'; c.beginPath(); c.roundRect(X(car_.start) + 1, 6, X(car_.end) - X(car_.start) - 2, SH - 12, 4); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.font = `700 9px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(car_.kind === 'cafe' ? '☕' : String(car_.number), (X(car_.start) + X(car_.end)) / 2, SH - 5);
    }
    c.fillStyle = '#34536f'; c.beginPath(); c.roundRect(X(s.train.cab.start) + 1, 6, X(s.train.cab.end) - X(s.train.cab.start) - 1, SH - 12, [4, 9, 9, 4]); c.fill();
    // the camera window
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5;
    const half = W / ppm / 2; c.strokeRect(X(Math.max(0, cam.x - half)), 3, X(Math.min(len, cam.x + half)) - X(Math.max(0, cam.x - half)), SH - 6);
    // needs
    for (const p of s.passengers) {
      if (!p.need) continue;
      const q = pos(s, p), y = q.seated ? (q.seated.side === 'L' ? 11 : 19) : 15;
      c.beginPath(); c.arc(X(q.x), y, p.stress >= 70 ? 3.6 : 2.8, 0, Math.PI * 2); c.fillStyle = stressColor(p.stress); c.fill();
      if (p.stress >= 70) { c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); }
    }
    c.font = `11px ${EMOJI}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const p of s.passengers) if (p.role) c.fillText(ROLE_ICON[p.role], X(pos(s, p).x), 5);
    for (const q of s.quests.active) {
      if (q.type === 'lost' && q.stage === 'find') c.fillText('🧳', X(q.bag.x), SH - 8);
      if ((q.type === 'sick' && q.stage === 'fetch') || (q.type === 'connection' && q.stage === 'radio')) c.fillText(q.type === 'sick' ? '🩹' : '📻', X(s.train.cab.x), SH - 8);
    }
    // the attendant
    const ax = X(s.attendant.x);
    c.fillStyle = '#ffc857'; c.fillRect(ax - 1.5, 2, 3, SH - 4); c.beginPath(); c.moveTo(ax - 5, 0); c.lineTo(ax + 5, 0); c.lineTo(ax, 7); c.fill();
  }

  // ---- one frame. opts: { dt: game seconds advanced since the last frame, now: ms, top, bottom: px reserved by the HUD }
  function draw(s, { dt = 0, now = performance.now(), top = 80, bottom = 0 } = {}) {
    time = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!s) { ctx.clearRect(0, 0, W, H); drawStrip(null); return; }
    const avail = Math.max(120, H - top - bottom);
    ppm = clamp(Math.min(W / 13, avail / 5.9), 20, 52);
    cy = top + avail / 2;
    // the camera follows the attendant, clamped to the train ends
    const half = W / ppm / 2, lo = half - 1.2, hi = s.train.length - half + 1.2;
    const target = lo > hi ? s.train.length / 2 : clamp(s.attendant.x, lo, hi);
    cam.x = cam.init ? cam.x + (target - cam.x) * Math.min(1, 9 * Math.min(0.1, Math.max(dt, 0.016))) : target;
    cam.init = true;
    // the train's speed: up for the first seconds of a leg, down for the last ones, 0 at a station or a rescue stop
    const r = s.route;
    const want = r.phase === 'leg' ? V_MAX * clamp(Math.min(r.timer / 4, (r.legDur - r.timer) / 5), 0.02, 1) : 0;
    fx.vel += (want - fx.vel) * Math.min(1, dt * 2.5);
    fx.scroll += fx.vel * dt;
    fx.platform += ((r.phase === 'dwell' && fx.vel < 4 ? 1 : 0) - fx.platform) * Math.min(1, Math.max(dt, 0.016) * 4);
    fx.broken += ((r.phase === 'stop' ? 1 : 0) - fx.broken) * Math.min(1, Math.max(dt, 0.016) * 2);

    landscape();
    platform(s, fx.platform);
    brokenTrain(s, fx.broken);
    // car shadows
    rect(-0.1, -BODY_HALF + 0.2, s.train.length + 0.1, BODY_HALF + 0.3, 'rgba(0,0,0,.22)', 0.3);
    for (const c of s.train.cars) car(c, s);
    for (let i = 1; i < s.train.cars.length; i++) door(s.train.cars[i].start, s.attendant.x);
    door(s.train.cab.start, s.attendant.x);
    cab(s);
    const target2 = actionTarget(s);
    seats(s, target2);
    lostBag(s);
    passengers(s);
    attendant(s, target2);
    drawStrip(s);
  }

  return { resize, clear, reset, draw, stressColor };
}
