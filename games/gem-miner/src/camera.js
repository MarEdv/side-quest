// Camera follow (pure). Positions are in tile units; `cam` is the top-left corner of the view.
export const DEADZONE = 0.16; // half-size of the dead box as a fraction of the view

export const createCamera = () => ({ x: 0, y: 0 });

function clampAxis(v, view, world) {
  if (view >= world) return (world - view) / 2; // world smaller than the view: centre it
  return Math.min(Math.max(v, 0), world - view);
}

export function clampCamera(cam, view, worldSize) {
  cam.x = clampAxis(cam.x, view.w, worldSize);
  cam.y = clampAxis(cam.y, view.h, worldSize);
  return cam;
}

// Move `cam` to follow a point (px, py) (the miner's centre). mode: 'deadzone' | 'center'.
export function follow(cam, px, py, view, worldSize, mode = 'deadzone', dz = DEADZONE) {
  if (mode === 'center') {
    cam.x = px - view.w / 2; cam.y = py - view.h / 2;
  } else {
    const hw = view.w * dz, hh = view.h * dz;
    const ox = px - (cam.x + view.w / 2), oy = py - (cam.y + view.h / 2);
    if (ox > hw) cam.x += ox - hw; else if (ox < -hw) cam.x += ox + hw;
    if (oy > hh) cam.y += oy - hh; else if (oy < -hh) cam.y += oy + hh;
  }
  return clampCamera(cam, view, worldSize);
}
