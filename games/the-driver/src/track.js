// The road (G-3, G-4, D2, D8). Pure and seeded: the same seed and flags give the same road. The road is a list of
// segments of CFG.track.segLen metres; each has a curvature (-1 left .. 1 right, curves push the car outward), a height
// y in metres and roadside scenery. The stage of a drive is the third of the time (stageAt); the scenery of the road is
// laid out per stage by metres (`stageZ`: where the stages start for a drive at ~CFG.track.stageSpeed).
import { CFG, STAGE_NAMES } from './config.js';
import { createRng } from './kit/rng.js';

const T = CFG.track;
const smooth = (u) => u * u * (3 - 2 * u);

// 0, 1 or 2: the drive's three equal parts of time (a time past the end counts as the last stage).
export function stageAt(time, duration) {
  if (!(duration > 0)) return 0;
  return Math.min(CFG.stages - 1, Math.max(0, Math.floor((time / duration) * CFG.stages)));
}

export const stageName = (stage) => STAGE_NAMES[Math.min(CFG.stages - 1, Math.max(0, stage))];

function drawSection(rng) {
  const entries = Object.entries(T.sections);
  let r = rng.next() * entries.reduce((n, [, v]) => n + v.weight, 0);
  for (const [kind, v] of entries) { r -= v.weight; if (r < 0) return [kind, v]; }
  return entries[0];
}

// Curvature per segment: straights, curves and long sweepers; a curve eases in over the first and out over the last
// CFG.track.ease of its length.
function buildCurves(count, rng) {
  const curve = new Array(count).fill(0);
  let i = 12; // the first stretch is straight
  while (i < count) {
    const [kind, sec] = drawSection(rng);
    const len = rng.int(...sec.len);
    if (kind !== 'straight') {
      const amp = rng.range(...sec.amp) * (rng.chance(0.5) ? 1 : -1);
      const e = Math.max(1, Math.floor(len * T.ease));
      for (let k = 0; k < len && i + k < count; k++) {
        const u = k < e ? smooth(k / e) : k >= len - e ? smooth((len - 1 - k) / e) : 1;
        curve[i + k] = Math.round(amp * u * 1000) / 1000;
      }
    }
    i += len;
  }
  return curve;
}

// Height per segment: smooth interpolation between random height points.
function buildHeights(count, rng) {
  const y = new Array(count).fill(0);
  let from = 0, h0 = 0;
  while (from < count) {
    const len = rng.int(...T.hill.spacing);
    const h1 = from === 0 ? rng.range(...T.hill.height) * 0.3 : rng.range(...T.hill.height);
    for (let k = 0; k < len && from + k < count; k++) y[from + k] = Math.round((h0 + (h1 - h0) * smooth(k / len)) * 100) / 100;
    from += len; h0 = h1;
  }
  return y;
}

function buildScenery(index, stage, halfWidth, rng) {
  const out = [];
  for (const [kind, def] of Object.entries(CFG.scenery[stage])) {
    for (const side of [-1, 1]) {
      if (!rng.chance(def.p)) continue;
      out.push({ kind, side, offset: Math.round((halfWidth + rng.range(...def.near)) * 10) / 10, size: Math.round(rng.next() * 100) / 100 });
    }
  }
  return out;
}

// createTrack(seed, flags) → { seed, road, segLen, segments: [{ index, z, curve, y, scenery: [{ kind, side, offset, size }] }],
//   length, lanes, laneWidth, halfWidth, barrier, stageZ: [z of stage 1, z of stage 2] }
// `offset` is the metres from the road's centre line to the object (always beyond the barrier), `side` -1 left / 1 right.
export function createTrack(seed, flags = {}) {
  const road = flags.road === 'country' ? 'country' : 'highway';
  const duration = CFG.length[flags.length] || CFG.length.normal;
  const lanes = T.lanes[road];
  const halfWidth = (lanes * T.laneWidth) / 2;
  const length = duration * CFG.player.topSpeed + T.extra;
  const count = Math.ceil(length / T.segLen);
  const rng = createRng(((Number(seed) >>> 0) ^ 0x5bd1e995) >>> 0);
  const curve = buildCurves(count, rng);
  const height = buildHeights(count, rng);
  const stageZ = [1, 2].map((n) => Math.round((duration * n * T.stageSpeed) / CFG.stages / T.segLen) * T.segLen);
  const segments = [];
  for (let index = 0; index < count; index++) {
    const z = index * T.segLen;
    const stage = z >= stageZ[1] ? 2 : z >= stageZ[0] ? 1 : 0;
    segments.push({ index, z, curve: curve[index], y: height[index], scenery: buildScenery(index, stage, halfWidth, rng) });
  }
  return { seed, road, segLen: T.segLen, segments, length: count * T.segLen, lanes, laneWidth: T.laneWidth, halfWidth, barrier: halfWidth + T.barrier, stageZ };
}

// The segment under distance z (clamped to the road).
export function segmentAt(track, z) {
  const i = Math.floor(z / track.segLen);
  return track.segments[Math.min(track.segments.length - 1, Math.max(0, i))];
}

// The height of the road at distance z, interpolated between segment starts.
export function heightAt(track, z) {
  const i = Math.min(track.segments.length - 1, Math.max(0, Math.floor(z / track.segLen)));
  const a = track.segments[i], b = track.segments[Math.min(track.segments.length - 1, i + 1)];
  const u = Math.min(1, Math.max(0, (z - a.z) / track.segLen));
  return a.y + (b.y - a.y) * u;
}

// The scenery stage laid out at distance z (the stage boundaries in metres are track.stageZ).
export const stageAtZ = (track, z) => (z >= track.stageZ[1] ? 2 : z >= track.stageZ[0] ? 1 : 0);

// x of a lane's centre line: lane 0 is the leftmost. Highway -3.6 0 3.6, country -1.8 (oncoming) 1.8.
export const laneX = (track, lane) => (lane - (track.lanes - 1) / 2) * track.laneWidth;
// The lane a given x is in (nearest centre, clamped to the road).
export const laneAt = (track, x) => Math.min(track.lanes - 1, Math.max(0, Math.round(x / track.laneWidth + (track.lanes - 1) / 2)));
