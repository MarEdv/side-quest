// The train's layout (T-1, D2): cars, rows, seats, standing places, café counter and cab, as plain data, plus the lookups
// from an x position (metres, 0 at the rear, the cab at the largest x). Pure.
import { CFG } from './config.js';

const T = CFG.train;
export const CAR_LENGTH = T.vestibule * 2 + T.rowsPerCar * T.rowSpacing;

// carCount passenger cars with the café car inserted after the first half, then the cab: P P [C] P  (3 cars).
export function buildTrain(carCount) {
  const cafeAt = Math.floor((carCount + 1) / 2); // index in the car list
  const cars = [], rows = [], seats = [], spots = [];
  let x = 0, pcar = 0;
  for (let i = 0; i <= carCount; i++) {
    const kind = i === cafeAt ? 'cafe' : 'car';
    const car = { index: i, kind, number: kind === 'car' ? ++pcar : 0, start: x, end: x + CAR_LENGTH };
    cars.push(car);
    if (kind === 'car') {
      for (let r = 0; r < T.rowsPerCar; r++) {
        const row = { id: rows.length, car: i, index: r, x: x + T.vestibule + T.rowSpacing * (r + 0.5), seats: [] };
        for (let s = 0; s < T.seatsPerRow; s++) {
          const seat = { id: seats.length, row: row.id, car: i, x: row.x, side: s < 2 ? 'L' : 'R', slot: s % 2 };
          seats.push(seat); row.seats.push(seat.id);
        }
        rows.push(row);
      }
    }
    for (let k = 0; k < T.spotsPerVestibule; k++) { // standing places, rear vestibule then front vestibule
      spots.push({ id: spots.length, car: i, x: x + T.spotOffset + k * T.spotSpacing, end: 'rear' });
      spots.push({ id: spots.length, car: i, x: x + CAR_LENGTH - T.spotOffset - k * T.spotSpacing, end: 'front' });
    }
    x += CAR_LENGTH;
  }
  const cafe = cars[cafeAt];
  const cab = { start: x, end: x + T.cabLength };
  return {
    carCount, cars, rows, seats, spots, cafeCar: cafeAt,
    counterX: (cafe.start + cafe.end) / 2,
    cab: { ...cab, x: (cab.start + cab.end) / 2, reach: T.cabLength / 2 + 0.5 },
    length: cab.end,
  };
}

// The car (or cab, as { kind: 'cab' }) at x.
export function carAt(train, x) {
  if (x >= train.cab.start) return { kind: 'cab', index: train.cars.length, start: train.cab.start, end: train.cab.end, number: 0 };
  const i = Math.min(train.cars.length - 1, Math.max(0, Math.floor(x / CAR_LENGTH)));
  return train.cars[i];
}

// The row whose x is nearest to x and within `reach`, or null.
export function rowAt(train, x, reach = CFG.attendant.rowReach) {
  let best = null, bd = Infinity;
  for (const row of train.rows) {
    const d = Math.abs(row.x - x);
    if (d <= reach && d < bd) { best = row; bd = d; }
  }
  return best;
}

export const clampX = (train, x) => Math.min(train.length, Math.max(0, x));
export const seatCount = (train) => train.seats.length;
// Passenger car number (1-based, as printed in "car 2") of the car at x; 0 in the café car and the cab.
export const carNumberAt = (train, x) => carAt(train, x).number;
// A random-looking but fixed list of the passenger cars, front first: for rescue boarding.
export const frontCars = (train) => train.cars.filter((c) => c.kind === 'car').reverse();
