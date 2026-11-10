// Canvas 2D renderer. Reads game state; never mutates it.
import { WORLD, OBSTACLES, STATIONS } from './world.js';
import { CONFIG as C } from './config.js';
import { clockString } from './game.js';

const EMOJI = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
const FONT = `system-ui,-apple-system,'Segoe UI',Roboto,sans-serif`;
const TOP_H = 46;

const COL = {
  floor: '#3b4256', floorAlt: '#363d51', meetFloor: '#4a4358', wall: '#161a26', wallTop: '#262c3e',
  desk: '#8a6a45', deskTop: '#a98458', table: '#6e4f34', ceo: '#2a1f2e', text: '#eef1f8',
  good: '#5ed39a', warn: '#ffc857', bad: '#ff5d6c', poo: '#7a4a1e',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let inset = { t: 0, r: 0, b: 0, l: 0 }; // safe-area insets (CSS px)
  let layout = null;
  let fx = []; // floating texts
  let shake = 0;
  let lastNow = 0;
  let fps = 60;

  // Everything is laid out inside the safe area (notch, home indicator); only backgrounds bleed.
  function computeLayout() {
    const L = inset.l, CW = W - inset.l - inset.r, CH = H - inset.t - inset.b;
    const top = inset.t + TOP_H;
    const portrait = CH / CW > 1.15;
    let mode, scale, ox, oy, panel;
    const availH = CH - TOP_H;
    if (portrait) {
      mode = 'below';
      scale = CW / WORLD.w;
      ox = L; oy = top;
      const py = oy + WORLD.h * scale + 8;
      panel = { x: L + 10, y: py, w: CW - 20, h: Math.max(0, H - inset.b - py - 8) };
    } else {
      let s = Math.min(CW / WORLD.w, availH / WORLD.h);
      if (s < 0.9 && CW - 200 > 300) {
        mode = 'side';
        const side = Math.min(240, Math.max(190, CW * 0.24));
        scale = Math.min((CW - side) / WORLD.w, availH / WORLD.h);
        ox = L + (CW - side - WORLD.w * scale) / 2;
        oy = top + (availH - WORLD.h * scale) / 2;
        panel = { x: L + CW - side + 4, y: top + 4, w: side - 12, h: availH - 8 };
      } else {
        mode = 'overlay';
        scale = s;
        ox = L + (CW - WORLD.w * scale) / 2;
        oy = top + (availH - WORLD.h * scale) / 2;
        panel = { x: ox + 746 * scale, y: oy + 22 * scale, w: 208 * scale, h: 172 * scale };
      }
    }
    layout = { mode, scale, ox, oy, panel, W, H };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = window.innerWidth; H = window.innerHeight;
    // body padding is env(safe-area-inset-*) (see style.css)
    const cs = getComputedStyle(document.body);
    const px = (v) => parseFloat(v) || 0;
    inset = { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    computeLayout();
  }

  const toWorld = (cx, cy) => ({ x: (cx - layout.ox) / layout.scale, y: (cy - layout.oy) / layout.scale });

  // ---- events -> floating text ----
  function floatText(x, y, text, color = COL.text, size = 18) { fx.push({ x, y, text, color, size, age: 0 }); }
  function handle(events, s) {
    for (const e of events) {
      switch (e.type) {
        case 'taskDone': floatText(e.x, e.y - 20, `+${e.points}`, COL.good); break;
        case 'pooDone': floatText(e.x, e.y - 20, `+${e.points} Solved!`, COL.good, 22); break;
        case 'hit': floatText(e.x, e.y - 24, 'SPLAT! 💩', COL.bad, 24); shake = 0.3; break;
        case 'dodged': floatText(e.x, e.y - 10, 'Dodged!', COL.warn, 16); break;
        case 'pooExpired': floatText(s.player.x, s.player.y - 28, 'Deadline missed!', COL.bad, 20); shake = 0.3; break;
        case 'overload': floatText(s.player.x, s.player.y - 28, 'Too many tasks!', COL.warn, 18); break;
        case 'pickup': floatText(e.x, e.y - 20, 'Challenge accepted', COL.warn, 18); break;
        case 'ignored': floatText(e.x, e.y - 10, 'Ignored...', COL.warn, 16); break;
        case 'spawn': floatText(s.player.x, s.player.y - 34, 'New task!', COL.text, 14); break;
        default:
      }
    }
  }

  // ---- helpers ----
  function emoji(ch, x, y, size, rot = 0) {
    ctx.save();
    ctx.translate(x, y); if (rot) ctx.rotate(rot);
    ctx.font = `${size}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
  function text(str, x, y, size, color = COL.text, align = 'center', weight = '600') {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fitText(str, maxW, size, weight = '600') {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(str).width <= maxW) return str;
    while (str.length > 1 && ctx.measureText(str + '…').width > maxW) str = str.slice(0, -1);
    return str + '…';
  }

  // ---- world ----
  function drawFloor() {
    ctx.fillStyle = COL.floor; ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.fillStyle = COL.floorAlt;
    for (let y = 0; y < WORLD.h; y += 40) for (let x = (y / 40) % 2 ? 0 : 40; x < WORLD.w; x += 80) ctx.fillRect(x, y, 40, 40);
    ctx.fillStyle = COL.meetFloor; ctx.fillRect(16, 16, 244, 154);
    text('MEETING ROOM', 140, 30, 11, 'rgba(255,255,255,.35)');
  }

  function drawObstacle(o) {
    if (o.kind === 'wall') {
      ctx.fillStyle = COL.wall; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = COL.wallTop; ctx.fillRect(o.x, o.y, o.w, Math.min(4, o.h));
      return;
    }
    if (o.kind === 'ceo') {
      ctx.fillStyle = COL.ceo; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#463552'; ctx.lineWidth = 3; ctx.strokeRect(o.x + 1.5, o.y, o.w - 3, o.h - 1.5);
      return;
    }
    const base = { desk: COL.desk, table: COL.table, coffee: '#4b4f5c', printer: '#cfd3dc', filing: '#7d8aa0', server: '#2f3a4a' }[o.kind] || '#555';
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(o.x + 3, o.y + 4, o.w, o.h);
    ctx.fillStyle = base; rrect(o.x, o.y, o.w, o.h, 5); ctx.fill();
    if (o.kind === 'desk' || o.kind === 'table') {
      ctx.fillStyle = COL.deskTop; rrect(o.x + 3, o.y + 3, o.w - 6, o.h - 8, 4); ctx.fill();
    }
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    if (o.kind === 'desk') {
      emoji(o.own ? '💻' : '🖥️', cx - (o.own ? 0 : 20), cy - 3, 20);
      if (!o.own) emoji(['☕', '📎', '🪴', '📱'][Math.floor(o.x / 7) % 4], cx + 28, cy - 3, 14);
      if (o.own) { text('YOU', cx + 42, cy - 3, 11, '#2b1d0e', 'center', '800'); }
    } else if (o.kind === 'table') emoji('📊', cx, cy - 2, 22);
    else if (o.kind === 'coffee') emoji('☕', cx, cy, 26);
    else if (o.kind === 'printer') emoji('🖨️', cx, cy, 28);
    else if (o.kind === 'filing') emoji('🗄️', cx, cy, 30);
    else if (o.kind === 'server') emoji('🖥️', cx, cy, 30);
  }

  function drawCeoDecor() {
    if (layout.mode === 'overlay') return; // hidden under the to-do panel
    const o = OBSTACLES.find((x) => x.kind === 'ceo');
    emoji('🏢', o.x + o.w - 22, o.y + o.h - 22, 18);
    text('EXEC SUITE', o.x + 60, o.y + o.h - 14, 11, 'rgba(255,255,255,.35)');
  }

  function drawStations(s, now) {
    const needed = new Map();
    for (const t of s.tasks) { const prev = needed.get(t.station); if (!prev || t.kind === 'poo') needed.set(t.station, t); }
    for (const st of Object.values(STATIONS)) {
      const t = needed.get(st.id);
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      if (t) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 5);
        const poo = t.kind === 'poo';
        ctx.fillStyle = poo ? `rgba(255,93,108,${0.12 + 0.1 * pulse})` : `rgba(94,211,154,${0.1 + 0.08 * pulse})`;
        ctx.fill();
        ctx.setLineDash([6, 5]); ctx.lineWidth = 2.5; ctx.strokeStyle = poo ? COL.bad : COL.good; ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke(); ctx.setLineDash([]);
      }
      if (st.id !== 'desk' && st.id !== 'meeting') text(st.label, st.x, st.y + st.r + 10, 11, 'rgba(255,255,255,.55)');
      // marker of what is waiting here
      if (t) emoji(t.kind === 'poo' ? '💩' : st.icon, st.x, st.y - 2, 22 + (t.kind === 'poo' ? 2 * Math.sin(now * 8) : 0));
    }
  }

  function drawProgress(s) {
    const p = s.player;
    if (!p.working) return;
    const t = s.tasks.find((x) => x.id === p.working);
    if (!t) return;
    const f = Math.min(1, t.progress / t.hold);
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = t.kind === 'poo' ? COL.warn : COL.good;
    ctx.beginPath(); ctx.arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function person(x, y, scale, o) {
    // o: { shirt, tie, hair, bald, bob, face, angry, hit }
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 11, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, o.bob);
    ctx.fillStyle = o.shirt; rrect(-10, -4, 20, 17, 6); ctx.fill();
    ctx.fillStyle = o.tie; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(3.5, 2); ctx.lineTo(0, 11); ctx.lineTo(-3.5, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = o.hit ? '#ff9a9a' : '#f1c9a0'; ctx.beginPath(); ctx.arc(0, -10, 9, 0, Math.PI * 2); ctx.fill();
    if (!o.bald) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.arc(0, -13, 9, Math.PI, 0); ctx.fill(); }
    else { ctx.fillStyle = o.hair; ctx.fillRect(-9, -11, 3, 3); ctx.fillRect(6, -11, 3, 3); }
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-3.2 + o.face, -10, 1.4, 0, Math.PI * 2); ctx.arc(3.2 + o.face, -10, 1.4, 0, Math.PI * 2); ctx.fill();
    if (o.angry) {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-6, -15); ctx.lineTo(-1, -12.5); ctx.moveTo(6, -15); ctx.lineTo(1, -12.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-3, -5.5); ctx.lineTo(3, -5.5); ctx.stroke();
    } else {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -7, 3, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoss(s, now) {
    const b = s.boss;
    const wind = b.state === 'windup';
    if (wind) {
      // telegraph line toward the player
      ctx.save(); ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,93,108,.55)';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(s.player.x, s.player.y); ctx.stroke(); ctx.restore();
    }
    const shakeX = wind ? Math.sin(now * 60) * 1.5 : 0;
    person(b.x + shakeX, b.y, 1.35, { shirt: '#2a2f3d', tie: '#e0303c', hair: '#8a8a8a', bald: true, bob: Math.sin(now * 8) * (wind ? 0 : 1), face: b.face * 1.2, angry: true });
    if (wind) {
      const k = 1 - b.windT / C.boss.windup;
      emoji('😠', b.x - 26, b.y - 30, 22);
      text('!', b.x, b.y - 46 - Math.sin(now * 25) * 2, 30 + k * 8, COL.bad, 'center', '900');
      emoji('🥪', b.x + 20 * b.face, b.y - 2, 16);
    } else {
      text('BOSS', b.x, b.y + 26, 10, 'rgba(255,255,255,.55)', 'center', '800');
    }
  }

  function drawProjectiles(s) {
    for (const pr of s.projectiles) {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 12, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      emoji('🥪', pr.x, pr.y, 24, pr.rot);
      emoji('💩', pr.x, pr.y - 1, 13, pr.rot);
    }
  }

  function drawSplats(s, now) {
    for (const sp of s.splats) {
      const a = sp.pickup ? 1 : Math.max(0, 1 - sp.age / sp.life);
      ctx.globalAlpha = a;
      ctx.fillStyle = COL.poo;
      ctx.beginPath(); ctx.ellipse(sp.x, sp.y + 3, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sp.x - 14, sp.y + 8, 3, 0, 7); ctx.arc(sp.x + 15, sp.y - 2, 4, 0, 7); ctx.arc(sp.x + 4, sp.y + 15, 3, 0, 7); ctx.fill();
      if (sp.pickup) {
        const f = 1 - sp.age / sp.life;
        emoji('💩', sp.x, sp.y - 4 + Math.sin(now * 6) * 2, 20);
        ctx.lineWidth = 3; ctx.strokeStyle = f < 0.3 ? COL.bad : COL.warn;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 24, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
        text('take it?', sp.x, sp.y - 30, 11, COL.warn, 'center', '700');
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawFx(dt) {
    for (const f of fx) {
      f.age += dt;
      const a = Math.max(0, 1 - f.age / 1.3);
      ctx.globalAlpha = a;
      ctx.font = `800 ${f.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y = f.y - f.age * 34;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
    fx = fx.filter((f) => f.age < 1.3);
  }

  function drawDebug(s) {
    ctx.lineWidth = 1; ctx.strokeStyle = '#0ff';
    for (const o of OBSTACLES) ctx.strokeRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = '#ff0';
    for (const st of Object.values(STATIONS)) { ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.stroke(); }
    ctx.strokeStyle = '#0f0';
    for (const e of [s.player, s.boss, ...s.projectiles]) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.stroke(); }
    if (s.path) { ctx.strokeStyle = '#f0f'; ctx.beginPath(); ctx.moveTo(s.player.x, s.player.y); for (const p of s.path) ctx.lineTo(p.x, p.y); ctx.stroke(); }
    if (s.target) { ctx.beginPath(); ctx.arc(s.target.x, s.target.y, 6, 0, 7); ctx.stroke(); }
  }

  // ---- HUD (screen space) ----
  function drawTopBar(s) {
    const L = inset.l, CW = W - inset.l - inset.r, T = inset.t, mid = T + TOP_H / 2;
    ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, W, T + TOP_H);
    const small = CW < 520;
    const fs = small ? 15 : 18;
    text(`🕘 ${clockString(s)}`, L + 12, mid, fs + 2, COL.text, 'left', '800');
    const sc = `⭐ ${s.score}`;
    text(sc, L + CW - 58, mid, fs + 2, COL.warn, 'right', '800');
    const bw = small ? CW - 246 : Math.min(380, CW - 280), bh = 18, bx = L + (small ? 104 : (CW - bw) / 2), by = mid - bh / 2;
    ctx.fillStyle = '#2a3042'; rrect(bx, by, bw, bh, 9); ctx.fill();
    const f = Math.max(0, Math.min(1, s.stress / C.stress.max));
    const col = f < 0.5 ? COL.good : f < 0.75 ? COL.warn : COL.bad;
    ctx.fillStyle = col; rrect(bx, by, Math.max(bh, bw * f), bh, 9); ctx.fill();
    text(`${bw < 110 ? '' : 'STRESS '}${Math.round(s.stress)}%`, bx + bw / 2, mid + 1, 11, '#0c0f16', 'center', '900');
    if (f > 0.8 && Math.floor(performance.now() / 250) % 2) { ctx.strokeStyle = COL.bad; ctx.lineWidth = 2; rrect(bx - 1, by - 1, bw + 2, bh + 2, 10); ctx.stroke(); }
    // day progress line
    ctx.fillStyle = '#5b6bff'; ctx.fillRect(0, T + TOP_H - 3, W * s.day, 3);
  }

  function drawTasks(s, now) {
    const P = layout.panel;
    if (P.h < 20) return;
    const overlay = layout.mode === 'overlay';
    ctx.save();
    ctx.fillStyle = overlay ? 'rgba(10,12,20,.78)' : 'rgba(255,255,255,.04)';
    rrect(P.x, P.y, P.w, P.h, 8); ctx.fill();
    const fs = overlay ? Math.max(10, 13 * layout.scale) : Math.max(13, Math.min(16, P.w / 24));
    const headH = fs + 8;
    text('TO-DO', P.x + 8, P.y + headH / 2 + 2, fs - 1, 'rgba(255,255,255,.5)', 'left', '800');
    const poo = s.tasks.filter((t) => t.kind === 'poo').sort((a, b) => a.timeLeft - b.timeLeft);
    const reg = s.tasks.filter((t) => t.kind === 'task');
    const list = [...poo, ...reg];
    const avail = P.h - headH - 4;
    const rowH = Math.max(fs * 1.9, Math.min(fs * 2.6, avail / 7));
    // two columns on wide panels (portrait phones)
    const cols = P.w > 420 ? 2 : 1;
    const colW = (P.w - 12) / cols;
    list.forEach((t, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = P.x + 6 + c * colW, y = P.y + headH + r * rowH;
      if (y + rowH > P.y + P.h + 1) return;
      const isPoo = t.kind === 'poo';
      const working = s.player.working === t.id;
      ctx.fillStyle = isPoo ? 'rgba(255,93,108,.22)' : 'rgba(255,255,255,.07)';
      rrect(x, y, colW - 4, rowH - 3, 5); ctx.fill();
      if (isPoo) { ctx.strokeStyle = COL.bad; ctx.lineWidth = 1.5; rrect(x, y, colW - 4, rowH - 3, 5); ctx.stroke(); }
      emoji(t.icon, x + fs * 0.9, y + (rowH - 3) / 2 - (isPoo ? 2 : 0), fs + 1);
      const st = STATIONS[t.station];
      emoji('→' , x + colW - 4 - fs * 2.6, y + (rowH - 3) / 2 - (isPoo ? 2 : 0), fs - 2);
      emoji(st.icon, x + colW - 4 - fs * 1.2, y + (rowH - 3) / 2 - (isPoo ? 2 : 0), fs);
      const lab = fitText(t.label, colW - 4 - fs * 4.6 - fs * 1.2, fs - 1, isPoo ? '800' : '600');
      text(lab, x + fs * 1.8, y + (rowH - 3) / 2 - (isPoo ? 2 : 0), fs - 1, isPoo ? '#ffd0d4' : COL.text, 'left', isPoo ? '800' : '600');
      // bar: deadline for poo, progress for regular
      const bw = colW - 4 - 8;
      if (isPoo) {
        const f = Math.max(0, t.timeLeft / t.deadline);
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x + 4, y + rowH - 8, bw, 3);
        ctx.fillStyle = f < 0.3 && Math.floor(now * 4) % 2 ? '#fff' : (f < 0.5 ? COL.bad : COL.warn);
        ctx.fillRect(x + 4, y + rowH - 8, bw * f, 3);
      } else if (t.progress > 0) {
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x + 4, y + rowH - 8, bw, 3);
        ctx.fillStyle = COL.good; ctx.fillRect(x + 4, y + rowH - 8, bw * Math.min(1, t.progress / t.hold), 3);
      }
      if (working) { ctx.strokeStyle = COL.good; ctx.lineWidth = 1.5; rrect(x, y, colW - 4, rowH - 3, 5); ctx.stroke(); }
    });
    if (!list.length) text('Inbox zero. Suspicious.', P.x + P.w / 2, P.y + headH + rowH / 2, fs - 1, 'rgba(255,255,255,.5)');
    ctx.restore();
  }

  function drawJoystick(input) {
    const j = input && input.joy;
    if (!j || !j.active) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(j.bx, j.by, j.radius, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(j.sx, j.sy, 22, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---- main draw ----
  function draw(s, nowMs, input) {
    const now = nowMs / 1000;
    const dt = Math.min(0.1, lastNow ? now - lastNow : 0.016);
    lastNow = now;
    fps = fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    shake = Math.max(0, shake - dt);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);

    ctx.save();
    const sx = shake > 0 ? (Math.random() - 0.5) * 8 * shake : 0;
    ctx.translate(layout.ox + sx, layout.oy);
    ctx.scale(layout.scale, layout.scale);
    ctx.beginPath(); ctx.rect(0, 0, WORLD.w, WORLD.h); ctx.clip();
    drawFloor();
    drawStations(s, now);
    for (const o of OBSTACLES) drawObstacle(o);
    drawCeoDecor();
    drawSplats(s, now);
    // y-sorted characters
    const p = s.player;
    const moving = Math.hypot(p.vx, p.vy) > 10;
    const chars = [
      { y: p.y, f: () => person(p.x, p.y, 1, { shirt: '#e9edf5', tie: '#3b82f6', hair: '#5a3a22', bob: moving ? Math.sin(now * 16) * 1.5 : 0, face: p.face * 1.2, angry: false, hit: p.hitFlash > 0 && Math.floor(now * 20) % 2 }) },
      { y: s.boss.y, f: () => drawBoss(s, now) },
    ].sort((a, b) => a.y - b.y);
    drawProgress(s);
    for (const c of chars) c.f();
    text('YOU', p.x, p.y + 22, 10, 'rgba(255,255,255,.6)', 'center', '800');
    drawProjectiles(s);
    drawFx(dt);
    if (s.flags.debug) drawDebug(s);
    ctx.restore();

    drawTopBar(s);
    drawTasks(s, now);
    drawJoystick(input);
    if (s.flags.debug) text(`${Math.round(fps)} fps  ${layout.mode} x${layout.scale.toFixed(2)}`, inset.l + 8, H - inset.b - 10, 12, '#0f0', 'left');
  }

  // Clear transient effects (floating texts, shake) when a new day starts.
  function reset() { fx = []; shake = 0; }

  return { resize, draw, handle, toWorld, reset, get layout() { return layout; } };
}
