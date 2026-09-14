export {
  type SemanticTraits,
  type PlantArchetype,
  type PlantGenomeV1,
  type GenomeParamKey,
  DEFAULT_TRAITS,
  DEFAULT_GENOME,
  GENOME_PARAM_KEYS,
  GENOME_VERSION,
  clamp01,
  clampGenome,
  createDefaultGenome,
} from "./schema";

export { SeededRandom, hashNoise } from "./random";
export { traitsToGenome, randomizeGenome } from "./mapping";
