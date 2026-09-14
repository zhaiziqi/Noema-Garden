/**
 * Growth reveal schedule (visual, not botanical simulation).
 * Seed → Stem → Branches → Leaves → Flowers over ~3–6s.
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

/** Duration in seconds from genome.growthSpeed (0→3s, 1→6s). */
export function growthDuration(growthSpeed: number): number {
  return 3 + clamp01(growthSpeed) * 3;
}

export function evaluateGrowth(elapsedSec: number, durationSec: number): GrowthStages {
  const t = clamp01(elapsedSec / Math.max(0.001, durationSec));

  return {
    t,
    // Early trunk/stem
    stem: smoothstep(0.02, 0.28, t),
    // Side branches after stem has presence
    branches: smoothstep(0.18, 0.58, t),
    // Leaves after structure exists
    leaves: smoothstep(0.42, 0.78, t),
    // Blooms/petals last
    flowers: smoothstep(0.62, 0.96, t),
  };
}

/** Branch depth visibility: trunk first, tips later. */
export function branchReveal(depth: number, maxDepth: number, stages: GrowthStages): number {
  if (depth <= 0) return stages.stem;
  const tip = depth / Math.max(1, maxDepth);
  return smoothstep(0, 1, stages.branches * (1.15 - tip * 0.55));
}
