// Every tuning number of The Driver in one frozen object (D8, D10+). Pure data, no logic.
// Units: metres, seconds, m/s. x is metres from the road centre (positive = right), z metres along the road (the
// start is 0). The UI shows km/h (1 m/s = 3.6 km/h). See docs/DECISIONS.md D10..
const freeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v);
  return Object.freeze(o);
};

export const CFG = freeze({
  fps: 60,
  dt: 1 / 60,

  length: { normal: 180, short: 60 }, // seconds of game time per drive (flag `length`), G-1
  stages: 3,                          // three equal parts: afternoon, sunset, night (G-2)

  // The road (track.js). Segments are 5 m. A lane is 3.6 m: highway lane centres -3.6, 0, 3.6; country -1.8, 1.8.
  track: {
    segLen: 5,
    laneWidth: 3.6,
    lanes: { highway: 3, country: 2 },
    barrier: 2.5,        // the barriers stand this far outside the asphalt edge (halfWidth + barrier)
    extra: 2000,         // road beyond what the drive can use at top speed (draw distance)
    stageSpeed: 32,      // m/s: the speed the scenery stages are laid out for (the stage boundary in metres)
    // Sections of the road: length in segments, curvature amplitude (|curve| 0..1, sign random), weight in the draw.
    sections: {
      straight: { len: [18, 55], weight: 3 },
      curve: { len: [28, 70], amp: [0.25, 0.95], weight: 4 },
      sweeper: { len: [60, 110], amp: [0.15, 0.4], weight: 2 }, // long gentle bend
    },
    ease: 0.3,           // share of a curve section used to ease in and again to ease out
    hill: { spacing: [50, 120], height: [0, 12] }, // metres between height points (in segments), the height range in m
  },

  // Scenery per stage, as a share of the segments (per side) and the distance from the road centre line, in metres
  // beyond the asphalt edge (`near`). `size` 0..1 is a random scale for the renderer.
  scenery: [
    { tree: { p: 0.22, near: [5, 30] }, fence: { p: 0.5, near: [3.5, 3.5] }, field: { p: 0.04, near: [10, 40] } },
    { pine: { p: 0.4, near: [4.5, 28] }, rock: { p: 0.08, near: [4, 15] } },
    { lamp: { p: 0.17, near: [3.5, 3.5] }, building: { p: 0.14, near: [8, 32] } }, // lamp every ~6th segment (30 m)
  ],

  // The player's car (car.js).
  player: {
    width: 1.9, length: 4.4,
    topSpeed: 50,        // 180 km/h
    cruise: 30.6,        // 110 km/h, the auto cruising speed
    grassCap: 16.7,      // 60 km/h off the asphalt
    grassDecel: 30,      // m/s^2 towards the cap
    accelAuto: 5,        // m/s^2 up to cruise with pedals=auto and no gas
    accelGas: 6,         // m/s^2 with gas held (auto above cruise, manual everywhere)
    coastAuto: 3,        // m/s^2 slowing down to cruise after letting go of the gas (auto)
    coastManual: 2,      // m/s^2 slowing down with no pedal (manual)
    brake: 22,           // m/s^2
    steerRate: 7,        // how fast the smoothed steer follows the input (per second)
    lateral: 0.25,       // free steering: sideways m/s per m/s of speed at full steer
    drift: 0.0045,       // centrifugal: sideways m/s = speed^2 * curve * drift (outward)
    laneGain: 9, laneMax: 10, // lanes steering: x follows the target lane at gain/s, at most laneMax m/s
  },

  // Crashes (S-1) and scoring (S-2).
  crash: {
    speedMult: 0.25,     // speed after a crash
    timer: 1.2,          // steering locked for this long
    carCooldown: 1.5,    // the same car cannot crash the player again for this long
    shoveSpeed: 3,       // a car hit from behind is shoved forward this fast (m/s added)
    sidePush: 1.2,       // sideways shove of a car hit from the side or head on (m); the player gets a third
    hardLimit: 3,        // crash=hard: the 3rd crash wrecks the car
  },
  score: {
    perMetre: 0.1,       // 1 point per 10 m
    nearMiss: 25,        // base bonus
    streakEvery: 3,      // multiplier = 1 + floor(streak / streakEvery), capped
    maxMult: 5,
    penalty: 100,        // per crash
    nearGap: 0.8,        // m of clear space between the cars at the closest point (steer=free)
    nearGapLanes: 1.8,   // steer=lanes: passing in the next lane counts, for half the bonus
    lanesBonus: 0.5,
    nearSpeed: 16.7,     // the player must be faster than this (60 km/h)
  },
  // Stars from points per second of the drive's full length: [2, 3, 4, 5 stars]; below the first is 1 star.
  stars: [1.2, 3, 5.5, 8],

  difficulty: {
    easy: { density: 0.7, laneChange: 0.6 },
    normal: { density: 1, laneChange: 1 },
    hard: { density: 1.35, laneChange: 1.5 },
  },

  // Traffic (traffic.js).
  traffic: {
    sizes: { car: { width: 1.9, length: 4.4 }, van: { width: 2.1, length: 5.6 }, truck: { width: 2.5, length: 10 } },
    palette: ['#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#ecf0f1', '#7f8c8d', '#e67e22', '#8e44ad', '#2c3e50', '#16a085'],
    // Cars per 100 m of a lane, per stage (multiplied by the difficulty's density and the lane weight).
    density: {
      highway: [0.5, 0.78, 1.1],
      countrySame: [0.3, 0.45, 0.62],
      countryOncoming: [0.45, 0.68, 0.95],
    },
    laneWeight: [0.8, 1, 1.2], // highway lanes left to right
    // Share of trucks and vans per stage (the rest are cars); country roads have more trucks.
    kinds: { highway: [[0.1, 0.12], [0.16, 0.14], [0.2, 0.14]], country: [[0.25, 0.15], [0.3, 0.15], [0.3, 0.15]] },
    // Cruising speed ranges in m/s. Highway per lane (left, middle, right); a truck is slower, a van a bit slower.
    speeds: {
      highway: [[26, 33], [21, 27], [16.5, 22]],
      truck: [15.5, 20],
      countrySame: [20, 26], countryTruck: [13.5, 17], countryOncoming: [18, 27],
      van: -1.5,
    },
    spawnMin: 320, spawnMax: 450,       // ahead of the player: out of sight (the renderer draws cars up to ~320 m)
    behindMin: 80, behindMax: 120,      // faster highway cars appear this far behind
    behindEvery: [9, 18],               // seconds between tries (divided by the stage number + 1 ... see traffic.js)
    behindFaster: [3, 8],               // they come up this much faster than the player (m/s)
    behindSpeed: [28, 40],
    despawnBehind: 150, despawnAhead: 600,
    window: 600,                        // the stretch ahead in which the density is held
    minSpacing: 55,                     // no spawn within this of another car in the lane
    startMin: 90,                       // at the start nothing is closer than this ahead
    spawnCooldown: [0.4, 1.4],
    // Following: gap to keep = minGap + speed * headway; speed follows the leader's + (gap - safe) * pull.
    minGap: 6, headway: 1.2, pull: 0.4, accel: 2, decel: 9, brakeFlag: 1,
    latMargin: 0.5,                     // a car is "in my lane" when its edges are within this of mine
    // Lane changes (highway).
    blink: 1.2, slide: 1.5, cooldown: [4, 9],
    changeBlocked: 0.6, changeFree: 0.012, // chances per second
    recenter: 1.2,                      // m/s back to the lane centre after a shove
    gapAhead: 10, gapBehind: 12, closeAhead: 1.5, closeBehind: 2.2, // free-gap test: metres + seconds of closing speed
  },
});

export const LENGTHS = Object.freeze(Object.keys(CFG.length));
export const DIFFICULTIES = Object.freeze(Object.keys(CFG.difficulty));
export const ROADS = Object.freeze(Object.keys(CFG.track.lanes));
export const STAGE_NAMES = Object.freeze(['afternoon', 'sunset', 'night']);
export const KINDS = Object.freeze(Object.keys(CFG.traffic.sizes));
