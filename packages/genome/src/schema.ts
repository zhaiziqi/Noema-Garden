/** Semantic traits produced by the local LLM (Milestone 5). */
export type SemanticTraits = {
  valence: number;
  calm: number;
  energy: number;
  hope: number;
  certainty: number;
  warmth: number;
  complexity: number;
  introspection: number;
};

export const DEFAULT_TRAITS: SemanticTraits = {
  valence: 0.5,
  calm: 0.5,
  energy: 0.5,
  hope: 0.5,
  certainty: 0.5,
  warmth: 0.5,
  complexity: 0.5,
  introspection: 0.5,
};

export const GENOME_VERSION = 1 as const;

export type PlantArchetype = "flower" | "shrub" | "tree";

/**
 * PlantGenomeV1 — only params that visibly change the plant.
 * Continuous values are clamped to [0, 1] unless noted.
 */
export type PlantGenomeV1 = {
  genome_version: 1;
  seed: number;
  archetype: PlantArchetype;

  height: number;
  trunkThickness: number;

  branchDensity: number;
  branchAngle: number;
  branchLength: number;
  curvature: number;
  asymmetry: number;

  leafDensity: number;
  leafSize: number;
  leafShape: number;

  bloomDensity: number;
  petalCount: number;
  petalScale: number;

  hue: number;
  saturation: number;
  brightness: number;
  translucency: number;

  growthSpeed: number;
  windResponse: number;
};

export const GENOME_PARAM_KEYS = [
  "height",
  "trunkThickness",
  "branchDensity",
  "branchAngle",
  "branchLength",
  "curvature",
  "asymmetry",
  "leafDensity",
  "leafSize",
  "leafShape",
  "bloomDensity",
  "petalCount",
  "petalScale",
  "hue",
  "saturation",
  "brightness",
  "translucency",
  "growthSpeed",
  "windResponse",
] as const;

export type GenomeParamKey = (typeof GENOME_PARAM_KEYS)[number];

export const DEFAULT_GENOME: PlantGenomeV1 = {
  genome_version: 1,
  seed: 42,
  archetype: "flower",

  height: 0.55,
  trunkThickness: 0.4,

  branchDensity: 0.5,
  branchAngle: 0.45,
  branchLength: 0.55,
  curvature: 0.4,
  asymmetry: 0.3,

  leafDensity: 0.55,
  leafSize: 0.5,
  leafShape: 0.5,

  bloomDensity: 0.45,
  petalCount: 0.5,
  petalScale: 0.55,

  hue: 0.72,
  saturation: 0.45,
  brightness: 0.65,
  translucency: 0.55,

  growthSpeed: 0.5,
  windResponse: 0.4,
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampGenome(partial: Partial<PlantGenomeV1> & { seed?: number }): PlantGenomeV1 {
  const base = { ...DEFAULT_GENOME, ...partial };
  const next: PlantGenomeV1 = {
    ...base,
    genome_version: 1,
    seed: Number.isFinite(base.seed) ? Math.floor(base.seed) : 0,
    archetype: base.archetype ?? "flower",
  };

  for (const key of GENOME_PARAM_KEYS) {
    next[key] = clamp01(next[key]);
  }

  return next;
}

export function createDefaultGenome(seed = 42): PlantGenomeV1 {
  return clampGenome({ ...DEFAULT_GENOME, seed });
}
