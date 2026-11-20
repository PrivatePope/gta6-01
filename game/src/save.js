// Saving: the game autosaves to this browser's localStorage after missions,
// fares, finds and purchases, and loads on the next visit. A save that does
// not parse is ignored, and the game starts fresh.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const p = state.player;
    const found = state.city.postcards
      .filter((c) => c.found)
      .map((c) => `${Math.round(c.x)},${Math.round(c.y)}`);
    const data = {
      x: Math.round(p.x),
      y: Math.round(p.y),
      cash: Math.round(p.cash),
      hp: Math.round(p.hp),
      armor: Math.round(p.armor),
      weapon: p.weapon,
      ammo: p.ammo,
      owned: p.owned,
      missionsDone: state.missionsDone,
      stats: state.stats,
      postcards: found,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off (private windows): the game just does not persist.
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.x !== 'number' || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
