/**
 * prng.ts — a seeded pseudo-random generator, in twenty lines and zero packages.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * REFAC-07 clause 3 of 3: "fixed PRNG seed". The platform's own random function
 * is not seedable, so the seed loader cannot use it and stay deterministic.
 *
 * WHY NOT A PACKAGE. `seedrandom` and `@faker-js/faker` both do this and more.
 * This phase's package discipline (D-03) allows exactly one new name into the
 * dependency tree, and it is spent on the test runner the requirement names.
 * Twenty auditable lines is the right trade for the thirteenth of a package's
 * surface actually needed here.
 *
 * mulberry32: a 32-bit state, period 2^32, uniform enough to pick from a list.
 * It is not a cryptographic generator and nothing here should ever treat it as
 * one — it exists to make "arbitrary but always the same" cheap.
 */

/** The seed, spelled `UNIV` in ASCII. Changing it changes every seeded row. */
export const SEED = 0x554e4956;

/** Returns a generator producing the same sequence of [0,1) for a given seed. */
export function prng(seed: number = SEED): () => number {
  let state = seed;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic pick from a non-empty list, given a generator. */
export function pick<T>(next: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick() needs a non-empty list");
  return items[Math.floor(next() * items.length)];
}
