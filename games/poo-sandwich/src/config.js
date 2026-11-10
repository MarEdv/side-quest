// Tunables. Pure data.
export const CONFIG = {
  world: { w: 960, h: 540 },
  player: { r: 12, speed: 170 },
  boss: { r: 17, speed: 70, windup: 0.6, wanderPause: [0.5, 1.5] },
  // Sandwich speed (px/s) and throw interval (s) ramp with day progress 0..1
  throwInterval: { start: 4.5, end: 1.8 },
  sandwichSpeed: { start: 150, end: 330 },
  sandwichSpread: 0.07, // radians
  sandwichLead: 0.25, // seconds of lead on player velocity
  sandwichR: 9,
  firstThrowDelay: 4,
  tasks: {
    maxActive: 4,
    spawnInterval: { start: 7, end: 4 },
    firstSpawns: 2,
    expireStress: 0, // regular tasks do not expire; they pile up
    pileStressPerSec: 0.35, // per task beyond 2 active
    points: 100,
    stressRelief: 4,
    coffeeRelief: 6,
  },
  poo: {
    deadline: 28,
    deadlineChoice: 36,
    hitStress: 8,
    expireStress: 25,
    points: 300,
    choicePoints: 450,
    ignoreStress: 4,
    floorLife: 9,
    maxActive: 3,
  },
  stress: { passiveRegen: 0.4, max: 100 },
  win: { bonusPerStress: 10 },
};
