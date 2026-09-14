import {
  type PlantArchetype,
  type PlantGenomeV1,
  type SemanticTraits,
  clamp01,
  clampGenome,
  createDefaultGenome,
} from "./schema";
import { SeededRandom } from "./random";

/**
 * Deterministic Traits → Genome mapping.
 * Keep formulas here so later aesthetic tuning is localized.
 */
export function traitsToGenome(
  traits: SemanticTraits,
  seed: number,
): PlantGenomeV1 {
  const t = sanitizeTraits(traits);
  const rng = new SeededRandom(seed);

  const archetype = pickArchetype(t, rng);

  // hope → vertical growth + bloom
  const height = clamp01(0.25 + t.hope * 0.55 + t.energy * 0.15);
  const bloomDensity = clamp01(0.15 + t.hope * 0.55 + t.valence * 0.25);

  // certainty low → asymmetry high
  const asymmetry = clamp01(0.15 + (1 - t.certainty) * 0.7 + rng.jitter(0.04));

  // complexity → branching
  const branchDensity = clamp01(0.2 + t.complexity * 0.65 + t.introspection * 0.1);
  const branchLength = clamp01(0.35 + t.complexity * 0.35 + t.energy * 0.2);

  // calm → smoother curvature (lower)
  const curvature = clamp01(0.15 + (1 - t.calm) * 0.55 + t.energy * 0.15);

  // energy → growth / wind response / angle openness
  const growthSpeed = clamp01(0.2 + t.energy * 0.7);
  const windResponse = clamp01(0.15 + t.energy * 0.5 + (1 - t.calm) * 0.2);
  const branchAngle = clamp01(0.25 + t.energy * 0.35 + t.complexity * 0.2);

  // warmth → hue (warm coral ↔ cool botanical)
  // Map: warmth high → warmer hues (~0.05–0.12), low → cool green/teal (~0.55–0.75)
  const hue = clamp01(
    t.warmth > 0.5
      ? 0.02 + (t.warmth - 0.5) * 0.2 + t.valence * 0.05
      : 0.55 + (0.5 - t.warmth) * 0.35 + t.calm * 0.08,
  );

  // valence → brightness / bloom saturation
  const brightness = clamp01(0.35 + t.valence * 0.5 + t.hope * 0.1);
  const saturation = clamp01(0.25 + t.warmth * 0.35 + t.valence * 0.25);
  const translucency = clamp01(0.35 + t.calm * 0.4 + (1 - t.certainty) * 0.1);

  const leafDensity = clamp01(0.25 + t.complexity * 0.35 + t.introspection * 0.25);
  const leafSize = clamp01(0.35 + t.calm * 0.3 + t.valence * 0.15);
  const leafShape = clamp01(0.3 + t.introspection * 0.4 + rng.range(-0.05, 0.05));

  const trunkThickness = clamp01(
    archetype === "tree"
      ? 0.45 + t.certainty * 0.35
      : archetype === "shrub"
        ? 0.35 + t.complexity * 0.25
        : 0.25 + t.hope * 0.25,
  );

  const petalCount = clamp01(0.3 + t.hope * 0.4 + t.warmth * 0.2);
  const petalScale = clamp01(0.35 + t.valence * 0.35 + t.hope * 0.2);

  return clampGenome({
    genome_version: 1,
    seed,
    archetype,
    height,
    trunkThickness,
    branchDensity,
    branchAngle,
    branchLength,
    curvature,
    asymmetry,
    leafDensity,
    leafSize,
    leafShape,
    bloomDensity,
    petalCount,
    petalScale,
    hue,
    saturation,
    brightness,
    translucency,
    growthSpeed,
    windResponse,
  });
}

function sanitizeTraits(traits: SemanticTraits): SemanticTraits {
  const keys: (keyof SemanticTraits)[] = [
    "valence",
    "calm",
    "energy",
    "hope",
    "certainty",
    "warmth",
    "complexity",
    "introspection",
  ];
  const out = { ...traits };
  for (const key of keys) {
    out[key] = clamp01(Number.isFinite(traits[key]) ? traits[key] : 0.5);
  }
  return out;
}

function pickArchetype(t: SemanticTraits, rng: SeededRandom): PlantArchetype {
  // Soft rules + tiny seeded tie-break, still deterministic.
  const treeScore = t.certainty * 0.45 + t.complexity * 0.35 + t.hope * 0.2;
  const shrubScore = t.complexity * 0.4 + (1 - t.hope) * 0.25 + t.introspection * 0.35;
  const flowerScore = t.hope * 0.4 + t.valence * 0.35 + t.warmth * 0.25;

  const scores: { kind: PlantArchetype; score: number }[] = [
    { kind: "tree", score: treeScore + rng.range(0, 0.05) },
    { kind: "shrub", score: shrubScore + rng.range(0, 0.05) },
    { kind: "flower", score: flowerScore + rng.range(0, 0.05) },
  ];
  scores.sort((a, b) => b.score - a.score);
  return scores[0]!.kind;
}

/** Helper for playground / tests. */
export function randomizeGenome(seed: number): PlantGenomeV1 {
  const rng = new SeededRandom(seed);
  const genome = createDefaultGenome(seed);
  const keys = [
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

  for (const key of keys) {
    genome[key] = clamp01(rng.range(0.15, 0.9));
  }
  genome.archetype = rng.pick(["flower", "shrub", "tree"] as const);
  return clampGenome(genome);
}
