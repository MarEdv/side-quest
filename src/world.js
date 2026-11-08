// Static world layout. Pure data; render.js draws it, game logic collides with it.
export const W = 960;
export const H = 540;

export function createWorld() {
  const obstacles = [
    { id: 'house', kind: 'house', x: 0, y: 0, w: 960, h: 100, blocksSight: true },
    { id: 'shed', kind: 'shed', x: 760, y: 150, w: 110, h: 90, blocksSight: true },
    { id: 'hedgeA', kind: 'hedge', x: 250, y: 180, w: 160, h: 30, blocksSight: true },
    { id: 'hedgeB', kind: 'hedge', x: 600, y: 300, w: 30, h: 140, blocksSight: true },
    { id: 'hedgeC', kind: 'hedge', x: 60, y: 390, w: 140, h: 30, blocksSight: true },
    { id: 'tree', kind: 'tree', x: 400, y: 340, w: 30, h: 30, blocksSight: true },
    { id: 'car', kind: 'car', x: 800, y: 420, w: 120, h: 70, blocksSight: false },
    { id: 'bench', kind: 'bench', x: 90, y: 288, w: 60, h: 24, blocksSight: false },
  ];
  return {
    width: W,
    height: H,
    obstacles,
    house: { x: 0, y: 0, w: 960, h: 100 },
    patio: { x: 400, y: 100, w: 160, h: 50 },
    door: { x: 480, y: 118 },
    wifePos: { x: 480, y: 128 },
    // Routes the wife may walk in `wifeRoam` mode: from wifePos through each point in order; she looks
    // around at the last one and retraces the route home. Every leg is a clear straight line
    // (tests/wife.test.js checks this) and together the six spots cover the yard.
    wifeRoutes: [
      [{ x: 200, y: 150 }, { x: 200, y: 250 }],
      [{ x: 380, y: 310 }],
      [{ x: 480, y: 420 }, { x: 350, y: 450 }],
      [{ x: 700, y: 230 }, { x: 700, y: 300 }],
      [{ x: 200, y: 150 }, { x: 220, y: 330 }],
      [{ x: 700, y: 230 }, { x: 840, y: 360 }],
    ],
    playerStart: { x: 480, y: 300 },
    curb: { x: 0, y: 512, w: 960, h: 28 },
    // Decorative-only things (not collidable)
    decor: {
      mailbox: { x: 50, y: 496 },
      bins: { x: 240, y: 478 },
      treeCanopy: { x: 415, y: 335, r: 44 },
    },
  };
}
