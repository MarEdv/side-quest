import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentIntersectsAABB, pointInCone, angleDiff, moveWithCollision, clamp } from '../src/geometry.js';

const box = { x: 10, y: 10, w: 10, h: 10 };

test('segment crossing a box intersects', () => {
  assert.equal(segmentIntersectsAABB(0, 15, 30, 15, box), true);
  assert.equal(segmentIntersectsAABB(0, 0, 30, 30, box), true);
});
test('segment missing the box does not intersect', () => {
  assert.equal(segmentIntersectsAABB(0, 0, 30, 5, box), false);
  assert.equal(segmentIntersectsAABB(0, 25, 30, 25, box), false);
  assert.equal(segmentIntersectsAABB(0, 15, 5, 15, box), false); // stops short
});
test('segment starting inside intersects; vertical/degenerate handled', () => {
  assert.equal(segmentIntersectsAABB(15, 15, 100, 100, box), true);
  assert.equal(segmentIntersectsAABB(15, 0, 15, 30, box), true);
  assert.equal(segmentIntersectsAABB(5, 0, 5, 30, box), false);
  assert.equal(segmentIntersectsAABB(0, 0, 0, 0, box), false);
});

test('cone check: angle and range', () => {
  const fov = (70 * Math.PI) / 180;
  const down = Math.PI / 2;
  assert.equal(pointInCone(0, 0, down, fov, 100, 0, 50), true);
  assert.equal(pointInCone(0, 0, down, fov, 100, 0, 150), false); // too far
  assert.equal(pointInCone(0, 0, down, fov, 100, 50, 0), false); // 90deg off
  assert.equal(pointInCone(0, 0, down, fov, 100, 20, 50), true); // ~22 deg
  assert.equal(pointInCone(0, 0, down, fov, 100, 40, 50), false); // ~39 deg > 35
});

test('angleDiff wraps', () => {
  assert.ok(Math.abs(angleDiff(Math.PI - 0.1, -Math.PI + 0.1) + 0.2) < 1e-9);
  assert.equal(clamp(5, 0, 3), 3);
});

test('moveWithCollision stops at rects and bounds, slides along walls', () => {
  const wall = { x: 50, y: 0, w: 10, h: 100 };
  const p = { x: 40, y: 50 };
  moveWithCollision(p, 20, 5, 8, [wall], { w: 200, h: 100 });
  assert.equal(p.x, 40);
  assert.equal(p.y, 55);
  const q = { x: 5, y: 5 };
  moveWithCollision(q, -50, -50, 8, [], { w: 200, h: 100 });
  assert.deepEqual(q, { x: 8, y: 8 });
});
