// Every tuning number of Train Attendant in one frozen object (D8, D10). Pure data, no logic.
// Units: x runs along the train in metres, 0 at the rear and growing towards the cab at the front (the right of the
// screen). Time is in seconds of game time. Stress is 0..100. Rates are per second. See docs/DECISIONS.md D10..
const freeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v);
  return Object.freeze(o);
};

export const CFG = freeze({
  fps: 60,
  dt: 1 / 60,

  // Layout of the train (train.js). A passenger car is vestibule + 5 rows + vestibule = 14 m; the café car has the
  // same length without seats (the counter is in the middle); the cab at the front is 4 m.
  train: {
    rowsPerCar: 5, rowSpacing: 2, seatsPerRow: 4, vestibule: 2, cabLength: 4,
    spotsPerVestibule: 4, spotSpacing: 0.4, spotOffset: 0.35, // standing places: metres from the car end
  },

  attendant: {
    speed: 7,          // m/s
    reach: 1.1,        // how far from a passenger / the counter / a bag the action works
    rowReach: 1.0,     // how close to a row's x the attendant must be to seat a follower
    followSpeed: 6.5,  // followers catch up a little faster than the attendant walks
    followGap: 0.9,    // spacing between followers behind the attendant
    maxFollowers: 4,
  },

  hold: { ticket: 0.6, question: 1.2, radio: 1.5, talk: 1.5 },

  trips: {
    short: { stations: 4, leg: 45, needScale: 1 },
    normal: { stations: 6, leg: 60, needScale: 1 },
    long: { stations: 8, leg: 70, needScale: 1.5 }, // longer trips give passengers longer between needs: slips compound
  },
  dwell: 8,            // seconds at every station
  dwellRecover: 5,     // delay won back at each departure, at most
  delayStressScale: 180, // stress rate multiplier is 1 + min(delay, delayStressCap) / scale
  delayStressCap: 90,

  // Per difficulty (S-5). board = share of the seats that board at each station, first = at the first station,
  // firstNeed = seconds from the ticket check (or being seated, for a rescued passenger) to the first other need,
  // need = seconds between a calm passenger's later needs, stress = multiplier on how fast stress rises,
  // slipChance / slipMax = a leg may take up to slipMax seconds longer (adds to the delay).
  difficulty: {
    easy: { board: 0.12, first: 0.25, firstNeed: [15, 60], need: [120, 200], stress: 0.5, slipChance: 0.2, slipMax: 10 },
    normal: { board: 0.14, first: 0.28, firstNeed: [12, 55], need: [80, 130], stress: 0.85, slipChance: 0.3, slipMax: 15 },
    hard: { board: 0.19, first: 0.35, firstNeed: [10, 45], need: [60, 110], stress: 1, slipChance: 0.4, slipMax: 25 },
  },
  boardJitter: [0.85, 1.15],
  carScale: 0.5,         // the boarding shares are for 3 cars; they are multiplied by (3 / cars) ^ carScale

  stress: {
    start: [0, 15],      // a boarder's stress
    rate: { ticket: 1.2, coffee: 1.7, snack: 1.6, question: 2.0, seat: 1.0 }, // per second while the need is unmet
    standing: 1.5,       // rising stress is multiplied by this for standing passengers
    standIdle: 0.3,      // standing without a need still raises stress
    calmDecay: 1.0,      // seated and no need: stress falls this fast
    relief: 25,          // stress removed when a need is met
    seatRelief: 15,
    complaintAt: 100, afterComplaint: 45,
    contagious: { above: 70, range: 4, rate: 0.5 }, // flag stress=contagious: per source, per second
    calmBelow: 30,       // leaves "calm" under this
  },

  needs: {
    weights: { coffee: 0.25, snack: 0.2, question: 0.55 },
    ticketDelay: [1, 5], // seconds after boarding until the ticket bubble shows
    giveUp: ['coffee', 'snack', 'question'], // a complaint ends these needs (the points are lost); tickets and seats stay
  },

  points: {
    ticket: 10, coffee: 14, snack: 12, question: 10, seat: 6, calm: 8,
    complaint: -30, lostFare: -15,
  },

  // Stars: score / potential (everything that was on offer: needs, calm arrivals, offered quests).
  // 5 stars is close to flawless play (D39).
  stars: [0.1, 0.35, 0.8, 0.95], // ratios for 2, 3, 4, 5 stars; below the first is 1 star

  quests: {
    mode: { offer: 'offer', assign: 'assign' },
    offerEvery: [30, 45], offerExpire: 15, maxActive: 2, retryAfter: 5,
    weights: { rescue: 1, connection: 1, nervous: 1, lost: 1, sick: 1 },
    calmInvolved: 30,    // stress taken off passengers involved in a completed quest
    rescue: { count: [4, 8], stop: 10, delay: 20, stress: 45, stopAt: 0.5, thisLegBefore: 0.4, spareSeats: 2, reward: 150, penalty: -80 },
    connection: { ahead: [1, 3], holdLimit: 45, minEta: 25, reward: 100, rebookedShare: 0.5, penalty: -50 },
    nervous: { stress: 80, riseMult: 3, idleRise: 0.3, talks: 3, gap: 6, talkRelief: 15, minEta: 30, reward: 80, penalty: -50 },
    lost: { minEta: 40, reward: 90, penalty: -50 },
    sick: { limit: 45, minEta: 55, stress: 20, reward: 100, penalty: -60 },
  },
});

export const TRIP_NAMES = Object.freeze(Object.keys(CFG.trips));
export const DIFFICULTIES = Object.freeze(Object.keys(CFG.difficulty));
export const QUEST_TYPES = Object.freeze(Object.keys(CFG.quests.weights));
