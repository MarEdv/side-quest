// Seeded PRNG (mulberry32). Pure. The code lives in the shared kit (src/kit/rng.js, from the repo's kit/rng.js);
// this file keeps the game's import path. Sequences are pinned by tests/rng-golden.test.js.
export { createRng } from './kit/rng.js';
