import type { PlantGenomeV1, SemanticTraits } from "@noema/genome";

const TRAIT_LABELS: { key: keyof SemanticTraits; label: string }[] = [
  { key: "hope", label: "hope" },
  { key: "calm", label: "calm" },
  { key: "warmth", label: "warmth" },
  { key: "energy", label: "energy" },
  { key: "valence", label: "valence" },
  { key: "introspection", label: "introspection" },
  { key: "complexity", label: "complexity" },
  { key: "certainty", label: "certainty" },
];

/** Top trait chips for inspect — skip near-mid values when possible. */
export function pickTraitChips(
  traits: SemanticTraits,
  limit = 4,
): { key: string; label: string; value: number }[] {
  const ranked = TRAIT_LABELS.map(({ key, label }) => ({
    key,
    label,
    value: traits[key],
    distance: Math.abs(traits[key] - 0.5),
  })).sort((a, b) => b.distance - a.distance);

  const picks = ranked.filter((t) => t.distance >= 0.08).slice(0, limit);
  if (picks.length >= 3) return picks.map(({ key, label, value }) => ({ key, label, value }));
  return ranked.slice(0, limit).map(({ key, label, value }) => ({ key, label, value }));
}

/** Short form gloss from archetype + genome — no extra LLM. */
export function formGloss(genome: PlantGenomeV1, traits: SemanticTraits): string {
  const archetypeWord =
    genome.archetype === "tree" ? "Tall tree" : genome.archetype === "shrub" ? "Wide shrub" : "Slender flower";

  const stature =
    genome.height > 0.65 ? "rising" : genome.height < 0.4 ? "low" : null;

  const bloom =
    genome.bloomDensity > 0.6
      ? "open blooms"
      : genome.bloomDensity < 0.3
        ? "spare blooms"
        : null;

  const hue =
    genome.hue < 0.2 || genome.hue > 0.85
      ? "warm hue"
      : genome.hue > 0.45 && genome.hue < 0.7
        ? "cool hue"
        : null;

  const mood =
    traits.hope > 0.65
      ? "hopeful"
      : traits.calm > 0.65
        ? "quiet"
        : traits.energy > 0.65
          ? "restless"
          : traits.introspection > 0.65
            ? "inward"
            : null;

  const parts = [archetypeWord, stature, bloom, hue, mood].filter(Boolean);
  // Keep to ~3 clauses
  return parts.slice(0, 3).join(" · ");
}

export function interpretationLabel(
  source: "ollama" | "fallback" | null | undefined,
): { kind: "interpreted" | "default" | "unknown"; text: string } {
  if (source === "ollama") {
    return { kind: "interpreted", text: "Interpreted" };
  }
  if (source === "fallback") {
    return { kind: "default", text: "Default traits — meaning not read" };
  }
  return { kind: "unknown", text: "Origin unknown" };
}
