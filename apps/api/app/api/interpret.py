from fastapi import APIRouter, HTTPException

from app.llm.interpreter import interpret_thought
from app.llm.ollama_client import OLLAMA_BASE, ollama_available, resolve_model
from app.models.schemas import InterpretRequest, InterpretResponse
import httpx

router = APIRouter(tags=["interpret"])


@router.post("/interpret", response_model=InterpretResponse)
async def interpret(body: InterpretRequest) -> InterpretResponse:
    thought = body.thought.strip()
    if not thought:
        raise HTTPException(status_code=400, detail="thought is empty")
    return await interpret_thought(thought)


@router.get("/llm/status")
async def llm_status() -> dict[str, object]:
    async with httpx.AsyncClient(timeout=3.0) as client:
        online = await ollama_available(client)
        model = await resolve_model(client) if online else None
    return {
        "ollama": "ok" if online else "offline",
        "base_url": OLLAMA_BASE,
        "model": model,
    }
