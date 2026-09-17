from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


def clamp01(v: float) -> float:
    if v != v:  # NaN
        return 0.5
    return max(0.0, min(1.0, float(v)))


class SemanticTraits(BaseModel):
    valence: float = Field(0.5, ge=0.0, le=1.0)
    calm: float = Field(0.5, ge=0.0, le=1.0)
    energy: float = Field(0.5, ge=0.0, le=1.0)
    hope: float = Field(0.5, ge=0.0, le=1.0)
    certainty: float = Field(0.5, ge=0.0, le=1.0)
    warmth: float = Field(0.5, ge=0.0, le=1.0)
    complexity: float = Field(0.5, ge=0.0, le=1.0)
    introspection: float = Field(0.5, ge=0.0, le=1.0)

    @field_validator(
        "valence",
        "calm",
        "energy",
        "hope",
        "certainty",
        "warmth",
        "complexity",
        "introspection",
        mode="before",
    )
    @classmethod
    def _finite_clamp(cls, v: object) -> float:
        try:
            return clamp01(float(v))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return 0.5


DEFAULT_TRAITS = SemanticTraits()

PlantArchetype = Literal["flower", "shrub", "tree"]


class PlantGenomeV1(BaseModel):
    genome_version: Literal[1] = 1
    seed: int
    archetype: PlantArchetype = "flower"

    height: float = Field(0.55, ge=0.0, le=1.0)
    trunkThickness: float = Field(0.4, ge=0.0, le=1.0)
    branchDensity: float = Field(0.5, ge=0.0, le=1.0)
    branchAngle: float = Field(0.45, ge=0.0, le=1.0)
    branchLength: float = Field(0.55, ge=0.0, le=1.0)
    curvature: float = Field(0.4, ge=0.0, le=1.0)
    asymmetry: float = Field(0.3, ge=0.0, le=1.0)
    leafDensity: float = Field(0.55, ge=0.0, le=1.0)
    leafSize: float = Field(0.5, ge=0.0, le=1.0)
    leafShape: float = Field(0.5, ge=0.0, le=1.0)
    bloomDensity: float = Field(0.45, ge=0.0, le=1.0)
    petalCount: float = Field(0.5, ge=0.0, le=1.0)
    petalScale: float = Field(0.55, ge=0.0, le=1.0)
    hue: float = Field(0.72, ge=0.0, le=1.0)
    saturation: float = Field(0.45, ge=0.0, le=1.0)
    brightness: float = Field(0.65, ge=0.0, le=1.0)
    translucency: float = Field(0.55, ge=0.0, le=1.0)
    growthSpeed: float = Field(0.5, ge=0.0, le=1.0)
    windResponse: float = Field(0.4, ge=0.0, le=1.0)


class InterpretRequest(BaseModel):
    thought: str = Field(..., min_length=1, max_length=2000)


class InterpretResponse(BaseModel):
    thought: str
    traits: SemanticTraits
    genome: PlantGenomeV1
    seed: int
    source: Literal["ollama", "fallback"]
    model: str | None = None
    message: str | None = None
    embedding: list[float] | None = None


class PlantPosition(BaseModel):
    x: float
    z: float


class AestheticFacet(BaseModel):
    key: str
    label: str
    value: float = Field(0.0, ge=0.0, le=1.0)


class AestheticScore(BaseModel):
    score: float = Field(0.0, ge=0.0, le=100.0)
    version: str
    facets: list[AestheticFacet] = Field(default_factory=list)
    # Filled per request against the whole garden, not persisted.
    rank: int | None = None
    total: int | None = None
    percentile: float | None = None


class NeuralAesthetic(BaseModel):
    """CLIP+LAION score. `raw` is the model output, everything else is
    normalised against the current garden, so none of it is persisted."""

    raw: float
    version: str
    score: float = Field(50.0, ge=0.0, le=100.0)
    rank: int | None = None
    total: int | None = None
    percentile: float | None = None


class NeuralScoreRequest(BaseModel):
    raw: float = Field(..., ge=-100.0, le=100.0)
    version: str = Field(..., min_length=1, max_length=64)


class PlantRecord(BaseModel):
    id: int
    thought: str
    traits: SemanticTraits
    genome: PlantGenomeV1
    seed: int
    species: str
    position: PlantPosition
    created_at: datetime
    source: Literal["ollama", "fallback"] | None = None
    model: str | None = None
    message: str | None = None
    aesthetic: AestheticScore | None = None
    neural: NeuralAesthetic | None = None


class PlantThoughtRequest(BaseModel):
    thought: str = Field(..., min_length=1, max_length=2000)
    # Optional precomputed interpret result — skip a second LLM round-trip.
    traits: SemanticTraits | None = None
    genome: PlantGenomeV1 | None = None
    seed: int | None = None
    source: Literal["ollama", "fallback"] | None = None
    model: str | None = None
    embedding: list[float] | None = None
    message: str | None = None
