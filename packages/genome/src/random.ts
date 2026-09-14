/**
 * Deterministic PRNG (Mulberry32).
 * Plant generation must never call Math.random().
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) ^ 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  jitter(amount: number): number {
    const u1 = Math.max(1e-9, this.next());
    const u2 = this.next();
    const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return n * amount;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]!;
  }

  fork(label: string): SeededRandom {
    let h = this.state ^ 0x811c9dc5;
    for (let i = 0; i < label.length; i++) {
      h = Math.imul(h ^ label.charCodeAt(i), 0x01000193);
    }
    h ^= Math.floor(this.next() * 0xffffffff);
    return new SeededRandom(h >>> 0);
  }
}

/** Stable hash noise from integer coordinates + seed. */
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
