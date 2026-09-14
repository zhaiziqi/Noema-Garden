import type { PlantGenomeV1 } from "@noema/genome";
import { SeededRandom } from "@noema/genome";
import type { BloomInstance, BranchSegment, PetalInstance, Vec3 } from "../types";
import { hashNoise } from "../rng";
import { GOLDEN_ANGLE, add, normalize, quatEulerYXZ, quatFromUp, scale } from "../math";

export function distributeBlooms(
  branches: BranchSegment[],
  genome: PlantGenomeV1,
  rng: SeededRandom,
): { blooms: BloomInstance[]; petals: PetalInstance[] } {
  const blooms: BloomInstance[] = [];
  const petals: PetalInstance[] = [];
  const density = genome.bloomDensity;
  if (density < 0.04) return { blooms, petals };

  const petalCount =
    genome.archetype === "flower"
      ? 6 + Math.round(genome.petalCount * 10)
      : genome.archetype === "shrub"
        ? 3 + Math.round(genome.petalCount * 4)
        : 3 + Math.round(genome.petalCount * 3);

  // Flower: large tip head. Shrub: many small. Tree: sparse tip clusters.
  const headScale =
    genome.archetype === "flower"
      ? 0.14 + genome.petalScale * 0.28
      : genome.archetype === "shrub"
        ? 0.035 + genome.petalScale * 0.07
        : 0.028 + genome.petalScale * 0.055;

  const target =
    genome.archetype === "flower"
      ? 1 + Math.round(density * 2)
      : genome.archetype === "shrub"
        ? 8 + Math.round(density * 22)
        : Math.max(1, Math.round(density * 5));

  if (target <= 0) return { blooms, petals };

  const tips = branches
    .filter((b) => {
      if (genome.archetype === "flower") return b.depth === 0 || b.id === "trunk";
      if (genome.archetype === "tree") return b.depth >= 2;
      return b.depth >= 1;
    })
    .map((b) => ({ branch: b, tip: b.points[b.points.length - 1]! }))
    .sort((a, b) => b.tip[1] - a.tip[1]);

  const pool =
    tips.length > 0
      ? tips
      : branches.map((b) => ({
          branch: b,
          tip: b.points[b.points.length - 1]!,
        }));

  const count = Math.min(target, Math.max(1, pool.length));

  for (let i = 0; i < count; i++) {
    const item = pool[i % pool.length]!;
    const n = hashNoise(genome.seed, i, 11, item.branch.depth);
    const tip = item.tip;
    const position: Vec3 = [
      tip[0] + (n - 0.5) * 0.03 * genome.asymmetry,
      tip[1] + 0.04 + n * 0.05,
      tip[2] + (hashNoise(genome.seed, i, 4, 2) - 0.5) * 0.03,
    ];

    const yaw = i * 1.9 + rng.jitter(0.35);
    const quat = quatEulerYXZ(rng.jitter(0.25), yaw, rng.jitter(0.25));
    const bloomScale = headScale * (0.85 + n * 0.35);

    blooms.push({
      position,
      quaternion: quat,
      scale: bloomScale * (genome.archetype === "flower" ? 0.55 : 0.4),
      petalCount,
    });

    const petalsHere =
      genome.archetype === "flower"
        ? petalCount
        : genome.archetype === "shrub"
          ? Math.max(3, Math.round(petalCount * 0.7))
          : Math.max(3, Math.round(petalCount * 0.5));

    for (let p = 0; p < petalsHere; p++) {
      const angle = p * GOLDEN_ANGLE * (genome.archetype === "flower" ? 0.55 : 0.7);
      const a =
        genome.archetype === "flower"
          ? (p / petalsHere) * Math.PI * 2
          : angle;

      const radius = bloomScale * (0.55 + genome.petalScale * 0.35);
      const radial = normalize([Math.cos(a), 0.15, Math.sin(a)]);
      const petalPos = add(position, scale(radial, radius));

      const face = normalize([
        radial[0],
        0.55 + genome.leafShape * 0.25,
        radial[2],
      ]);

      petals.push({
        position: petalPos,
        quaternion: quatFromUp(face, a + rng.jitter(0.12)),
        scale:
          bloomScale *
          (genome.archetype === "flower" ? 1.35 : genome.archetype === "shrub" ? 0.7 : 0.55) *
          (0.85 + hashNoise(genome.seed, i, p, 5) * 0.3),
      });
    }
  }

  return { blooms, petals };
}
