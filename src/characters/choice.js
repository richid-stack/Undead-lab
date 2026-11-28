/**
 * choice.js
 * What the player chose to wear, per hero, remembered in the browser (localStorage; it works without it, the choices just are not kept).
 */
import { PEOPLE } from './people.js';

const KEY = 'oninight.wear.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } };

/** a hero's spec with the player's saved wardrobe choices applied */
export const specOf = id => ({ ...PEOPLE[id], ...(load()[id] || {}) });
/** remember one choice (slot: 'hair' | 'outfit' | 'shoes' | 'hat'; item: an id from wardrobe.js, or null for nothing) */
export function remember(id, slot, item) { try { const all = load(); (all[id] ||= {})[slot] = item; localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* private mode: not kept */ } }
