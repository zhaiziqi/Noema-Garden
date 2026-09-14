"""Polar semantic garden placement (no embedding / UMAP).

Angle  ≈ warmth + valence  (warm/bright vs cool/low arcs)
Radius ≈ hope inward, calm/low-energy outward

Existing plant positions are never moved — only new plants are placed.
"""

from __future__ import annotations

import math
from typing import Protocol

from app.genome.mapping import SeededRandom

GARDEN_RADIUS = 15.0
MIN_DISTANCE = 2.8
R_INNER = 3.5
MAX_ATTEMPTS = 120


class HasTraits(Protocol):
    warmth: float
    valence: float
    hope: float
    calm: float
    energy: float


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _clamp01(v: float) -> float:
    if v != v:  # NaN
        return 0.5
    return max(0.0, min(1.0, float(v)))


def ideal_polar(traits: HasTraits, seed: int) -> tuple[float, float]:
    """Return (angle_rad, radius) for the thought's semantic ideal."""
    rng = SeededRandom(seed ^ 0x5EED)

    warmth = _clamp01(traits.warmth)
    valence = _clamp01(traits.valence)
    hope = _clamp01(traits.hope)
    calm = _clamp01(traits.calm)
    energy = _clamp01(traits.energy)

    # Warm + bright → one arc; cool + low → opposite.
    angle = (0.55 * warmth + 0.45 * valence) * math.tau
    angle += (rng.next() - 0.5) * 0.55  # small ray jitter

    # Hope pulls inward; calm + low energy drift outward.
    outward = 0.45 * calm + 0.35 * (1.0 - energy) + 0.2 * (1.0 - hope)
    inward = hope
    t = _clamp01(0.15 + outward * 0.75 - inward * 0.35)
    radius = R_INNER + t * (GARDEN_RADIUS - R_INNER)
    radius += (rng.next() - 0.5) * 0.6
    radius = max(R_INNER, min(GARDEN_RADIUS, radius))

    return angle, radius


def _polar_to_xz(angle: float, radius: float) -> tuple[float, float]:
    return (math.cos(angle) * radius, math.sin(angle) * radius)


def find_open_position(
    occupied: list[tuple[float, float]],
    seed: int,
    traits: HasTraits,
) -> tuple[float, float]:
    """
    Place a new plant near its trait ideal without moving existing ones.
    """
    angle0, radius0 = ideal_polar(traits, seed)

    if not occupied:
        # First plant: still use semantic ideal (not forced to origin).
        x, z = _polar_to_xz(angle0, radius0)
        return (round(x, 4), round(z, 4))

    rng = SeededRandom(seed ^ 0xA11CE)

    for attempt in range(MAX_ATTEMPTS):
        # Expand search ring and wobble angle around the ideal.
        ring = (attempt // 8) * 0.55
        wobble = (attempt % 8) * 0.42 + (rng.next() - 0.5) * 0.25
        angle = angle0 + wobble
        radius = max(R_INNER, min(GARDEN_RADIUS, radius0 + ring * (1 if attempt % 2 == 0 else -1)))
        # Alternate outward bias as attempts grow
        if attempt > 40:
            radius = min(GARDEN_RADIUS, radius0 + (attempt - 40) * 0.22)

        cand = _polar_to_xz(angle, radius)
        if math.hypot(cand[0], cand[1]) > GARDEN_RADIUS + 0.05:
            continue
        if all(_dist(cand, p) >= MIN_DISTANCE for p in occupied):
            return (round(cand[0], 4), round(cand[1], 4))

    # Last resort: same semantic ray, push to rim.
    cand = _polar_to_xz(angle0, GARDEN_RADIUS)
    return (round(cand[0], 4), round(cand[1], 4))
