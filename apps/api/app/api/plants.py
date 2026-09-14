from __future__ import annotations

from typing import Generator, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.garden.layout import find_open_position
from app.garden.species import species_name
from app.llm.interpreter import interpret_thought
from app.models.plant import Plant
from app.models.schemas import (
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
    )


@router.get("/plants", response_model=list[PlantRecord])
def list_plants(db: Session = Depends(get_db)) -> list[PlantRecord]:
    rows = db.query(Plant).order_by(Plant.created_at.asc(), Plant.id.asc()).all()
    return [_row_to_record(row) for row in rows]


@router.get("/plants/{plant_id}", response_model=PlantRecord)
def get_plant(plant_id: int, db: Session = Depends(get_db)) -> PlantRecord:
    row = db.get(Plant, plant_id)
    if row is None:
        raise HTTPException(status_code=404, detail="plant not found")
    return _row_to_record(row)


@router.post("/plants", response_model=PlantRecord)
async def plant_thought(
    body: PlantThoughtRequest,
    db: Session = Depends(get_db),
) -> PlantRecord:
    """Interpret a thought, place it in the garden, and persist."""
    thought = body.thought.strip()
    if not thought:
        raise HTTPException(status_code=400, detail="thought is empty")

    duplicate = db.query(Plant).filter(Plant.thought == thought).first()
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail="This thought is already planted in your garden.",
        )

    interpreted = await interpret_thought(thought)
    occupied = [(p.position_x, p.position_z) for p in db.query(Plant).all()]
    x, z = find_open_position(occupied, interpreted.seed, interpreted.traits)
    name = species_name(interpreted.seed, interpreted.traits)

    row = Plant(
        thought=interpreted.thought,
        traits=interpreted.traits.model_dump_json(),
        genome=interpreted.genome.model_dump_json(),
        seed=interpreted.seed,
        species=name,
        position_x=x,
        position_z=z,
        source=interpreted.source,
        model=interpreted.model,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return _row_to_record(row, message=interpreted.message)


@router.delete("/plants/{plant_id}")
def delete_plant(plant_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    row = db.get(Plant, plant_id)
    if row is None:
        raise HTTPException(status_code=404, detail="plant not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted"}
