import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrain, carAt, rowAt, clampX, CAR_LENGTH, frontCars } from '../src/train.js';

test('3 cars: 15 rows of 4 seats, a café car in the middle, a cab at the front', () => {
  const t = buildTrain(3);
  assert.equal(t.cars.length, 4);
  assert.deepEqual(t.cars.map((c) => c.kind), ['car', 'car', 'cafe', 'car']);
  assert.deepEqual(t.cars.map((c) => c.number), [1, 2, 0, 3]);
  assert.equal(t.rows.length, 15);
  assert.equal(t.seats.length, 60);
  assert.equal(CAR_LENGTH, 14);
  assert.equal(t.cab.start, 56);
  assert.equal(t.length, 60);
});

test('2 and 4 cars', () => {
  assert.equal(buildTrain(2).seats.length, 40);
  assert.deepEqual(buildTrain(2).cars.map((c) => c.kind), ['car', 'cafe', 'car']);
  assert.equal(buildTrain(4).seats.length, 80);
  assert.equal(buildTrain(4).cars.filter((c) => c.kind === 'cafe').length, 1);
});

test('seats: two on each side of the aisle, rows evenly spaced, one counter in the café car', () => {
  const t = buildTrain(3);
  const row = t.rows[0];
  assert.deepEqual(row.seats.map((id) => t.seats[id].side), ['L', 'L', 'R', 'R']);
  assert.equal(t.rows[1].x - row.x, 2);
  assert.equal(row.x, 3);
  const cafe = t.cars[t.cafeCar];
  assert.equal(t.counterX, (cafe.start + cafe.end) / 2);
  assert.equal(t.seats.filter((s) => s.car === t.cafeCar).length, 0);
  assert.ok(t.cab.reach > 2);
});

test('standing places are in the vestibules of every car', () => {
  const t = buildTrain(3);
  assert.equal(t.spots.length, 4 * 8);
  for (const sp of t.spots) {
    const c = t.cars[sp.car];
    const d = Math.min(sp.x - c.start, c.end - sp.x);
    assert.ok(d >= 0 && d < 2, `spot ${sp.id} at ${sp.x}`);
  }
});

test('carAt, rowAt and clampX', () => {
  const t = buildTrain(3);
  assert.equal(carAt(t, 0).index, 0);
  assert.equal(carAt(t, 13.9).index, 0);
  assert.equal(carAt(t, 14).index, 1);
  assert.equal(carAt(t, t.counterX).kind, 'cafe');
  assert.equal(carAt(t, 57).kind, 'cab');
  assert.equal(carAt(t, 999).kind, 'cab');
  assert.equal(carAt(t, -3).index, 0);
  assert.equal(rowAt(t, 3.2).id, 0);
  assert.equal(rowAt(t, 4.1).id, 1);
  assert.equal(rowAt(t, 1), null); // vestibule
  assert.equal(rowAt(t, t.counterX), null);
  assert.equal(clampX(t, -5), 0);
  assert.equal(clampX(t, 100), 60);
});

test('frontCars lists the passenger cars from the front', () => {
  assert.deepEqual(frontCars(buildTrain(3)).map((c) => c.number), [3, 2, 1]);
});
