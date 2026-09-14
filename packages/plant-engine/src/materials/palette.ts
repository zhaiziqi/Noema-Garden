import type { PlantGenomeV1 } from "@noema/genome";
import type { PlantPalette } from "../types";

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 1) + 1) % 1;
  const sat = Math.min(1, Math.max(0, s));
  const lig = Math.min(1, Math.max(0, l));

  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + hue * 12) % 12;
    const color = lig - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  const r = f(0);
  const g = f(8);
  const b = f(4);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Night-readable palette with stronger archetype bias
 * (tree cooler stem, flower warmer bloom) while keeping lightness floors.
 */
export function buildPalette(genome: PlantGenomeV1): PlantPalette {
  const h = genome.hue;
  const s = 0.26 + genome.saturation * 0.45;
  const b = 0.54 + genome.brightness * 0.38;

  const stemHue =
    genome.archetype === "tree"
      ? (h + 0.14) % 1
      : genome.archetype === "flower"
        ? (h + 0.04) % 1
        : (h + 0.1) % 1;

  const stemLight =
    genome.archetype === "tree"
      ? Math.max(0.5, b * 0.58)
      : genome.archetype === "shrub"
        ? Math.max(0.52, b * 0.64)
        : Math.max(0.56, b * 0.7);

  const leafHue =
    genome.archetype === "tree"
      ? (h + 0.28) % 1
      : genome.archetype === "flower"
        ? (h + 0.14) % 1
        : (h + 0.2) % 1;

  const leafLight = Math.max(0.58, b * 0.74);

  const bloomHue =
    genome.archetype === "flower" ? (h + 0.97) % 1 : h;
  const bloomLight = Math.max(
    0.58,
    Math.min(0.8, b * 0.78 + (genome.archetype === "flower" ? 0.12 : 0.08)),
  );

  return {
    stem: hslToHex(
      stemHue,
      s * (genome.archetype === "tree" ? 0.32 : genome.archetype === "flower" ? 0.48 : 0.4),
      stemLight,
    ),
    leaf: hslToHex(leafHue, s * 0.58, leafLight),
    bloom: hslToHex(bloomHue, Math.min(1, s * (genome.archetype === "flower" ? 1.12 : 1.0)), bloomLight),
    translucency: 0.35 + genome.translucency * 0.55,
  };
}
