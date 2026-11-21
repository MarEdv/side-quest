// The cockpit (V-2, D2, D16): windscreen frame, dashboard with a speedometer dial and a digital readout, the steering
// wheel, the rear-view mirror with the cars behind. Drawn on the same canvas as the road, after it. DOM-free: it
// takes a 2D context, sizes and the game state (render.js owns the canvas). `view=hood` has no wheel: a low dashboard
// strip and the car's bonnet.
import { CFG } from './config.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MIRROR_RANGE = 110;       // metres behind the player that the mirror shows
const CAR_H = { car: 1.45, van: 2.0, truck: 3.4 };

// Where everything sits for a canvas of W x H css pixels. `top` is the free space the HUD chips need on a narrow screen
// (the mirror hangs below it there).
export function cockpitLayout(W, H, view, top = 0) {
  const hood = view === 'hood';
  const portrait = H > W * 1.1;
  const shortScreen = H < 460;
  const dashH = Math.round(H * (hood ? (portrait ? 0.085 : 0.1) : portrait ? 0.2 : shortScreen ? 0.34 : 0.3));
  const dashTop = H - dashH;
  const roofH = Math.round(H * (hood ? 0.03 : portrait ? 0.035 : 0.055));
  const mw = Math.round(Math.min(W * 0.5, Math.max(W * 0.2, 170)));
  const mh = Math.round(mw * 0.27);
  const narrow = W < 600;
  const my = narrow ? Math.round(top + 4) : Math.round(roofH * 0.55);
  // wheel: its top rim sits a bit below the dial; roughly half of it shows above the bottom edge
  const R = Math.min(W * 0.3, dashH * 1.05);
  const wheelTop = dashTop + dashH * 0.46;
  const dialR = Math.max(14, dashH * 0.19);
  return {
    W, H, hood, portrait, dashH, dashTop, roofH, pillarTop: W * (hood ? 0.045 : portrait ? 0.1 : 0.1), pillarBot: W * (hood ? 0.01 : 0.04),
    mirror: { x: Math.round(W / 2 - mw / 2), y: my, w: mw, h: mh },
    wheel: { cx: W / 2, cy: wheelTop + R, r: R },
    dial: { cx: W / 2, cy: dashTop + dashH * 0.17, r: dialR },
  };
}

// Draws the whole cockpit. state: the game state; o: { kmh, night (0..1), sunset (0..1), pal: { sky, ground, road, line },
// unit, now (ms), shake (0..1 how hard the car is shaking), color (the player's car colour, for the bonnet) }.
export function drawCockpit(ctx, L, s, o) {
  const dk = 1 - 0.5 * o.night - 0.08 * o.sunset; // darkness of the plastics
  const g = (v, a = 1) => `rgba(${Math.round(v * dk)},${Math.round(v * dk * 1.02)},${Math.round(v * dk * 1.08)},${a})`;
  drawMirror(ctx, L, s, o);
  drawPillars(ctx, L, g);
  if (L.hood) drawHood(ctx, L, o, g);
  else drawDash(ctx, L, s, o, g);
}

function drawPillars(ctx, L, g) {
  const { W, dashTop, roofH, pillarTop, pillarBot } = L;
  // A-pillars: slanted, wider at the top
  for (const side of [-1, 1]) {
    const ox = side < 0 ? 0 : W, sg = side < 0 ? 1 : -1;
    const grad = ctx.createLinearGradient(ox, 0, ox + sg * pillarTop, 0);
    grad.addColorStop(0, g(18)); grad.addColorStop(0.7, g(30)); grad.addColorStop(1, g(44));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox + sg * pillarTop, 0); ctx.lineTo(ox + sg * pillarBot, dashTop + 2); ctx.lineTo(ox, dashTop + 2); ctx.closePath(); ctx.fill();
  }
  // roof edge with a shallow curve
  const grad = ctx.createLinearGradient(0, 0, 0, roofH * 1.4);
  grad.addColorStop(0, g(14)); grad.addColorStop(1, g(34));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, roofH * 0.75); ctx.quadraticCurveTo(W / 2, roofH * 1.5, 0, roofH * 0.75); ctx.closePath(); ctx.fill();
}

function drawHood(ctx, L, o, g) {
  const { W, H, dashTop, dashH } = L;
  const bh = Math.round(H * 0.085);
  // the bonnet: a trapezoid narrowing away from the driver, in the car's colour, with a crease and a highlight
  const [r, gg, b] = o.color;
  const lit = (k) => `rgb(${Math.round(r * k * (1 - 0.5 * o.night))},${Math.round(gg * k * (1 - 0.5 * o.night))},${Math.round(b * k * (1 - 0.5 * o.night))})`;
  const grad = ctx.createLinearGradient(0, dashTop - bh, 0, dashTop);
  grad.addColorStop(0, lit(1.25)); grad.addColorStop(1, lit(0.6));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(W * 0.12, dashTop + 2); ctx.lineTo(W * 0.3, dashTop - bh * 0.8);
  ctx.quadraticCurveTo(W * 0.5, dashTop - bh * 1.15, W * 0.7, dashTop - bh * 0.8); ctx.lineTo(W * 0.88, dashTop + 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W * 0.5, dashTop - bh * 1.1); ctx.lineTo(W * 0.5, dashTop); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W * 0.33, dashTop - bh * 0.7); ctx.quadraticCurveTo(W * 0.5, dashTop - bh * 1.02, W * 0.67, dashTop - bh * 0.7); ctx.stroke();
  // the low dashboard strip
  const dg = ctx.createLinearGradient(0, dashTop, 0, H);
  dg.addColorStop(0, g(52)); dg.addColorStop(1, g(14));
  ctx.fillStyle = dg;
  ctx.beginPath(); ctx.moveTo(0, dashTop + dashH * 0.25); ctx.quadraticCurveTo(W / 2, dashTop - dashH * 0.15, W, dashTop + dashH * 0.25); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
}

function drawDash(ctx, L, s, o, g) {
  const { W, H, dashTop, dashH } = L;
  // dashboard body with a binnacle hump over the instruments
  const dg = ctx.createLinearGradient(0, dashTop - dashH * 0.15, 0, H);
  dg.addColorStop(0, g(58)); dg.addColorStop(0.25, g(34)); dg.addColorStop(1, g(12));
  ctx.fillStyle = dg;
  ctx.beginPath(); ctx.moveTo(0, dashTop + dashH * 0.1); ctx.quadraticCurveTo(W * 0.25, dashTop + dashH * 0.02, W * 0.4, dashTop - dashH * 0.02);
  ctx.quadraticCurveTo(W / 2, dashTop - dashH * 0.2, W * 0.6, dashTop - dashH * 0.02); ctx.quadraticCurveTo(W * 0.75, dashTop + dashH * 0.02, W, dashTop + dashH * 0.1);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = g(86, 0.6); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, dashTop + dashH * 0.1); ctx.quadraticCurveTo(W * 0.25, dashTop + dashH * 0.02, W * 0.4, dashTop - dashH * 0.02);
  ctx.quadraticCurveTo(W / 2, dashTop - dashH * 0.2, W * 0.6, dashTop - dashH * 0.02); ctx.quadraticCurveTo(W * 0.75, dashTop + dashH * 0.02, W, dashTop + dashH * 0.1); ctx.stroke();
  // vents on the passenger side
  ctx.fillStyle = g(8);
  for (let i = 0; i < 3; i++) ctx.fillRect(W * 0.72, dashTop + dashH * (0.3 + i * 0.1), W * 0.14, Math.max(2, dashH * 0.035));
  drawDial(ctx, L, o);
  drawWheel(ctx, L, s, o, g);
}

function drawDial(ctx, L, o) {
  const { cx, cy, r } = L.dial;
  const night = o.night;
  // bezel and face
  ctx.fillStyle = 'rgba(6,7,9,.9)';
  ctx.beginPath(); ctx.roundRect(cx - r * 1.28, cy - r * 1.1, r * 4.5, r * 2.3, r * 0.4); ctx.fill();
  ctx.fillStyle = '#0b0d10'; ctx.strokeStyle = '#3a3e46'; ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5, max = 180;
  const ang = (v) => a0 + sweep * clamp(v / max, 0, 1);
  const tick = night > 0.5 ? '#9fd8ff' : '#e9e9e9';
  ctx.strokeStyle = tick; ctx.fillStyle = tick;
  for (let v = 0; v <= max; v += 10) {
    const major = v % 20 === 0, a = ang(v), c = Math.cos(a), sn = Math.sin(a);
    ctx.lineWidth = major ? Math.max(1.2, r * 0.06) : Math.max(1, r * 0.03);
    ctx.beginPath(); ctx.moveTo(cx + c * r * (major ? 0.74 : 0.82), cy + sn * r * (major ? 0.74 : 0.82)); ctx.lineTo(cx + c * r * 0.92, cy + sn * r * 0.92); ctx.stroke();
  }
  if (r >= 30) {
    ctx.font = `600 ${Math.round(r * 0.2)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= max; v += 40) { const a = ang(v); ctx.fillText(String(v), cx + Math.cos(a) * r * 0.57, cy + Math.sin(a) * r * 0.57); }
  }
  // needle
  const a = ang(o.kmh);
  ctx.strokeStyle = '#ff5a2a'; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * r * 0.14, cy - Math.sin(a) * r * 0.14); ctx.lineTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#2b2e34'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2); ctx.fill();
  // digital readout to the right of the dial
  const fs = Math.round(r * 0.95);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = night > 0.5 ? '#7fe3ff' : '#9df2b0';
  ctx.font = `700 ${fs}px ui-monospace, Menlo, monospace`;
  ctx.fillText(String(Math.round(o.kmh)), cx + r * 1.4, cy + fs * 0.25);
  ctx.fillStyle = '#8a94a0'; ctx.font = `600 ${Math.max(8, Math.round(r * 0.3))}px system-ui, sans-serif`;
  ctx.fillText(o.unit, cx + r * 1.42, cy + fs * 0.25 + Math.max(10, r * 0.42));
}

function drawWheel(ctx, L, s, o, g) {
  const { cx, cy, r } = L.wheel;
  const shk = o.shake;
  ctx.save();
  ctx.translate(cx + (shk ? (Math.random() - 0.5) * 8 * shk : 0), cy + (shk ? (Math.random() - 0.5) * 6 * shk : 0));
  ctx.scale(1, 0.8);
  ctx.rotate(s.player.steer * 0.95);
  const t = r * 0.16;
  // spokes (left, right, down) and hub
  ctx.strokeStyle = g(30); ctx.lineCap = 'round'; ctx.lineWidth = t * 0.9;
  for (const a of [Math.PI, 0, Math.PI / 2]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (r - t), Math.sin(a) * (r - t)); ctx.stroke(); }
  // rim
  ctx.strokeStyle = g(22); ctx.lineWidth = t;
  ctx.beginPath(); ctx.arc(0, 0, r - t / 2, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = g(70, 0.55); ctx.lineWidth = Math.max(1, t * 0.18);
  ctx.beginPath(); ctx.arc(0, 0, r - t * 0.78, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  // 12 o'clock marker, so the turn can be seen
  ctx.fillStyle = '#d63b2f'; ctx.fillRect(-t * 0.18, -r, t * 0.36, t);
  ctx.fillStyle = g(34); ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = g(70); ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'butt';
  ctx.restore();
}

// ---- rear-view mirror: a small mirrored road with the cars behind (up to MIRROR_RANGE m), seen from their front
function drawMirror(ctx, L, s, o) {
  const m = L.mirror, p = s.player;
  const x = m.x, y = m.y, w = m.w, h = m.h, pad = Math.max(2, h * 0.07);
  // stalk
  ctx.fillStyle = '#15171b';
  if (y > L.roofH * 0.8) { ctx.beginPath(); ctx.moveTo(x + w * 0.46, y); ctx.lineTo(x + w * 0.54, y); ctx.lineTo(x + w * 0.52, y - Math.min(y, 10)); ctx.lineTo(x + w * 0.48, y - Math.min(y, 10)); ctx.fill(); }
  ctx.fillStyle = '#101216'; ctx.beginPath(); ctx.roundRect(x, y, w, h, h * 0.3); ctx.fill();
  const ix = x + pad, iy = y + pad, iw = w - pad * 2, ih = h - pad * 2;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, h * 0.24); ctx.clip();
  const hy = iy + ih * 0.42, cx = ix + iw / 2;
  ctx.fillStyle = o.pal.sky; ctx.fillRect(ix, iy, iw, hy - iy);
  ctx.fillStyle = o.pal.ground; ctx.fillRect(ix, hy, iw, iy + ih - hy);
  const f = iw * 0.9, camH = 1.2, d0 = 1.5; // focal length in px, eye height, the nearest distance
  const hw = s.track.halfWidth, lat = -p.x; // the road centre is at -x of the player
  const at = (dist, xw) => ({ x: cx + (f / dist) * (xw + lat), y: hy + (f / dist) * camH });
  const near = at(d0, 0), far = at(400, 0);
  // asphalt: from the nearest to the far distance
  ctx.fillStyle = o.pal.road;
  ctx.beginPath(); ctx.moveTo(at(d0, -hw).x, at(d0, -hw).y); ctx.lineTo(at(400, -hw).x, far.y); ctx.lineTo(at(400, hw).x, far.y); ctx.lineTo(at(d0, hw).x, at(d0, hw).y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = o.pal.line; ctx.lineWidth = Math.max(1, ih * 0.025);
  for (let k = 1; k < s.track.lanes; k++) {
    const xw = (k - s.track.lanes / 2) * s.track.laneWidth;
    ctx.beginPath(); ctx.moveTo(at(d0, xw).x, near.y); ctx.lineTo(at(400, xw).x, far.y); ctx.stroke();
  }
  // cars behind, far to near
  const behind = [];
  for (const c of s.cars) {
    const dist = p.z - c.z - c.length / 2 - 2.2; // from the rear bumper of the player's car to the front of the other
    if (dist > 0.3 && dist < MIRROR_RANGE) behind.push({ c, dist });
  }
  behind.sort((a, b) => b.dist - a.dist);
  for (const { c, dist } of behind) {
    const D = dist + d0;
    const sc = f / D, cw = sc * c.width, ch = sc * CAR_H[c.kind];
    const px = cx + sc * (c.x - p.x), py = hy + sc * camH;
    if (ch < 1.5) continue;
    const col = CFG.traffic.palette[c.color];
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(px - cw / 2, py - ch * 0.04, cw, ch * 0.06);
    ctx.fillStyle = col; ctx.fillRect(px - cw / 2, py - ch * 0.7, cw, ch * 0.6);
    ctx.fillStyle = shade(col, 0.82); ctx.fillRect(px - cw * 0.4, py - ch, cw * 0.8, ch * 0.34);
    ctx.fillStyle = '#18222e'; ctx.fillRect(px - cw * 0.34, py - ch * 0.94, cw * 0.68, ch * 0.24);
    ctx.fillStyle = '#151515'; ctx.fillRect(px - cw / 2, py - ch * 0.12, cw, ch * 0.1);
    const lit = c.speed < 0 ? '#c3262b' : '#fff6c8'; // an oncoming car that has passed shows its tail lights
    ctx.fillStyle = lit;
    const lw = Math.max(1.5, cw * 0.18), lh = Math.max(1.5, ch * 0.12);
    ctx.fillRect(px - cw / 2 + cw * 0.05, py - ch * 0.38, lw, lh); ctx.fillRect(px + cw / 2 - cw * 0.05 - lw, py - ch * 0.38, lw, lh);
    if (c.speed >= 0 && (o.night > 0.3 || dist < 40)) {
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,240,180,${0.18 + 0.3 * o.night})`;
      const gr = Math.max(3, cw * 0.35);
      ctx.beginPath(); ctx.arc(px - cw * 0.36, py - ch * 0.32, gr, 0, 7); ctx.arc(px + cw * 0.36, py - ch * 0.32, gr, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // glass sheen
  const sheen = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
  sheen.addColorStop(0, 'rgba(255,255,255,.14)'); sheen.addColorStop(0.35, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,.05)');
  ctx.fillStyle = sheen; ctx.fillRect(ix, iy, iw, ih);
  ctx.restore();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}
