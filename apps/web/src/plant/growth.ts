/**
 * Growth reveal schedule (visual, not botanical simulation).
 * Seed → Stem → Branches → Leaves → Flowers over ~3–6s.
 * Stages are more sequential so structure reads as growing, not fading in.
 */

export type GrowthStages = {
  /** Overall 0..1 */
  t: number;
  stem: number;
  branches: number;
  leaves: number;
  flowers: number;
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Duration in seconds from genome.growthSpeed (0→3.2s, 1→6.2s). */
export function growthDuration(growthSpeed: number): number {
  return 3.2 + clamp01(growthSpeed) * 3;
}

export function evaluateGrowth(elapsedSec: number, durationSec: number): GrowthStages {
  const t = clamp01(elapsedSec / Math.max(0.001, durationSec));

  return {
    t,
    stem: smoothstep(0.0, 0.22, t),
    branches: smoothstep(0.16, 0.48, t),
    leaves: smoothstep(0.4, 0.72, t),
    flowers: smoothstep(0.62, 0.96, t),
  };
}

/** Branch depth visibility: trunk first, tips later — with length-like ease. */
export function branchReveal(depth: number, maxDepth: number, stages: GrowthStages): number {
  if (depth <= 0) return stages.stem;
  const tip = depth / Math.max(1, maxDepth);
  const raw = stages.branches * (1.2 - tip * 0.65);
  // Ease-out so branches “extend” rather than pop
  const e = clamp01(raw);
  return e * e * (3 - 2 * e);
}
