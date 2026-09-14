from fastapi import APIRouter
from sqlalchemy import text

from app.database.session import SessionLocal, engine

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    database_status = "ok"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database_status = "error"

    return {
        "status": "ok",
        "database": database_status,
        "session_factory": "ready" if SessionLocal is not None else "missing",
    }
