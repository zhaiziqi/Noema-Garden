"""Aesthetic scoring for generated plants.

Version "form-v1" reads the genome directly — no render, no model weights, no
new dependencies. Every facet is a preference curve that peaks where the form
reads well in the gallery scene and falls off in both directions.

Sigmas are deliberately tight. `traits_to_genome` already keeps most parameters
near the middle of their range, so forgiving curves push every plant into the
80s and the score stops discriminating. At these widths a garden of random
thoughts spreads roughly 32–89 with a median near 66.

The scorer is swappable: callers only need `score_genome` and `SCORER_VERSION`.
Bumping the version invalidates stored scores, which is how a future CNN/CLIP
scorer would take over without a manual migration.
"""

from __future__ import annotations

import math

from app.models.schemas import AestheticFacet, AestheticScore, PlantGenomeV1

SCORER_VERSION = "form-v1"

FACET_LABELS: dict[str, str] = {
    "proportion": "比例",
    "posture": "姿态",
    "density": "疏密",
    "color": "色彩",
    "detail": "细节",
}

FACET_WEIGHTS: dict[str, float] = {
    "proportion": 0.26,
    "posture": 0.22,
    "density": 0.22,
    "color": 0.18,
    "detail": 0.12,
}


class _ArchetypeIdeal:
    __slots__ = ("height", "crowding", "bloom")

    def __init__(self, height: float, crowding: float, bloom: float) -> None:
        self.height = height
        self.crowding = crowding
        self.bloom = bloom


# A tree and a flower should not be judged against the same silhouette.
ARCHETYPE_IDEALS: dict[str, _ArchetypeIdeal] = {
    "flower": _ArchetypeIdeal(height=0.48, crowding=0.44, bloom=0.60),
    "shrub": _ArchetypeIdeal(height=0.54, crowding=0.58, bloom=0.34),
    "tree": _ArchetypeIdeal(height=0.76, crowding=0.54, bloom=0.22),
}

DEFAULT_IDEAL = ARCHETYPE_IDEALS["flower"]


def _peak(value: float, ideal: float, sigma: float) -> float:
    """1.0 at `ideal`, decaying smoothly either side."""
    if sigma <= 0.0:
        return 1.0 if value == ideal else 0.0
    d = (value - ideal) / sigma
    return math.exp(-0.5 * d * d)


def _spread(*values: float) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / n
    return math.sqrt(var)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _proportion(g: PlantGenomeV1, ideal: _ArchetypeIdeal) -> float:
    height_fit = _peak(g.height, ideal.height, 0.165)
    # A tall stem on a hairline trunk reads as wire; scale the target with height.
    trunk_fit = _peak(g.trunkThickness, 0.16 + 0.42 * g.height, 0.143)
    reach_fit = _peak(g.branchLength, 0.30 + 0.40 * g.height, 0.165)
    return 0.40 * height_fit + 0.34 * trunk_fit + 0.26 * reach_fit


def _posture(g: PlantGenomeV1) -> float:
    # Perfect symmetry reads synthetic, a heavy lean reads broken.
    asym_fit = _peak(g.asymmetry, 0.28, 0.132)
    curve_fit = _peak(g.curvature, 0.42, 0.165)
    angle_fit = _peak(g.branchAngle, 0.46, 0.154)
    return 0.38 * asym_fit + 0.32 * curve_fit + 0.30 * angle_fit


def _density(g: PlantGenomeV1, ideal: _ArchetypeIdeal) -> float:
    crowding = 0.50 * g.branchDensity + 0.34 * g.leafDensity + 0.16 * g.bloomDensity
    crowd_fit = _peak(crowding, ideal.crowding, 0.132)
    bloom_fit = _peak(g.bloomDensity, ideal.bloom, 0.165)
    # Branches, leaves and blooms at the same level flatten into one mass.
    layer_fit = _peak(_spread(g.branchDensity, g.leafDensity, g.bloomDensity), 0.16, 0.088)
    return 0.48 * crowd_fit + 0.28 * bloom_fit + 0.24 * layer_fit


def _color(g: PlantGenomeV1) -> float:
    sat_fit = _peak(g.saturation, 0.50, 0.165)
    bright_fit = _peak(g.brightness, 0.66, 0.143)
    trans_fit = _peak(g.translucency, 0.56, 0.187)
    base = 0.40 * sat_fit + 0.36 * bright_fit + 0.24 * trans_fit
    # Fully saturated and fully bright at once blows out under the gallery lights.
    overload = max(0.0, g.saturation + g.brightness - 1.5)
    return base * (1.0 - 0.5 * overload)


def _detail(g: PlantGenomeV1) -> float:
    # More petals want each petal smaller, or the bloom collapses into a blob.
    petal_fit = _peak(g.petalScale, 0.72 - 0.30 * g.petalCount, 0.154)
    leaf_fit = _peak(g.leafSize, 0.80 - 0.42 * g.leafDensity, 0.165)
    return 0.5 * petal_fit + 0.5 * leaf_fit


def score_genome(genome: PlantGenomeV1) -> AestheticScore:
    """Score a genome on 0–100 with a per-facet breakdown."""
    ideal = ARCHETYPE_IDEALS.get(genome.archetype, DEFAULT_IDEAL)
    values: dict[str, float] = {
        "proportion": _proportion(genome, ideal),
        "posture": _posture(genome),
        "density": _density(genome, ideal),
        "color": _color(genome),
        "detail": _detail(genome),
    }
    total = sum(_clamp01(values[key]) * weight for key, weight in FACET_WEIGHTS.items())
    return AestheticScore(
        score=round(100.0 * _clamp01(total), 1),
        version=SCORER_VERSION,
        facets=[
            AestheticFacet(
                key=key,
                label=FACET_LABELS[key],
                value=round(_clamp01(values[key]), 4),
            )
            for key in FACET_WEIGHTS
        ],
    )
