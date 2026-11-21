// Canvas 2D first-person road view (V-1, V-2, G-2, D2, D16; browser only): sky, parallax hills and skyline, the road
// projected segment by segment, roadside scenery and traffic as procedural sprites, then the cockpit (cockpit.js).
// Procedural, no image files. DPR-aware (capped at 2). The renderer only reads the game state; its own state is the
// background scroll and a few fades. Technique: docs/DECISIONS.md D2 and D16.
import { CFG } from './config.js';
import { segmentAt, heightAt } from './track.js';
import { cockpitLayout, drawCockpit } from './cockpit.js';

const SEG = CFG.track.segLen;
const EYE_H = 1.2, EYE_X = -0.35, EYE_BACK = 0.3, NEAR = 0.6;  // the driver's eye: 1.2 m up, 0.35 m left of the car's centre
const DRAW_SEGS = 230;     // 1150 m
const CAR_RANGE = CFG.traffic.spawnMin; // cars are drawn up to here (they spawn beyond it, D11) and fade in over CAR_FADE
const CAR_FADE = 70;
const FOG_DIST = 620, FOG_LEVELS = 24, FOG_MAX = 0.96;
const CURVE_K = 0.045;     // metres of sideways shift per segment^2 per unit of curvature
const CAR_H = { car: 1.45, van: 2.0, truck: 3.4 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u * u * (3 - 2 * u);

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const css = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
const mixc = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

// A small integer hash -> 0..1, so scenery details stay put as the road moves.
function rnd(i, k = 0) {
  let x = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(k | 0, 0x165667b1);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// The three lights of the drive (G-2): afternoon, sunset, night. Colours are blended over the end of each stage.
const LOOKS = [
  { skyTop: '#3f86d6', skyHor: '#c4e2f4', grassA: '#63b24c', grassB: '#58a544', kerbA: '#ececec', kerbB: '#cc3a2f', road: '#70747a', line: '#f4f4f4', rail: '#b9bec4',
    hill1: '#8db4b8', hill2: '#6fa45e', tint: [1, 1, 1], night: 0, sunset: 0 },
  { skyTop: '#3a2a68', skyHor: '#ff9a48', grassA: '#477f3c', grassB: '#3f7436', kerbA: '#e0d6cf', kerbB: '#b0343a', road: '#5d5a66', line: '#f0e3d2', rail: '#aaa4a8',
    hill1: '#7a4f78', hill2: '#3d4f3c', tint: [1, 0.8, 0.66], night: 0, sunset: 1 },
  { skyTop: '#04061a', skyHor: '#1c2a4e', grassA: '#17402a', grassB: '#133823', kerbA: '#8a8e98', kerbB: '#74303a', road: '#2c2f37', line: '#c4c9d6', rail: '#6d727c',
    hill1: '#17203c', hill2: '#0d1427', tint: [0.4, 0.45, 0.72], night: 1, sunset: 0 },
].map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, typeof v === 'string' ? hex(v) : v])));
const COLOR_KEYS = ['skyTop', 'skyHor', 'grassA', 'grassB', 'kerbA', 'kerbB', 'road', 'line', 'rail', 'hill1', 'hill2', 'tint'];
const FOG_KEYS = ['grassA', 'grassB', 'kerbA', 'kerbB', 'road', 'roadB', 'line', 'rail'];

function blendLooks(time, duration) {
  const tod = clamp(time / duration, 0, 0.9999) * CFG.stages;
  const i = Math.floor(tod), u = i < CFG.stages - 1 ? smooth(clamp((tod - i - 0.78) / 0.22, 0, 1)) : 0;
  const a = LOOKS[i], b = LOOKS[Math.min(CFG.stages - 1, i + 1)];
  const p = {};
  for (const k of COLOR_KEYS) p[k] = mixc(a[k], b[k], u);
  p.night = lerp(a.night, b.night, u); p.sunset = lerp(a.sunset, b.sunset, u); p.tod = tod;
  p.roadB = p.road.map((v) => v * 1.06);
  return p;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let layout = null, f = 600, hy = 300;
  const bg = { x: 0 };
  const pts = Array.from({ length: DRAW_SEGS + 2 }, () => ({}));
  const clips = new Float32Array(DRAW_SEGS + 1);
  const vis = new Uint8Array(DRAW_SEGS + 1);
  const buckets = Array.from({ length: DRAW_SEGS + 1 }, () => []);
  let pal = null, fogTab = null, fogRGB = null, view = 'cockpit', topInset = 0;
  let playerColor = hex('#2b6cb0');

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    return { w: W, h: H };
  }
  function reset() { bg.x = 0; }

  // ---- camera / layout
  function setLayout(flagView, top) {
    view = flagView; topInset = top;
    layout = cockpitLayout(W, H, view, top);
    const portrait = layout.portrait;
    const hfov = portrait ? 48 : 86;
    f = W / 2 / Math.tan((hfov * Math.PI) / 360);
    hy = H * (portrait ? 0.43 : H < 460 ? 0.36 : 0.38) + (layout.hood ? H * 0.03 : 0);
  }

  // ---- fog: colours blended towards the horizon colour with distance, cached per level for the frame
  const fogLevel = (z) => Math.min(FOG_LEVELS - 1, Math.round((FOG_LEVELS - 1) * (1 - Math.exp(-((z / FOG_DIST) ** 2)))));
  const fogColor = (key, lvl) => fogTab[key][lvl] ??= css(mixc(pal[key], fogRGB, (lvl / (FOG_LEVELS - 1)) * FOG_MAX));
  const lit = (c, k = 1) => css([c[0] * pal.tint[0] * k, c[1] * pal.tint[1] * k, c[2] * pal.tint[2] * k]);

  // ---- polygons
  function poly(x1, y1, x2, y2, x3, y3, x4, y4) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
  }
  // a band of lateral width [x0, x1] metres between two projected points
  const band = (a, b, x0, x1) => poly(a.cx + a.sc * x0, a.sy, a.cx + a.sc * x1, a.sy, b.cx + b.sc * x1, b.sy, b.cx + b.sc * x0, b.sy);

  // ---- sky and background
  function drawSky(s, o) {
    const grad = ctx.createLinearGradient(0, 0, 0, hy);
    grad.addColorStop(0, css(pal.skyTop)); grad.addColorStop(1, css(pal.skyHor));
    ctx.fillStyle = grad; ctx.fillRect(-40, -40, W + 80, hy + 40);
    const night = pal.night, P = W * 1.6;
    const wrap = (x) => ((x % P) + P) % P - W * 0.3;
    // stars
    if (night > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${(night * 0.85).toFixed(2)})`;
      for (let i = 0; i < 70; i++) { const sx = wrap(rnd(i, 1) * P + bg.x * 0.2), sy = rnd(i, 2) * hy * 0.8; ctx.fillRect(sx, sy, 1.5 + rnd(i, 3), 1.5 + rnd(i, 3)); }
    }
    // sun (afternoon: high and pale, sunset: big and low) and moon
    const sunY = lerp(lerp(hy * 0.3, hy * 0.97, clamp(pal.tod, 0, 1)), hy * 1.15, clamp(pal.tod - 1, 0, 1));
    const sunX = wrap(W * 0.65 + bg.x * 0.9);
    if (pal.tod < 2.25) {
      const sr = lerp(Math.min(W, H) * 0.045, Math.min(W, H) * 0.09, clamp(pal.tod, 0, 1));
      const glow = ctx.createRadialGradient(sunX, sunY, sr * 0.5, sunX, sunY, sr * 5);
      glow.addColorStop(0, pal.sunset > 0.3 ? 'rgba(255,180,90,.55)' : 'rgba(255,255,230,.5)'); glow.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = glow; ctx.fillRect(sunX - sr * 5, sunY - sr * 5, sr * 10, sr * 10);
      ctx.fillStyle = pal.sunset > 0.3 ? '#ffd27a' : '#fffbe0';
      ctx.beginPath(); ctx.arc(sunX, sunY, sr, 0, 7); ctx.fill();
    }
    if (night > 0.3) {
      const mx = wrap(W * 0.25 + bg.x * 0.9), my = hy * 0.3, mr = H * 0.03;
      ctx.fillStyle = `rgba(235,240,255,${night.toFixed(2)})`; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(20,30,60,.7)'; ctx.beginPath(); ctx.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.9, 0, 7); ctx.fill();
    }
    // clouds
    const cloud = (1 - night) * (1 - pal.sunset * 0.35);
    if (cloud > 0.05) {
      ctx.fillStyle = `rgba(${Math.round(255 * pal.tint[0])},${Math.round(255 * pal.tint[1])},${Math.round(255 * pal.tint[2])},${(0.8 * cloud).toFixed(2)})`;
      for (let i = 0; i < 7; i++) {
        const cx = wrap(rnd(i, 7) * P + bg.x * 0.55), cy = hy * (0.12 + rnd(i, 8) * 0.5), cw = W * (0.07 + rnd(i, 9) * 0.07);
        ctx.beginPath(); ctx.ellipse(cx, cy, cw, cw * 0.24, 0, 0, 7); ctx.moveTo(cx - cw * 0.05, cy + cw * 0.06); ctx.ellipse(cx - cw * 0.5, cy + cw * 0.06, cw * 0.55, cw * 0.18, 0, 0, 7); ctx.moveTo(cx + cw * 1.15, cy + cw * 0.05); ctx.ellipse(cx + cw * 0.55, cy + cw * 0.05, cw * 0.6, cw * 0.19, 0, 0, 7); ctx.fill();
      }
    }
    // hills: two layers of summed sines that wrap seamlessly, scrolling with the bend of the road
    const Pw = Math.max(W, 900) * 2;
    const ridge = (amp, seed, col, off, fade) => {
      ctx.fillStyle = css(mixc(col, fogRGB, fade));
      ctx.beginPath(); ctx.moveTo(-5, hy + 1);
      for (let x = -5; x <= W + 5; x += 8) {
        const u = ((x + off) / Pw) * Math.PI * 2;
        const h = amp * (0.5 + 0.28 * Math.sin(u * 3 + seed) + 0.17 * Math.sin(u * 7 + seed * 2.1) + 0.08 * Math.sin(u * 17 + seed * 3.3));
        ctx.lineTo(x, hy - h);
      }
      ctx.lineTo(W + 5, hy + 1); ctx.closePath(); ctx.fill();
    };
    ridge(H * 0.085, 1.3, pal.hill1, bg.x * 0.35, 0.35);
    ridge(H * 0.05, 4.1, pal.hill2, bg.x * 0.6, 0.2);
    // a city skyline at night
    if (night > 0.02) {
      const cwid = Math.max(14, W * 0.022);
      ctx.globalAlpha = night;
      for (let x = -((bg.x * 0.75) % (cwid * 40)) - cwid * 40; x < W + cwid; x += cwid) {
        const i = Math.round((x + bg.x * 0.75) / cwid), n = 1 + Math.floor(rnd(i, 11) * 2);
        const bw = cwid * (0.8 + n * 0.45), bh = H * (0.03 + rnd(i, 12) * rnd(i, 12) * 0.13);
        ctx.fillStyle = '#0a0f20'; ctx.fillRect(x, hy - bh, bw, bh + 1);
        if (bw > 10) {
          ctx.fillStyle = 'rgba(255,214,120,.8)';
          for (let wy = hy - bh + 4; wy < hy - 3; wy += 6) for (let wx = x + 3; wx < x + bw - 3; wx += 6) if (rnd(i * 31 + wx * 7 | 0, wy | 0) < 0.35) ctx.fillRect(wx, wy, 2, 3);
        }
      }
      ctx.globalAlpha = 1;
    }
    // the ground below the horizon, in the fog colour of the grass
    ctx.fillStyle = css(mixc(pal.grassA, fogRGB, 0.85)); ctx.fillRect(-40, hy, W + 80, H - hy + 40);
  }

  // ---- projecting
  function project(p, camX, camY, z) {
    p.Z = z; p.sc = f / z; p.cx = W / 2 + p.sc * (p.xa - camX); p.sy = hy - p.sc * (p.y - camY);
  }

  // ---- traffic sprites
  function carBack(c, sx, sy, sc, alpha, o) {
    const front = c.speed < 0;
    const wm = c.width, hm = CAR_H[c.kind];
    const w = sc * wm, h = sc * hm;
    if (w < 1.2) return;
    const x0 = sx - w / 2;
    const col = hex(CFG.traffic.palette[c.color]);
    const body = lit(col), dark = lit(col, 0.72), glass = lit(front ? [60, 85, 110] : [30, 42, 56]);
    const night = pal.night, dusk = Math.max(night, pal.sunset * 0.4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.56, Math.max(1, h * 0.05), 0, 0, 7); ctx.fill();
    const wheel = lit([18, 18, 20]);
    let lamp; // y of the lights, their half-width fraction
    if (c.kind === 'truck') {
      ctx.fillStyle = wheel; ctx.fillRect(x0 + w * 0.04, sy - h * 0.2, w * 0.18, h * 0.2); ctx.fillRect(x0 + w * 0.78, sy - h * 0.2, w * 0.18, h * 0.2);
      if (front) { // the cab seen from the front
        ctx.fillStyle = body; ctx.fillRect(x0, sy - h * 0.82, w, h * 0.62);
        ctx.fillStyle = glass; ctx.fillRect(x0 + w * 0.1, sy - h * 0.78, w * 0.8, h * 0.3);
        ctx.fillStyle = lit([20, 20, 22]); ctx.fillRect(x0 + w * 0.2, sy - h * 0.38, w * 0.6, h * 0.12);
        ctx.fillStyle = dark; ctx.fillRect(x0 + w * 0.05, sy - h * 0.92, w * 0.9, h * 0.1);
      } else {
        ctx.fillStyle = lit([214, 218, 224]); ctx.fillRect(x0, sy - h, w, h * 0.8);
        ctx.fillStyle = lit(col, 0.9); ctx.fillRect(x0, sy - h * 0.34, w, h * 0.14);
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, w * 0.012); ctx.beginPath(); ctx.moveTo(sx, sy - h); ctx.lineTo(sx, sy - h * 0.2); ctx.stroke();
        ctx.fillStyle = lit([30, 30, 32]); ctx.fillRect(x0, sy - h * 0.2, w, h * 0.06);
      }
      lamp = 0.3;
    } else {
      const van = c.kind === 'van';
      ctx.fillStyle = wheel; ctx.fillRect(x0 + w * 0.06, sy - h * 0.2, w * 0.17, h * 0.2); ctx.fillRect(x0 + w * 0.77, sy - h * 0.2, w * 0.17, h * 0.2);
      // lower body
      ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(x0, sy - h * (van ? 0.7 : 0.6), w, h * (van ? 0.54 : 0.46), w * 0.04); ctx.fill();
      ctx.fillStyle = dark; ctx.fillRect(x0, sy - h * 0.2, w, h * 0.07);
      // cabin
      const bw = w * (van ? 0.96 : 0.82), tw = w * (van ? 0.9 : 0.62), by = sy - h * (van ? 0.7 : 0.6);
      ctx.fillStyle = van ? body : dark;
      ctx.beginPath(); ctx.moveTo(sx - bw / 2, by + 1); ctx.lineTo(sx - tw / 2, sy - h); ctx.lineTo(sx + tw / 2, sy - h); ctx.lineTo(sx + bw / 2, by + 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = glass;
      ctx.beginPath(); ctx.moveTo(sx - bw * 0.44, by - h * 0.02); ctx.lineTo(sx - tw * 0.44, sy - h * 0.94); ctx.lineTo(sx + tw * 0.44, sy - h * 0.94); ctx.lineTo(sx + bw * 0.44, by - h * 0.02); ctx.closePath(); ctx.fill();
      lamp = van ? 0.4 : 0.48;
    }
    // lights
    const lw = w * (c.kind === 'truck' ? 0.11 : 0.19), lh = Math.max(1.5, h * (c.kind === 'truck' ? 0.07 : 0.11));
    const ly = sy - h * lamp, lxL = x0 + w * 0.05, lxR = x0 + w - w * 0.05 - lw;
    const blinkOn = c.blink !== 0 && Math.floor(o.time * 4) % 2 === 0;
    const glow = (gx, gy, r, color) => {
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(gx - r, gy - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
    };
    if (front) {
      ctx.fillStyle = lit([20, 20, 22]); ctx.fillRect(sx - w * 0.2, ly + lh * 0.2, w * 0.4, lh * 1.3);
      for (const lx of [lxL, lxR]) {
        ctx.fillStyle = '#fff7cf'; ctx.beginPath(); ctx.arc(lx + lw / 2, ly + lh / 2, Math.max(1.2, lw * 0.5), 0, 7); ctx.fill();
        if (dusk > 0.05 || w > 4) glow(lx + lw / 2, ly + lh / 2, w * (0.35 + dusk * 0.9), `rgba(255,244,200,${0.25 + 0.5 * dusk})`);
      }
    } else {
      const brake = c.braking;
      const base = brake ? '#ff2d2d' : night > 0.3 ? '#c81e1e' : '#8c1a20';
      for (const [lx, side] of [[lxL, -1], [lxR, 1]]) {
        const bl = blinkOn && c.blink === side;
        ctx.fillStyle = bl ? '#ffb020' : base; ctx.fillRect(lx, ly, lw, lh);
        if (bl) glow(lx + lw / 2, ly + lh / 2, w * 0.4, 'rgba(255,170,30,.7)');
        else if (brake) glow(lx + lw / 2, ly + lh / 2, w * 0.45, 'rgba(255,40,40,.65)');
        else if (night > 0.3) glow(lx + lw / 2, ly + lh / 2, w * 0.25, 'rgba(255,40,40,.4)');
      }
    }
    // number plate
    ctx.fillStyle = lit([232, 232, 224]); ctx.fillRect(sx - w * 0.11, sy - h * (c.kind === 'truck' ? 0.17 : 0.3), w * 0.22, h * 0.07);
    ctx.globalAlpha = 1;
  }

  // ---- scenery sprites; (x, y) is the foot of the object, u the pixels per metre
  const SPR = {
    tree(x, y, u, e) {
      const s = 0.75 + 0.6 * e.size;
      ctx.fillStyle = lit([92, 66, 40]); ctx.fillRect(x - 0.22 * s * u, y - 2.8 * s * u, 0.44 * s * u, 2.8 * s * u);
      const g1 = lit([54, 142, 58]), g2 = lit([70, 168, 70]);
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(x, y - 4.6 * s * u, 2.1 * s * u, 0, 7); ctx.arc(x - 1.3 * s * u, y - 3.8 * s * u, 1.6 * s * u, 0, 7); ctx.arc(x + 1.3 * s * u, y - 3.8 * s * u, 1.6 * s * u, 0, 7); ctx.fill();
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x - 0.5 * s * u, y - 5.2 * s * u, 1.2 * s * u, 0, 7); ctx.fill();
    },
    pine(x, y, u, e) {
      const s = 0.8 + 0.6 * e.size;
      ctx.fillStyle = lit([80, 56, 36]); ctx.fillRect(x - 0.2 * s * u, y - 1.4 * s * u, 0.4 * s * u, 1.4 * s * u);
      const g1 = lit([30, 84, 52]), g2 = lit([42, 108, 64]);
      for (let k = 0; k < 3; k++) {
        const by = y - (1 + k * 2.1) * s * u, hw = (2.1 - k * 0.5) * s * u, th = 3.2 * s * u;
        ctx.fillStyle = g1; ctx.beginPath(); ctx.moveTo(x - hw, by); ctx.lineTo(x, by - th); ctx.lineTo(x + hw, by); ctx.closePath(); ctx.fill();
        ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(x, by - th); ctx.lineTo(x + hw, by); ctx.lineTo(x + hw * 0.2, by); ctx.closePath(); ctx.fill();
      }
    },
    rock(x, y, u, e) {
      const s = 0.8 + 1.2 * e.size;
      ctx.fillStyle = lit([128, 130, 136]); ctx.beginPath(); ctx.moveTo(x - 1.3 * s * u, y); ctx.lineTo(x - 1.0 * s * u, y - 0.9 * s * u); ctx.lineTo(x - 0.2 * s * u, y - 1.4 * s * u);
      ctx.lineTo(x + 0.8 * s * u, y - 1.0 * s * u); ctx.lineTo(x + 1.3 * s * u, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lit([160, 162, 168]); ctx.beginPath(); ctx.moveTo(x - 1.0 * s * u, y - 0.9 * s * u); ctx.lineTo(x - 0.2 * s * u, y - 1.4 * s * u); ctx.lineTo(x + 0.2 * s * u, y - 0.7 * s * u); ctx.closePath(); ctx.fill();
    },
    lamp(x, y, u, e, side) {
      ctx.fillStyle = lit([90, 94, 100]); ctx.fillRect(x - 0.1 * u, y - 7.6 * u, 0.2 * u, 7.6 * u);
      const hx = x - side * 1.8 * u;
      ctx.fillRect(Math.min(x, hx), y - 7.6 * u, Math.abs(hx - x), 0.16 * u);
      const on = pal.night > 0.2;
      ctx.fillStyle = on ? '#fff0b8' : lit([200, 200, 190]); ctx.fillRect(hx - 0.35 * u, y - 7.6 * u, 0.7 * u, 0.22 * u);
      if (on && u > 1.5) {
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(hx, y - 7.4 * u, 0, hx, y - 7.4 * u, 4 * u);
        gr.addColorStop(0, `rgba(255,225,150,${0.55 * pal.night})`); gr.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = gr; ctx.fillRect(hx - 4 * u, y - 11.4 * u, 8 * u, 8 * u);
        ctx.fillStyle = `rgba(255,220,140,${0.16 * pal.night})`; ctx.beginPath(); ctx.ellipse(hx, y, 3.6 * u, 0.7 * u, 0, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    },
    building(x, y, u, e, side, idx) {
      const w = 7 + e.size * 9, h = 9 + (rnd(idx, 21) * 0.6 + e.size * 0.4) * 22;
      const palette = [[112, 122, 140], [140, 130, 114], [92, 102, 116], [124, 108, 112]];
      const base = palette[Math.floor(rnd(idx, 22) * palette.length)];
      const cx = x + side * w * 0.5, x0 = cx - w * u / 2;
      ctx.fillStyle = lit(base); ctx.fillRect(x0, y - h * u, w * u, h * u);
      ctx.fillStyle = lit(base, 0.7); ctx.fillRect(x0, y - h * u, w * u, 0.5 * u);
      const cols = Math.max(1, Math.floor(w / 2.4)), rows = Math.max(1, Math.floor(h / 3.2));
      if (u * 1.1 < 1.5) return;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const on = rnd(idx * 53 + r, c + 99) < 0.55;
        ctx.fillStyle = pal.night > 0.25 ? (on ? '#ffd877' : '#1a2132') : lit([150, 180, 210], 0.9);
        ctx.fillRect(x0 + (c + 0.5) * (w * u / cols) - 0.55 * u, y - h * u + (r + 0.6) * (h * u / rows), 1.1 * u, 1.5 * u);
      }
    },
  };

  // ---- the frame
  function drawWorld(s, o) {
    const p = s.player, tr = s.track, segs = tr.segments;
    const camZ = p.z - EYE_BACK, camX = p.x + EYE_X, camY = EYE_H + heightAt(tr, camZ);
    const base = clamp(Math.floor(camZ / SEG), 0, segs.length - 1), pct = (camZ - segs[base].z) / SEG;
    const hw = tr.halfWidth, B = tr.barrier;
    drawSky(s, o);

    // project the segment corners, nearest first; curves accumulate as a sideways shift
    let x = 0, dx = -segs[base].curve * pct * CURVE_K;
    for (let j = 0; j <= DRAW_SEGS; j++) {
      const sg = segs[Math.min(segs.length - 1, base + j)], q = pts[j];
      q.xa = x; q.y = sg.y; q.zw = sg.z - camZ;
      x += dx; dx += sg.curve * CURVE_K;
    }
    for (let j = 0; j <= DRAW_SEGS; j++) {
      const q = pts[j];
      if (q.zw >= NEAR) project(q, camX, camY, q.zw);
      else { // the segment under the camera: cut at the near plane
        const n = pts[j + 1], t = (NEAR - q.zw) / (n.zw - q.zw);
        q.xa = lerp(q.xa, n.xa, t); q.y = lerp(q.y, n.y, t); project(q, camX, camY, NEAR);
      }
    }
    // visibility, near to far: a segment is hidden behind a crest when its far edge is not above everything nearer
    let maxY = H + 100;
    for (let i = 0; i < DRAW_SEGS; i++) {
      const a = pts[i], b = pts[i + 1];
      clips[i] = maxY;
      vis[i] = b.sy < a.sy && b.sy < maxY ? 1 : 0;
      if (vis[i]) maxY = b.sy;
      buckets[i].length = 0;
    }
    // traffic into the segment its near face (the rear, or the front of an oncoming car) is in: the sprite is that face
    for (const c of s.cars) {
      const zf = c.z - c.length / 2;
      const z = zf - camZ;
      if (z < NEAR || z > CAR_RANGE) continue;
      const i = Math.floor(zf / SEG) - base;
      if (i >= 0 && i < DRAW_SEGS) buckets[i].push(c);
    }

    // far to near
    const night = pal.night;
    for (let i = DRAW_SEGS - 1; i >= 0; i--) {
      const a = pts[i], b = pts[i + 1], sg = segs[Math.min(segs.length - 1, base + i)];
      const lvl = fogLevel(a.Z), alt = Math.floor(sg.index / 3) & 1;
      if (vis[i]) {
        ctx.fillStyle = fogColor(alt ? 'grassA' : 'grassB', lvl);
        ctx.fillRect(-40, b.sy, W + 80, a.sy - b.sy + 1);
        ctx.fillStyle = fogColor(alt ? 'kerbA' : 'kerbB', lvl);
        band(a, b, -hw - 0.7, -hw); band(a, b, hw, hw + 0.7);
        ctx.fillStyle = fogColor(alt ? 'road' : 'roadB', lvl);
        band(a, b, -hw, hw);
        ctx.fillStyle = fogColor('line', lvl);
        band(a, b, -hw + 0.18, -hw + 0.32); band(a, b, hw - 0.32, hw - 0.18);
        if ((sg.index & 3) < 2) for (let k = 1; k < tr.lanes; k++) { const xw = (k - tr.lanes / 2) * tr.laneWidth; band(a, b, xw - 0.09, xw + 0.09); }
        // guardrails
        ctx.fillStyle = fogColor('rail', lvl);
        for (const sd of [-1, 1]) {
          const xr = sd * B;
          poly(a.cx + a.sc * xr, a.sy - a.sc * 0.52, a.cx + a.sc * xr, a.sy - a.sc * 0.95, b.cx + b.sc * xr, b.sy - b.sc * 0.95, b.cx + b.sc * xr, b.sy - b.sc * 0.52);
          if (sg.index % 2 === 0) { const pw = Math.max(1, a.sc * 0.12); ctx.fillRect(a.cx + a.sc * xr - pw / 2, a.sy - a.sc * 0.95, pw, a.sc * 0.95); }
        }
      }
      // fields: flat patches on the ground beside the road (a few segments deep)
      if (a.Z < 700) for (const e of sg.scenery) if (e.kind === 'field') {
        const n = 2 + Math.floor(e.size * 4), z = Math.min(DRAW_SEGS, i + n), far = pts[z];
        if (far.Z < NEAR) continue;
        const x0 = e.side * e.offset, x1 = x0 + e.side * (8 + e.size * 18);
        ctx.fillStyle = css(mixc(e.size > 0.5 ? [206, 178, 74] : [150, 190, 80], fogRGB, (lvl / (FOG_LEVELS - 1)) * FOG_MAX), 0.9 * (pal.tint[0] + pal.tint[1] + pal.tint[2]) / 3);
        poly(a.cx + a.sc * x0, a.sy, a.cx + a.sc * x1, a.sy, far.cx + far.sc * x1, far.sy, far.cx + far.sc * x0, far.sy);
      }
      // sprites
      const clip = clips[i], needClip = clip < H;
      for (const e of sg.scenery) {
        if (e.kind === 'field') continue;
        const sx = a.cx + a.sc * e.side * e.offset, u = a.sc;
        if (a.Z > 700 || u < 0.7) continue;
        if (e.kind === 'fence') { drawFence(a, b, e, lvl, clip); continue; }
        // skip what is wholly hidden behind a crest or off the sides
        if (a.sy - 12 * u > clip || sx < -10 * u - 40 || sx > W + 10 * u + 40) continue;
        ctx.globalAlpha = 1 - FOG_MAX * (lvl / (FOG_LEVELS - 1)) * 0.95;
        if (needClip && a.sy > clip) { ctx.save(); ctx.beginPath(); ctx.rect(-50, -50, W + 100, clip + 50); ctx.clip(); SPR[e.kind]?.(sx, a.sy, u, e, e.side, sg.index); ctx.restore(); }
        else SPR[e.kind]?.(sx, a.sy, u, e, e.side, sg.index);
        ctx.globalAlpha = 1;
      }
      for (const c of buckets[i]) {
        const zf = c.z - c.length / 2, zc = zf - camZ;
        if (zc < NEAR) continue;
        const t = (zf - sg.z) / SEG;
        const xa = lerp(a.xa, b.xa, t), yw = lerp(a.y, b.y, t), sc = f / zc;
        const sx = W / 2 + sc * (xa + c.x - camX), sy = hy - sc * (yw - camY);
        const al = (1 - FOG_MAX * (fogLevel(zc) / (FOG_LEVELS - 1)) * 0.9) * clamp((CAR_RANGE - zc) / CAR_FADE, 0, 1);
        const hpx = sc * CAR_H[c.kind];
        if (sy - hpx > clip) continue;
        if (needClip && sy > clip) { ctx.save(); ctx.beginPath(); ctx.rect(-50, -50, W + 100, clip + 50); ctx.clip(); carBack(c, sx, sy, sc, al, o); ctx.restore(); }
        else carBack(c, sx, sy, sc, al, o);
      }
    }
    // headlights: a pool of light on the road ahead at night
    if (night > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      const by = layout.dashTop, top = hy + (by - hy) * 0.18, cx = W / 2 + 0.0;
      const gr = ctx.createLinearGradient(0, by, 0, top);
      gr.addColorStop(0, `rgba(255,238,170,${0.3 * night})`); gr.addColorStop(1, 'rgba(255,238,170,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(cx - W * 0.34, by); ctx.lineTo(cx - W * 0.04, top); ctx.lineTo(cx + W * 0.04, top); ctx.lineTo(cx + W * 0.34, by); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // sunset haze over everything far away is part of the fog colour; a faint warm vignette at sunset
    if (pal.sunset > 0.05) {
      const vg = ctx.createLinearGradient(0, hy - H * 0.1, 0, hy + H * 0.15);
      vg.addColorStop(0, 'rgba(255,150,70,0)'); vg.addColorStop(0.5, `rgba(255,150,70,${0.16 * pal.sunset})`); vg.addColorStop(1, 'rgba(255,150,70,0)');
      ctx.fillStyle = vg; ctx.fillRect(0, hy - H * 0.1, W, H * 0.25);
    }
  }

  // A wooden fence on one side: posts and two rails running along the segment.
  function drawFence(a, b, e, lvl, clip) {
    if (a.Z < 2.5 || a.sy - 2 * a.sc > clip) return;
    const xw = e.side * e.offset, ax = a.cx + a.sc * xw, bx = b.cx + b.sc * xw;
    ctx.strokeStyle = lit([140, 106, 70]); ctx.globalAlpha = 1 - FOG_MAX * (lvl / (FOG_LEVELS - 1));
    ctx.lineWidth = Math.max(1, a.sc * 0.1);
    ctx.beginPath(); ctx.moveTo(ax, a.sy); ctx.lineTo(ax, a.sy - a.sc * 1.15);
    for (const h of [0.5, 0.95]) { ctx.moveTo(ax, a.sy - a.sc * h); ctx.lineTo(bx, b.sy - b.sc * h); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  // ---- public draw
  function draw(s, o = {}) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!s) { ctx.fillStyle = '#14181f'; ctx.fillRect(0, 0, W, H); return; }
    const now = o.now || 0, dt = o.dt || 0;
    const flagView = s.flags.view;
    if (!layout || flagView !== view || (o.top || 0) !== topInset || layout.W !== W || layout.H !== H) setLayout(flagView, o.top || 0);
    pal = blendLooks(s.time, s.duration); fogRGB = pal.skyHor;
    fogTab = Object.fromEntries(FOG_KEYS.map((k) => [k, new Array(FOG_LEVELS)]));
    const p = s.player;
    // the background turns with the bend of the road
    bg.x -= segmentAt(s.track, p.z).curve * p.speed * dt * f * 0.004;
    const crash = p.crashTimer > 0 ? Math.min(1, p.crashTimer / CFG.crash.timer) : 0;
    const rumble = p.offroad && p.speed > 3 ? 0.18 : p.barrier ? 0.12 : 0;
    const amp = crash * 9 + rumble * 8;
    const shx = amp ? (Math.random() - 0.5) * 2 * amp : 0, shy = amp ? (Math.random() - 0.5) * 2 * amp : 0;
    ctx.save(); ctx.translate(shx, shy);
    const oo = { time: s.time, now };
    drawWorld(s, oo);
    ctx.restore();
    ctx.save(); ctx.translate(shx * 0.35, shy * 0.35);
    drawCockpit(ctx, layout, s, {
      kmh: p.speed * 3.6, night: pal.night, sunset: pal.sunset, unit: o.unit || 'km/h', shake: crash,
      color: playerColor, now,
      pal: { sky: css(pal.skyHor), ground: css(pal.grassA, 0.8), road: css(pal.road), line: css(pal.line) },
    });
    ctx.restore();
  }

  return {
    resize, reset, draw,
    // Where the HUD can put toasts: just under the mirror.
    get mirrorBottom() { return layout ? layout.mirror.y + layout.mirror.h : 60; },
    get size() { return { w: W, h: H }; },
  };
}
