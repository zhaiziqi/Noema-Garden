from __future__ import annotations

import math
from typing import Generator, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.aesthetic.scorer import SCORER_VERSION, score_genome
from app.database.session import SessionLocal
from app.garden.layout import dump_embedding, layout_garden, parse_embedding
from app.garden.species import species_name
from app.llm.interpreter import interpret_thought
from app.models.plant import Plant
from app.models.schemas import (
    AestheticScore,
    InterpretResponse,
    NeuralAesthetic,
    NeuralScoreRequest,
    PlantGenomeV1,
    PlantPosition,
    PlantRecord,
    PlantThoughtRequest,
    SemanticTraits,
)

router = APIRouter(tags=["plants"])


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _row_source(row: Plant) -> Literal["ollama", "fallback"] | None:
    raw = getattr(row, "source", None)
    if raw in ("ollama", "fallback"):
        return raw  # type: ignore[return-value]
    return None


def _row_to_record(
    row: Plant,
    *,
    message: str | None = None,
    aesthetic: AestheticScore | None = None,
    neural: NeuralAesthetic | None = None,
) -> PlantRecord:
    traits = SemanticTraits.model_validate_json(row.traits)
    genome = PlantGenomeV1.model_validate_json(row.genome)
    return PlantRecord(
        id=row.id,
        thought=row.thought,
        traits=traits,
        genome=genome,
        seed=row.seed,
        species=row.species,
        position=PlantPosition(x=row.position_x, z=row.position_z),
        created_at=row.created_at,
        source=_row_source(row),
        model=getattr(row, "model", None),
        message=message,
        aesthetic=aesthetic,
        neural=neural,
    )


def _cached_aesthetic(row: Plant) -> AestheticScore | None:
    """Stored score, or None when absent or produced by an older scorer."""
    raw = getattr(row, "aesthetic_json", None)
    if not raw:
        return None
    try:
        parsed = AestheticScore.model_validate_json(raw)
    except ValidationError:
        return None
    return parsed if parsed.version == SCORER_VERSION else None


def _score_all(db: Session) -> tuple[list[Plant], dict[int, AestheticScore]]:
    """Every plant with its score and its rank in the garden, backfilling as needed."""
    rows = db.query(Plant).order_by(Plant.created_at.asc(), Plant.id.asc()).all()
    scores: dict[int, AestheticScore] = {}
    stale = False
    for row in rows:
        scored = _cached_aesthetic(row)
        if scored is None:
            genome = PlantGenomeV1.model_validate_json(row.genome)
            scored = score_genome(genome)
            row.aesthetic_score = scored.score
            # Rank depends on the garden, so it is never persisted.
            row.aesthetic_json = scored.model_dump_json(
                exclude={"rank", "total", "percentile"},
            )
            stale = True
        scores[row.id] = scored
    if stale:
        db.commit()

    total = len(rows)
    ordered = sorted(scores.items(), key=lambda kv: (-kv[1].score, kv[0]))
    for index, (plant_id, scored) in enumerate(ordered):
        scored.rank = index + 1
        scored.total = total
        scored.percentile = round(100.0 * (total - index) / total, 1)
    return rows, scores


def _neural_all(rows: list[Plant]) -> dict[int, NeuralAesthetic]:
    """Normalise raw CLIP+LAION scores against the garden they live in.

    The raw values sit in a narrow band — the head was trained on photographs
    and these are dark procedural renders — so an absolute number says very
    little. A z-score against the other plants does.
    """
    scored = [
        (row.id, float(row.neural_raw), str(row.neural_version or "unknown"))
        for row in rows
        if getattr(row, "neural_raw", None) is not None
    ]
    if not scored:
        return {}

    total = len(scored)
    raws = [raw for _, raw, _ in scored]
    mean = sum(raws) / total
    variance = sum((raw - mean) ** 2 for raw in raws) / total
    stdev = math.sqrt(variance)

    out: dict[int, NeuralAesthetic] = {}
    for plant_id, raw, version in scored:
        if total < 3 or stdev < 1e-6:
            display = 50.0
        else:
            display = 50.0 + 15.0 * (raw - mean) / stdev
        out[plant_id] = NeuralAesthetic(
            raw=round(raw, 4),
            version=version,
            score=round(max(1.0, min(99.0, display)), 1),
        )

    ordered = sorted(scored, key=lambda item: (-item[1], item[0]))
    for index, (plant_id, _, _) in enumerate(ordered):
        entry = out[plant_id]
        entry.rank = index + 1
        entry.total = total
        entry.percentile = round(100.0 * (total - index) / total, 1)
    return out


def _relayout_all(db: Session) -> list[Plant]:
    rows = db.query(Plant).order_by(Plant.created_at.asc(), Plant.id.asc()).all()
    items: list[tuple[int, SemanticTraits, list[float] | None]] = []
    for row in rows:
        traits = SemanticTraits.model_validate_json(row.traits)
        emb = parse_embedding(getattr(row, "embedding_json", None))
        items.append((row.seed, traits, emb))
    positions = layout_garden(items)
    for row, (x, z) in zip(rows, positions):
        row.position_x = x
        row.position_z = z
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


@router.get("/plants", response_model=list[PlantRecord])
def list_plants(db: Session = Depends(get_db)) -> list[PlantRecord]:
    rows, scores = _score_all(db)
    neural = _neural_all(rows)
    return [
        _row_to_record(row, aesthetic=scores.get(row.id), neural=neural.get(row.id))
        for row in rows
    ]


@router.post("/plants/relayout", response_model=list[PlantRecord])
def relayout_plants(db: Session = Depends(get_db)) -> list[PlantRecord]:
    """
    Recompute positions for all plants (traits polar and/or embedding PCA).
    """
    _relayout_all(db)
    rows, scores = _score_all(db)
    neural = _neural_all(rows)
    return [
        _row_to_record(row, aesthetic=scores.get(row.id), neural=neural.get(row.id))
        for row in rows
    ]


@router.get("/plants/{plant_id}", response_model=PlantRecord)
def get_plant(plant_id: int, db: Session = Depends(get_db)) -> PlantRecord:
    row = db.get(Plant, plant_id)
    if row is None:
        raise HTTPException(status_code=404, detail="plant not found")
    rows, scores = _score_all(db)
    neural = _neural_all(rows)
    return _row_to_record(row, aesthetic=scores.get(row.id), neural=neural.get(row.id))


@router.put("/plants/{plant_id}/neural", response_model=PlantRecord)
def set_neural_score(
    plant_id: int,
    body: NeuralScoreRequest,
    db: Session = Depends(get_db),
) -> PlantRecord:
    """Store a raw CLIP+LAION score computed in the browser."""
    row = db.get(Plant, plant_id)
    if row is None:
        raise HTTPException(status_code=404, detail="plant not found")
    row.neural_raw = body.raw
    row.neural_version = body.version
    db.commit()
    db.refresh(row)

    rows, scores = _score_all(db)
    neural = _neural_all(rows)
    return _row_to_record(row, aesthetic=scores.get(row.id), neural=neural.get(row.id))


@router.post("/plants", response_model=PlantRecord)
async def plant_thought(
    body: PlantThoughtRequest,
    db: Session = Depends(get_db),
) -> PlantRecord:
    """Interpret a thought (or accept precomputed), place it, persist, relayout."""
    thought = body.thought.strip()
    if not thought:
        raise HTTPException(status_code=400, detail="thought is empty")

    duplicate = db.query(Plant).filter(Plant.thought == thought).first()
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail="This thought is already planted in your garden.",
        )

    if body.traits is not None and body.genome is not None and body.seed is not None:
        interpreted = InterpretResponse(
            thought=thought,
            traits=body.traits,
            genome=body.genome,
            seed=body.seed,
            source=body.source or "fallback",
            model=body.model,
            message=body.message,
            embedding=body.embedding,
        )
    else:
        interpreted = await interpret_thought(thought)
        if body.embedding is not None and interpreted.embedding is None:
            interpreted.embedding = body.embedding

    name = species_name(interpreted.seed, interpreted.traits)
    emb_json = dump_embedding(interpreted.embedding)
    scored = score_genome(interpreted.genome)

    row = Plant(
        thought=interpreted.thought,
        traits=interpreted.traits.model_dump_json(),
        genome=interpreted.genome.model_dump_json(),
        seed=interpreted.seed,
        species=name,
        position_x=0.0,
        position_z=0.0,
        source=interpreted.source,
        model=interpreted.model,
        embedding_json=emb_json,
        aesthetic_score=scored.score,
        aesthetic_json=scored.model_dump_json(exclude={"rank", "total", "percentile"}),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # Full-garden meaning map so clusters stay consistent.
    rows = _relayout_all(db)
    _, scores = _score_all(db)
    neural = _neural_all(rows)
    planted = next((r for r in rows if r.id == row.id), row)
    return _row_to_record(
        planted,
        message=interpreted.message,
        aesthetic=scores.get(planted.id),
        neural=neural.get(planted.id),
    )


@router.delete("/plants/{plant_id}")
def delete_plant(plant_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    row = db.get(Plant, plant_id)
    if row is None:
        raise HTTPException(status_code=404, detail="plant not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted"}
