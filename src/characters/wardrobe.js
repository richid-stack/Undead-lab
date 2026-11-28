/**
 * wardrobe.js
 * What a person can wear. Every item is its own mesh from the free MakeHuman asset library (CC0), fitted to the body it is put on.
 * Slots: outfit (top + trousers/skirt/dress together, as the library makes them), shoes (with socks), hat, hair. The body underneath is always bare.
 * `id` is the asset's file name in public/models/mh/proxies/<kind>/. Labels are what the Choose hero page shows.
 */
export const OUTFITS = [
  { id: 'male_casualsuit06', label: 'White tee, jeans' },
  { id: 'male_casualsuit04', label: 'Blue tee, jeans' },
  { id: 'male_casualsuit02', label: 'Blue long-sleeve, jeans' },
  { id: 'male_casualsuit01', label: 'Blue shirt, jeans, belt' },
  { id: 'male_casualsuit03', label: 'Striped shirt, jeans' },
  { id: 'male_casualsuit05', label: 'Green jacket, jeans' },
  { id: 'male_elegantsuit01', label: 'Dark suit and tie' },
  { id: 'male_worksuit01', label: 'Dungarees, white tee' },
  { id: 'female_casualsuit01', label: 'Blue tee, jeans (W)' },
  { id: 'female_casualsuit02', label: 'Blue tee, denim shorts (W)' },
  { id: 'female_elegantsuit01', label: 'Striped blouse, skirt (W)' },
  { id: 'female_sportsuit01', label: 'Sports top, leggings (W)' },
];
export const SHOES = [
  { id: 'shoes01', label: 'Brown shoes' }, { id: 'shoes02', label: 'Camo trainers' }, { id: 'shoes03', label: 'Black shoes' },
  { id: 'shoes04', label: 'Black trainers' }, { id: 'shoes05', label: 'White trainers' }, { id: 'shoes06', label: 'Blue trainers' },
];
export const HATS = [{ id: 'fedora01', label: 'Fedora' }, { id: 'fedora_cocked', label: 'Fedora, tilted' }];
export const HAIR = [
  { id: 'short01', label: 'Short crop' }, { id: 'short02', label: 'Short, shaped' }, { id: 'short03', label: 'Short, textured' }, { id: 'short04', label: 'Short, side part' },
  { id: 'afro01', label: 'Natural afro' }, { id: 'braid01', label: 'Braids' }, { id: 'ponytail01', label: 'Ponytail' },
  { id: 'long01', label: 'Long, straight' }, { id: 'bob01', label: 'Bob, swept' }, { id: 'bob02', label: 'Bob, layered' },
];
/** the slots, in the order the chooser lists them: [slot name, title, catalogue, can it be empty?] */
export const SLOTS = [['hair', 'Hair', HAIR, true], ['outfit', 'Outfit', OUTFITS, false], ['shoes', 'Shoes', SHOES, true], ['hat', 'Hat', HATS, true]];
