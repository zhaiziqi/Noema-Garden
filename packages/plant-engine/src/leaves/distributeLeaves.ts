import type { PlantGenomeV1 } from "@noema/genome";
import { SeededRandom } from "@noema/genome";
import type { BranchSegment, LeafInstance, Vec3 } from "../types";
import { hashNoise } from "../rng";
import { GOLDEN_ANGLE, directionAt, quatFromUp } from "../math";

export function distributeLeaves(
  branches: BranchSegment[],
  genome: PlantGenomeV1,
  rng: SeededRandom,
): LeafInstance[] {
  const leaves: LeafInstance[] = [];
  const density = genome.leafDensity;

  // Size + count gaps so archetypes read at a glance
  const size =
    genome.archetype === "tree"
      ? 0.1 + genome.leafSize * 0.22
      : genome.archetype === "shrub"
        ? 0.055 + genome.leafSize * 0.14
        : 0.04 + genome.leafSize * 0.12;

  const target =
    genome.archetype === "tree"
      ? 80 + Math.round(density * 160)
      : genome.archetype === "shrub"
        ? 90 + Math.round(density * 180)
        : 8 + Math.round(density * 28);

  const minDepth =
    genome.archetype === "flower" ? 0 : genome.archetype === "tree" ? 1 : 0;
  const candidates = branches.filter((b) => b.depth >= minDepth);
  const pool = candidates.length > 0 ? candidates : branches;

  // Shape bias stored on instance: flower elongate, shrub round, tree broad
  const shapeBias =
    genome.archetype === "flower"
      ? Math.min(1, genome.leafShape * 0.45 + 0.7)
      : genome.archetype === "shrub"
        ? Math.min(1, genome.leafShape * 0.35 + 0.2)
        : Math.min(1, genome.leafShape * 0.4 + 0.45);

  if (genome.archetype === "flower") {
    let placed = 0;
    for (const branch of pool) {
      if (branch.points.length < 3) continue;
      const along = 4 + Math.round(density * 8);
      for (let i = 0; i < along && placed < target; i++) {
        const t = 0.25 + (i / along) * 0.55;
        const idx = Math.min(
          branch.points.length - 1,
          Math.floor(t * (branch.points.length - 1)),
        );
        const p = branch.points[idx]!;
        const dir = directionAt(branch.points, idx);
        const angle = placed * GOLDEN_ANGLE;
        const n = hashNoise(genome.seed, placed, idx, branch.depth);
        const flare = 0.04 + genome.leafSize * 0.05 + n * 0.015;
        const position: Vec3 = [
          p[0] + Math.cos(angle) * flare,
          p[1] + (n - 0.5) * 0.012,
          p[2] + Math.sin(angle) * flare,
        ];
        const outward: Vec3 = [
          Math.cos(angle),
          0.2 + genome.leafShape * 0.45,
          Math.sin(angle),
        ];
        leaves.push({
          position,
          quaternion: quatFromUp(
            [
              dir[0] * 0.25 + outward[0],
              dir[1] * 0.15 + outward[1],
              dir[2] * 0.25 + outward[2],
            ],
            angle + rng.jitter(0.2),
          ),
          scale: size * (0.85 + n * 0.3),
          shape: shapeBias,
        });
        placed += 1;
      }
    }
    return leaves;
  }

  let placed = 0;
  let guard = 0;
  while (placed < target && guard < target * 5) {
    guard += 1;
    const preferOuter = rng.next() > (genome.archetype === "tree" ? 0.25 : 0.4);
    const branch = preferOuter
      ? pool[Math.min(pool.length - 1, rng.int(Math.floor(pool.length * 0.4), pool.length - 1))]!
      : pool[rng.int(0, pool.length - 1)]!;
    if (branch.points.length < 2) continue;

    const t =
      genome.archetype === "tree"
        ? 0.4 + rng.next() * 0.55
        : 0.12 + rng.next() * 0.82;
    const idx = Math.min(
      branch.points.length - 1,
      Math.floor(t * (branch.points.length - 1)),
    );
    const p = branch.points[idx]!;
    const dir = directionAt(branch.points, idx);
    const angle = placed * GOLDEN_ANGLE + rng.jitter(0.15);
    const n = hashNoise(genome.seed, placed, idx, branch.depth);
    const flare =
      (genome.archetype === "shrub" ? 0.07 : 0.05) +
      genome.leafSize * 0.05 +
      n * 0.03;

    const position: Vec3 = [
      p[0] + Math.cos(angle) * flare + (genome.asymmetry - 0.5) * 0.02,
      p[1] + (n - 0.5) * 0.025,
      p[2] + Math.sin(angle) * flare,
    ];

    const outward: Vec3 = [
      Math.cos(angle) * (0.6 + genome.leafShape * 0.4),
      genome.archetype === "tree" ? 0.12 + genome.leafShape * 0.22 : 0.35 + genome.leafShape * 0.35,
      Math.sin(angle) * (0.6 + genome.leafShape * 0.4),
    ];

    leaves.push({
      position,
      quaternion: quatFromUp(
        [
          dir[0] * 0.3 + outward[0],
          dir[1] * 0.15 + outward[1],
          dir[2] * 0.3 + outward[2],
        ],
        angle + rng.jitter(0.3),
      ),
      scale: size * (0.7 + n * 0.55),
      shape: shapeBias,
    });
    placed += 1;
  }

  return leaves;
}
