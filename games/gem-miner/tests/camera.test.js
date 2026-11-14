import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, follow, clampCamera } from '../src/camera.js';

const view = { w: 20, h: 12 };

test('center mode keeps the miner in the middle', () => {
  const c = createCamera();
  follow(c, 100.5, 80.5, view, 256, 'center');
  assert.deepEqual([c.x, c.y], [90.5, 74.5]);
});

test('deadzone: no movement inside the box, follows when leaving it', () => {
  const c = { x: 90, y: 74 };
  follow(c, 100.5, 80.5, view, 256, 'deadzone');
  assert.deepEqual([c.x, c.y], [90, 74]);
  follow(c, 103.5, 80.5, view, 256, 'deadzone'); // right of the box
  assert.ok(c.x > 90 && c.y === 74);
  const hw = view.w * 0.16;
  assert.ok(Math.abs(103.5 - (c.x + view.w / 2) - hw) < 1e-9, 'miner sits on the box edge');
  const before = c.x;
  follow(c, 95, 80.5, view, 256, 'deadzone'); // far left
  assert.ok(c.x < before);
  follow(c, c.x + view.w / 2, 60, view, 256, 'deadzone'); // up
  assert.ok(c.y < 74);
  follow(c, c.x + view.w / 2, 110, view, 256, 'deadzone'); // down
  assert.ok(c.y > 74);
});

test('clamps to the world bounds on all sides, and centres a world smaller than the view', () => {
  const c = createCamera();
  follow(c, 0.5, 0.5, view, 256, 'center');
  assert.deepEqual([c.x, c.y], [0, 0]);
  follow(c, 255.5, 255.5, view, 256, 'center');
  assert.deepEqual([c.x, c.y], [256 - view.w, 256 - view.h]);
  follow(c, 255.5, 0.5, view, 256, 'deadzone');
  assert.deepEqual([c.x, c.y], [256 - view.w, 0]);
  const small = clampCamera({ x: 5, y: 5 }, { w: 40, h: 40 }, 30);
  assert.deepEqual([small.x, small.y], [-5, -5]);
});
