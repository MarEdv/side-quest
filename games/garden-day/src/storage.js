// localStorage for this game: the kit's wrapper (src/kit/storage.js, root D-11) bound to this game's prefix. Pure: no
// DOM; the browser backend is passed in by main.js. Values are JSON; when the backend is missing or throws, they live in
// memory for the rest of the session so the game never breaks (HS-1).
// What the kit changed here (D-34, amends the storage part of D-22): a refused write is no longer final for the session.
// Every later write tries the backend again and also delivers what was refused earlier, and `persistent` turns true
// again once everything written this session is stored. Keys and stored formats are unchanged.
import { createStorage as create } from './kit/storage.js';

export const KEY_PREFIX = 'sidequest.v1.'; // legacy name; never change it: players' progress lives under it
export const createStorage = (backend) => create(backend, KEY_PREFIX);
