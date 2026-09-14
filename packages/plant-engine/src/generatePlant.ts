import { clampGenome, type PlantGenomeV1 } from "@noema/genome";
import { createPlantRng } from "./rng";
import { buildSkeleton } from "./skeleton/buildSkeleton";
import { distributeLeaves } from "./leaves/distributeLeaves";
import { distributeBlooms } from "./flowers/distributeBlooms";
import { buildPalette } from "./materials/palette";
import type { PlantStructure } from "./types";

/**
 * Fully deterministic plant generation from genome + seed.
 * Archetypes (flower / shrub / tree) diverge in skeleton, foliage, and blooms.
 */
export function generatePlant(genomeInput: PlantGenomeV1): PlantStructure {
  const genome = clampGenome(genomeInput);
  const root = createPlantRng(genome.seed ^ (genome.archetype === "tree" ? 17 : genome.archetype === "shrub" ? 31 : 7));
  const branchRng = root.fork(`branches:${genome.archetype}`);
  const leafRng = root.fork(`leaves:${genome.archetype}`);
  const bloomRng = root.fork(`blooms:${genome.archetype}`);

  const branches = buildSkeleton({ genome, rng: branchRng });
  const leaves = distributeLeaves(branches, genome, leafRng);
  const { blooms, petals } = distributeBlooms(branches, genome, bloomRng);
  const palette = buildPalette(genome);

  let maxY = 0;
  const consider = (y: number) => {
    if (y > maxY) maxY = y;
  };
  for (const branch of branches) {
    for (const p of branch.points) consider(p[1]);
  }
  for (const leaf of leaves) consider(leaf.position[1]);
  for (const bloom of blooms) consider(bloom.position[1]);
  for (const petal of petals) consider(petal.position[1]);

  return {
    archetype: genome.archetype,
    branches,
    leaves,
    blooms,
    petals,
    palette,
    boundsHeight: maxY,
  };
}

export type {
  PlantStructure,
  BranchSegment,
  LeafInstance,
  BloomInstance,
  PetalInstance,
  PlantPalette,
  Vec3,
} from "./types";
