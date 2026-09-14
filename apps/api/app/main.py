from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.interpret import router as interpret_router
from app.api.plants import router as plants_router
from app.database.session import init_db

app = FastAPI(title="Noema Garden API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(interpret_router, prefix="/api")
app.include_router(plants_router, prefix="/api")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
