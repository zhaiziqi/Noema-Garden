"""Ollama embeddings for semantic garden layout."""

from __future__ import annotations

import os

import httpx

from app.llm.ollama_client import OLLAMA_BASE

# Prefer Chinese-friendly embed model; override with NOEMA_OLLAMA_EMBED_MODEL.
PREFERRED_EMBED_MODELS = (
    os.environ.get("NOEMA_OLLAMA_EMBED_MODEL"),
    "bge-m3",
    "bge-m3:latest",
    "nomic-embed-text",
    "nomic-embed-text:latest",
    "mxbai-embed-large",
    "all-minilm",
)


async def resolve_embed_model(client: httpx.AsyncClient) -> str | None:
    try:
        r = await client.get(f"{OLLAMA_BASE}/api/tags")
        r.raise_for_status()
        names = {m.get("name", "") for m in r.json().get("models", [])}
        for preferred in PREFERRED_EMBED_MODELS:
            if not preferred:
                continue
            if preferred in names:
                return preferred
            base = preferred.split(":")[0]
            for name in names:
                if name == preferred or name.startswith(base + ":"):
                    return name
        # Last resort: any model whose name suggests embedding
        for name in sorted(names):
            lower = name.lower()
            if "embed" in lower or "bge" in lower or "minilm" in lower:
                return name
    except Exception:
        return None
    return None


async def embed_text(
    text: str,
    client: httpx.AsyncClient,
    *,
    model: str | None = None,
) -> list[float] | None:
    """Return embedding vector or None on failure."""
    cleaned = text.strip()
    if not cleaned:
        return None
    try:
        model = model or await resolve_embed_model(client)
        if not model:
            return None
        r = await client.post(
            f"{OLLAMA_BASE}/api/embeddings",
            json={"model": model, "prompt": cleaned},
            timeout=30.0,
        )
        r.raise_for_status()
        data = r.json()
        vec = data.get("embedding")
        if isinstance(vec, list) and vec and all(isinstance(x, (int, float)) for x in vec):
            return [float(x) for x in vec]
    except Exception:
        return None
    return None
