"""Deterministic Traits → Genome mapping (mirrors packages/genome/mapping.ts)."""

from __future__ import annotations

import math
from typing import Literal

from app.models.schemas import PlantGenomeV1, SemanticTraits, clamp01

PlantArchetype = Literal["flower", "shrub", "tree"]


def _imul32(a: int, b: int) -> int:
    return ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF


class SeededRandom:
    """Mulberry32 — keep in sync with packages/genome/random.ts."""

    def __init__(self, seed: int) -> None:
        self.state = (int(seed) & 0xFFFFFFFF) ^ 0x9E3779B9

    def next(self) -> float:
        self.state = (self.state + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.state
        t = _imul32(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + _imul32(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return (t ^ (t >> 14)) / 4294967296

    def range(self, lo: float, hi: float) -> float:
        return lo + (hi - lo) * self.next()

    def jitter(self, amount: float) -> float:
        u1 = max(1e-9, self.next())
        u2 = self.next()
        n = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
        return n * amount


def _sanitize(traits: SemanticTraits) -> SemanticTraits:
    return SemanticTraits(
        valence=clamp01(traits.valence),
        calm=clamp01(traits.calm),
        energy=clamp01(traits.energy),
        hope=clamp01(traits.hope),
        certainty=clamp01(traits.certainty),
        warmth=clamp01(traits.warmth),
        complexity=clamp01(traits.complexity),
        introspection=clamp01(traits.introspection),
    )


def _pick_archetype(t: SemanticTraits, rng: SeededRandom) -> PlantArchetype:
    scores = [
        ("tree", t.certainty * 0.45 + t.complexity * 0.35 + t.hope * 0.2 + rng.range(0, 0.05)),
        (
            "shrub",
            t.complexity * 0.4 + (1 - t.hope) * 0.25 + t.introspection * 0.35 + rng.range(0, 0.05),
        ),
        ("flower", t.hope * 0.4 + t.valence * 0.35 + t.warmth * 0.25 + rng.range(0, 0.05)),
    ]
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[0][0]  # type: ignore[return-value]


def traits_to_genome(traits: SemanticTraits, seed: int) -> PlantGenomeV1:
    t = _sanitize(traits)
    rng = SeededRandom(seed)
    archetype = _pick_archetype(t, rng)

    height = clamp01(0.25 + t.hope * 0.55 + t.energy * 0.15)
    bloom_density = clamp01(0.15 + t.hope * 0.55 + t.valence * 0.25)
    asymmetry = clamp01(0.15 + (1 - t.certainty) * 0.7 + rng.jitter(0.04))
    branch_density = clamp01(0.2 + t.complexity * 0.65 + t.introspection * 0.1)
    branch_length = clamp01(0.35 + t.complexity * 0.35 + t.energy * 0.2)
    curvature = clamp01(0.15 + (1 - t.calm) * 0.55 + t.energy * 0.15)
    growth_speed = clamp01(0.2 + t.energy * 0.7)
    wind_response = clamp01(0.15 + t.energy * 0.5 + (1 - t.calm) * 0.2)
    branch_angle = clamp01(0.25 + t.energy * 0.35 + t.complexity * 0.2)

    if t.warmth > 0.5:
        hue = clamp01(0.02 + (t.warmth - 0.5) * 0.2 + t.valence * 0.05)
    else:
        hue = clamp01(0.55 + (0.5 - t.warmth) * 0.35 + t.calm * 0.08)

    brightness = clamp01(0.35 + t.valence * 0.5 + t.hope * 0.1)
    saturation = clamp01(0.25 + t.warmth * 0.35 + t.valence * 0.25)
    translucency = clamp01(0.35 + t.calm * 0.4 + (1 - t.certainty) * 0.1)
    leaf_density = clamp01(0.25 + t.complexity * 0.35 + t.introspection * 0.25)
    leaf_size = clamp01(0.35 + t.calm * 0.3 + t.valence * 0.15)
    leaf_shape = clamp01(0.3 + t.introspection * 0.4 + rng.range(-0.05, 0.05))

    if archetype == "tree":
        trunk = clamp01(0.45 + t.certainty * 0.35)
    elif archetype == "shrub":
        trunk = clamp01(0.35 + t.complexity * 0.25)
    else:
        trunk = clamp01(0.25 + t.hope * 0.25)

    petal_count = clamp01(0.3 + t.hope * 0.4 + t.warmth * 0.2)
    petal_scale = clamp01(0.35 + t.valence * 0.35 + t.hope * 0.2)

    return PlantGenomeV1(
        genome_version=1,
        seed=int(seed),
        archetype=archetype,
        height=height,
        trunkThickness=trunk,
        branchDensity=branch_density,
        branchAngle=branch_angle,
        branchLength=branch_length,
        curvature=curvature,
        asymmetry=asymmetry,
        leafDensity=leaf_density,
        leafSize=leaf_size,
        leafShape=leaf_shape,
        bloomDensity=bloom_density,
        petalCount=petal_count,
        petalScale=petal_scale,
        hue=hue,
        saturation=saturation,
        brightness=brightness,
        translucency=translucency,
        growthSpeed=growth_speed,
        windResponse=wind_response,
    )


def thought_to_seed(thought: str) -> int:
    """Stable 32-bit seed from thought text (not cryptographic)."""
    h = 2166136261
    for ch in thought.strip():
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h or 1
