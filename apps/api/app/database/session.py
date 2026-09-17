from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATA_DIR = Path(__file__).resolve().parents[4] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{(DATA_DIR / 'noema.db').as_posix()}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def _migrate_plants_columns() -> None:
    """Additive SQLite alters for existing gardens (create_all won't add columns)."""
    inspector = inspect(engine)
    if "plants" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("plants")}
    statements: list[str] = []
    if "source" not in existing:
        statements.append("ALTER TABLE plants ADD COLUMN source VARCHAR(32)")
    if "model" not in existing:
        statements.append("ALTER TABLE plants ADD COLUMN model VARCHAR(128)")
    if "embedding_json" not in existing:
        statements.append("ALTER TABLE plants ADD COLUMN embedding_json TEXT")
    if "aesthetic_score" not in existing:
        statements.append("ALTER TABLE plants ADD COLUMN aesthetic_score FLOAT")
    if "aesthetic_json" not in existing:
        statements.append("ALTER TABLE plants ADD COLUMN aesthetic_json TEXT")
    if "neural_raw" not in existing:
        statements.append("ALTER TABLE plants ADD COLUMN neural_raw FLOAT")
    if "neural_version" not in existing:
        statements.append("ALTER TABLE plants ADD COLUMN neural_version VARCHAR(64)")
    if not statements:
        return
    with engine.begin() as connection:
        for sql in statements:
            connection.execute(text(sql))


def init_db() -> None:
    # Import models so metadata is registered before create_all.
    from app.models import plant  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_plants_columns()
