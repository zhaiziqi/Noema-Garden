"""Deterministic botanical species names from seed + traits."""

from __future__ import annotations

from app.genome.mapping import SeededRandom
from app.models.schemas import SemanticTraits

_STEMS = (
    "Limin",
    "Quiet",
    "Aure",
    "Vesper",
    "Mora",
    "Clar",
    "Umbra",
    "Spira",
    "Seren",
    "Lumen",
    "Nox",
    "Mir",
    "Pall",
    "Drift",
    "Hush",
    "Sol",
)

_SUFFIXES = (
    "alis",
    "iflora",
    "ensis",
    "ora",
    "atum",
    "ellis",
    "inae",
    "acea",
    "ium",
    "ara",
    "yx",
    "eia",
)


def species_name(seed: int, traits: SemanticTraits) -> str:
    rng = SeededRandom(seed ^ 0x51CED)
    mood = traits.calm * 0.4 + traits.hope * 0.35 + traits.warmth * 0.25
    start = int(mood * (len(_STEMS) - 4))
    stem = _STEMS[(start + int(rng.next() * 4)) % len(_STEMS)]
    suffix = _SUFFIXES[int(rng.next() * len(_SUFFIXES))]
    # Avoid awkward vowel stacks: Spira + alis → Spiralis
    if stem[-1] in "aeiou" and suffix[0] in "aeiou":
        stem = stem[:-1]
    return f"{stem}{suffix}"
