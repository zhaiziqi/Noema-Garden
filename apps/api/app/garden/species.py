"""Deterministic poetic species names from seed + traits (Chinese display)."""

from __future__ import annotations

from app.genome.mapping import SeededRandom
from app.models.schemas import SemanticTraits

# Mood-banded prefixes (calm/hope/warmth axis)
_PREFIXES = (
    "静",  # calm
    "望",  # hope
    "暖",  # warmth
    "暮",
    "澄",
    "微",
    "疏",
    "霁",
    "幽",
    "岚",
    "霜",
    "曦",
    "默",
    "澹",
    "遥",
    "栖",
)

_CORES = (
    "水",
    "叶",
    "枝",
    "花",
    "烟",
    "石",
    "月",
    "风",
    "云",
    "苔",
    "露",
    "庭",
)

_SUFFIXES = (
    "花",
    "草",
    "木",
    "兰",
    "藤",
    "芝",
    "蒲",
    "柏",
)


def species_name(seed: int, traits: SemanticTraits) -> str:
    """Short Chinese botanical-poetic label, e.g. 望叶花 / 静水兰."""
    rng = SeededRandom(seed ^ 0x51CED)
    mood = traits.calm * 0.35 + traits.hope * 0.35 + traits.warmth * 0.3
    energy_band = traits.energy

    start = int(mood * (len(_PREFIXES) - 3))
    prefix = _PREFIXES[(start + int(rng.next() * 3)) % len(_PREFIXES)]

    if energy_band > 0.65:
        core = _CORES[int(rng.next() * 4)]  # 水叶枝花 — livelier
    elif energy_band < 0.35:
        core = _CORES[4 + int(rng.next() * 4)]  # 烟石月风 — quieter
    else:
        core = _CORES[int(rng.next() * len(_CORES))]

    if traits.introspection > 0.6:
        suffix = _SUFFIXES[int(rng.next() * 3) + 3]  # 兰藤芝偏内省
    elif traits.hope > 0.65:
        suffix = _SUFFIXES[int(rng.next() * 3)]  # 花草木偏外放
    else:
        suffix = _SUFFIXES[int(rng.next() * len(_SUFFIXES))]

    name = f"{prefix}{core}{suffix}"
    # Avoid identical stacked chars
    if name[0] == name[1]:
        name = f"{prefix}{_CORES[int(rng.next() * len(_CORES))]}{suffix}"
    return name
