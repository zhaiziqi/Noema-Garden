import { SeededRandom } from "@noema/genome";

/**
 * Deterministic PRNG helpers for the plant engine.
 * Prefer forking named streams so structural stages stay independent.
 */
export function createPlantRng(seed: number): SeededRandom {
  return new SeededRandom(seed);
}

/** Stable hash noise from integer coordinates + seed (no stream mutation). */
export function hashNoise(seed: number, x: number, y = 0, z = 0): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ Math.imul(x | 0, 374761393), 668265263);
  h = Math.imul(h ^ Math.imul(y | 0, 1274126177), 2246822519);
  h = Math.imul(h ^ Math.imul(z | 0, 3266489917), 374761393);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
