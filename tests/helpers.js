import { createGame } from '../src/game.js';
import { DEFAULT_FLAGS } from '../src/config.js';

export const NO_INPUT = { up: false, down: false, left: false, right: false, action: false, pause: false, start: false, restart: false };
export const mkFlags = (o = {}) => ({ ...DEFAULT_FLAGS, seed: 1, sound: false, ...o });
export function playing(o = {}) { return createGame(mkFlags(o), 'playing'); }
