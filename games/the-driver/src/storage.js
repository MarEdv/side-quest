// localStorage for this game: the kit's wrapper (src/kit/storage.js) bound to this game's prefix (pure: the backend is
// passed in by main.js). Values are JSON; a missing or throwing backend falls back to memory, play never breaks.
import { createStorage as create } from './kit/storage.js';

export const KEY_PREFIX = 'the-driver.';
export const createStorage = (backend) => create(backend, KEY_PREFIX);
