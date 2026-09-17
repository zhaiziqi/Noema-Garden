from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class Plant(Base):
    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    thought: Mapped[str] = mapped_column(Text, nullable=False)
    traits: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    genome: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    seed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    species: Mapped[str] = mapped_column(String(64), nullable=False, default="unknown")
    position_x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    position_z: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Provenance: how traits were produced (ollama vs fallback).
    source: Mapped[str | None] = mapped_column(String(32), nullable=True, default=None)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True, default=None)
    embedding_json: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    # Aesthetic score + facet breakdown; recomputed when the scorer version bumps.
    aesthetic_score: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    aesthetic_json: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    # Raw CLIP+LAION score from the browser. Normalisation is per-garden, so only
    # the raw value is stored.
    neural_raw: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    neural_version: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
