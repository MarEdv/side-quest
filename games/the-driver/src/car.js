// The player's car (C-1..C-3, D6, D8). Pure: createPlayer + updatePlayer. x is metres from the road centre (right is
// positive), z metres along the road, speed m/s. `steer` (-1..1, smoothed) is for the steering wheel animation.
import { CFG } from './config.js';
import { clamp } from './core.js';
import { segmentAt, laneX } from './track.js';

const P = CFG.player;

// Starts in the middle lane of the highway (lane 1 of 3) or the player's lane of the country road (lane 1 of 2),
// at cruising speed.
export function createPlayer(track) {
  const lane = 1;
  return {
    x: laneX(track, lane), z: 0, speed: P.cruise, steer: 0, laneTarget: lane, offroad: false, crashTimer: 0, topSpeed: P.cruise,
    width: P.width, length: P.length, barrier: false,
  };
}

// Speed for one step: pedals=auto cruises to 110 km/h by itself (gas goes up to 180 km/h, letting go falls back to
// cruise); pedals=manual accelerates only with gas and coasts down without it. Brake wins over gas.
export function nextSpeed(v, flags, input, dt) {
  const auto = flags.pedals !== 'manual';
  if (input.brake) return Math.max(0, v - P.brake * dt);
  if (input.gas) return Math.min(P.topSpeed, v + P.accelGas * dt);
  if (auto) {
    if (v < P.cruise) return Math.min(P.cruise, v + P.accelAuto * dt);
    return Math.max(P.cruise, v - P.coastAuto * dt);
  }
  return Math.max(0, v - P.coastManual * dt);
}

// Advances the player one step. `crashTimer` > 0 locks the steering (the wheel returns to centre).
export function updatePlayer(p, track, flags, input, dt) {
  const locked = p.crashTimer > 0;
  if (locked) p.crashTimer = Math.max(0, p.crashTimer - dt);

  // speed
  p.speed = nextSpeed(p.speed, flags, input, dt);
  p.offroad = Math.abs(p.x) > track.halfWidth;
  if (p.offroad && p.speed > P.grassCap) p.speed = Math.max(P.grassCap, p.speed - P.grassDecel * dt);

  // steering
  let want = 0;
  if (flags.steer === 'lanes') {
    if (!locked) {
      if (input.leftPressed) p.laneTarget = Math.max(0, p.laneTarget - 1);
      if (input.rightPressed) p.laneTarget = Math.min(track.lanes - 1, p.laneTarget + 1);
    }
    const dx = laneX(track, p.laneTarget) - p.x;
    p.x += clamp(dx * P.laneGain, -P.laneMax, P.laneMax) * dt;
    want = locked ? 0 : clamp(dx / 1.5, -1, 1);
  } else {
    want = locked ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const curve = segmentAt(track, p.z).curve;
    const side = p.steer * p.speed * P.lateral - p.speed * p.speed * curve * P.drift;
    p.x += side * dt;
  }
  p.steer += clamp(want - p.steer, -P.steerRate * dt, P.steerRate * dt);

  // the barriers stop sideways movement; it is not a crash
  const wall = track.barrier;
  p.barrier = Math.abs(p.x) >= wall;
  p.x = clamp(p.x, -wall, wall);
  p.offroad = Math.abs(p.x) > track.halfWidth;

  p.z += p.speed * dt;
  if (p.speed > p.topSpeed) p.topSpeed = p.speed;
}
