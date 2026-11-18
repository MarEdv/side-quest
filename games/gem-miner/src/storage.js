// localStorage for this game: the kit's wrapper (src/kit/storage.js, root D-11) bound to this game's prefix (pure: the
// backend is passed in by main.js). Values are JSON; when the backend is missing or throws (private mode, quota), they
// live in memory for the session so play never breaks (G-3), and every write tries the backend again (D24).
// What the kit changed here (D32, amends the storage part of D24): a key that is safely stored is read from the backend,
// not from memory, so another tab's change is seen; a write that succeeds also delivers keys refused earlier; and
// `persistent` means "everything written this session is stored", not "the last write worked". Keys and formats are
// unchanged.
import { createStorage as create } from './kit/storage.js';

export const KEY_PREFIX = 'gem-miner.';
export const createStorage = (backend) => create(backend, KEY_PREFIX);
