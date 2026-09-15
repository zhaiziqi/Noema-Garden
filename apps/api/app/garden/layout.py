"""Semantic garden placement: traits polar + optional embedding PCA map."""

from __future__ import annotations

import json
import math
from typing import Protocol, Sequence

from app.genome.mapping import SeededRandom

GARDEN_RADIUS = 15.0
MIN_DISTANCE = 2.8
R_INNER = 3.5
MAX_ATTEMPTS = 120
EMBED_WEIGHT = 0.65
TRAITS_WEIGHT = 0.35


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

    angle = (0.55 * warmth + 0.45 * valence) * math.tau
    angle += (rng.next() - 0.5) * 0.55

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
        x, z = _polar_to_xz(angle0, radius0)
        return (round(x, 4), round(z, 4))

    rng = SeededRandom(seed ^ 0xA11CE)

    for attempt in range(MAX_ATTEMPTS):
        ring = (attempt // 8) * 0.55
        wobble = (attempt % 8) * 0.42 + (rng.next() - 0.5) * 0.25
        angle = angle0 + wobble
        radius = max(
            R_INNER,
            min(GARDEN_RADIUS, radius0 + ring * (1 if attempt % 2 == 0 else -1)),
        )
        if attempt > 40:
            radius = min(GARDEN_RADIUS, radius0 + (attempt - 40) * 0.22)

        cand = _polar_to_xz(angle, radius)
        if math.hypot(cand[0], cand[1]) > GARDEN_RADIUS + 0.05:
            continue
        if all(_dist(cand, p) >= MIN_DISTANCE for p in occupied):
            return (round(cand[0], 4), round(cand[1], 4))

    cand = _polar_to_xz(angle0, GARDEN_RADIUS)
    return (round(cand[0], 4), round(cand[1], 4))


def parse_embedding(raw: str | None) -> list[float] | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, list) and len(data) >= 2 and all(
            isinstance(x, (int, float)) for x in data
        ):
            return [float(x) for x in data]
    except Exception:
        return None
    return None


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _norm(a: Sequence[float]) -> float:
    return math.sqrt(max(1e-18, _dot(a, a)))


def _power_eig(matrix: list[list[float]], iters: int = 48) -> tuple[float, list[float]]:
    """Leading eigenpair of symmetric matrix via power iteration."""
    n = len(matrix)
    v = [1.0 / math.sqrt(n)] * n
    for _ in range(iters):
        w = [sum(matrix[i][j] * v[j] for j in range(n)) for i in range(n)]
        nw = _norm(w)
        v = [x / nw for x in w]
    # Rayleigh quotient
    Av = [sum(matrix[i][j] * v[j] for j in range(n)) for i in range(n)]
    lam = _dot(v, Av)
    return lam, v


def _pca_2d(vectors: Sequence[Sequence[float]]) -> list[tuple[float, float]]:
    """
    Center + PCA via Gram-matrix eigen (n×n). Pure Python — no numpy.
    Suitable for small gardens (n typically < 50).
    """
    n = len(vectors)
    if n == 0:
        return []
    d = len(vectors[0])
    means = [sum(vectors[i][j] for i in range(n)) / n for j in range(d)]
    x = [[vectors[i][j] - means[j] for j in range(d)] for i in range(n)]

    # Gram G = X X^T
    g = [[_dot(x[i], x[j]) for j in range(n)] for i in range(n)]
    lam1, u1 = _power_eig(g)
    # Deflate
    g2 = [
        [g[i][j] - lam1 * u1[i] * u1[j] for j in range(n)]
        for i in range(n)
    ]
    lam2, u2 = _power_eig(g2)

    s1 = math.sqrt(max(0.0, lam1))
    s2 = math.sqrt(max(0.0, lam2))
    pts = [(u1[i] * s1, u2[i] * s2) for i in range(n)]

    span = max((abs(a) for a, _ in pts), default=0.0)
    span = max(span, max((abs(b) for _, b in pts), default=0.0), 1e-8)
    scale = (GARDEN_RADIUS * 0.72) / span
    return [(a * scale, b * scale) for a, b in pts]


def _separate(positions: list[tuple[float, float]], seeds: list[int]) -> list[tuple[float, float]]:
    """Push pairs apart until MIN_DISTANCE, clamp to garden disk."""
    pts = [list(p) for p in positions]
    n = len(pts)
    for _ in range(40):
        moved = False
        for i in range(n):
            for j in range(i + 1, n):
                dx = pts[i][0] - pts[j][0]
                dz = pts[i][1] - pts[j][1]
                d = math.hypot(dx, dz)
                if d < 1e-6:
                    rng = SeededRandom(seeds[i] ^ seeds[j] ^ 0x51)
                    ang = rng.next() * math.tau
                    dx, dz = math.cos(ang), math.sin(ang)
                    d = 1e-6
                if d < MIN_DISTANCE:
                    push = (MIN_DISTANCE - d) * 0.55
                    nx, nz = dx / d, dz / d
                    pts[i][0] += nx * push
                    pts[i][1] += nz * push
                    pts[j][0] -= nx * push
                    pts[j][1] -= nz * push
                    moved = True
        for i in range(n):
            r = math.hypot(pts[i][0], pts[i][1])
            if r > GARDEN_RADIUS:
                s = GARDEN_RADIUS / r
                pts[i][0] *= s
                pts[i][1] *= s
            elif r < R_INNER * 0.85 and r > 1e-6:
                s = (R_INNER * 0.85) / r
                pts[i][0] *= s
                pts[i][1] *= s
        if not moved:
            break
    return [(round(p[0], 4), round(p[1], 4)) for p in pts]


def layout_garden(
    items: Sequence[tuple[int, HasTraits, list[float] | None]],
) -> list[tuple[float, float]]:
    """
    Lay out all plants.

    items: (seed, traits, embedding_or_none) in creation order.
    Uses embedding PCA when enough vectors exist; else traits polar placement.
    """
    n = len(items)
    if n == 0:
        return []

    embeddings = [emb for _, _, emb in items]
    usable = [e for e in embeddings if e is not None]
    dim_ok = (
        len(usable) >= 3
        and len(usable) == n
        and len({len(e) for e in usable if e is not None}) == 1
    )

    if not dim_ok:
        occupied: list[tuple[float, float]] = []
        out: list[tuple[float, float]] = []
        for seed, traits, _ in items:
            pos = find_open_position(occupied, seed, traits)
            occupied.append(pos)
            out.append(pos)
        return out

    assert all(e is not None for e in embeddings)
    pca_pts = _pca_2d(embeddings)  # type: ignore[arg-type]

    blended: list[tuple[float, float]] = []
    seeds: list[int] = []
    for i, (seed, traits, _) in enumerate(items):
        seeds.append(seed)
        angle, radius = ideal_polar(traits, seed)
        tx, tz = _polar_to_xz(angle, radius)
        ex, ez = pca_pts[i]
        hope = _clamp01(traits.hope)
        er = math.hypot(ex, ez)
        if er > 1e-6:
            # Keep PCA direction; calm/low-hope drift outward slightly
            scale = min(GARDEN_RADIUS, max(R_INNER, er * (0.85 + (1.0 - hope) * 0.25))) / er
            ex, ez = ex * scale, ez * scale
        x = EMBED_WEIGHT * ex + TRAITS_WEIGHT * tx
        z = EMBED_WEIGHT * ez + TRAITS_WEIGHT * tz
        blended.append((x, z))

    return _separate(blended, seeds)


def dump_embedding(vec: list[float] | None) -> str | None:
    if not vec:
        return None
    return json.dumps(vec)
