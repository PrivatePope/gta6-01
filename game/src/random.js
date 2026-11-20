// A small seeded random number generator (mulberry32): the same seed gives
// the same city and the same traffic, which is what makes the screenshot
// scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max]. */
export function int(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

/** One element of an array, at random. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

/** True with the given probability. */
export function chance(rng, p) {
  return rng() < p;
}
