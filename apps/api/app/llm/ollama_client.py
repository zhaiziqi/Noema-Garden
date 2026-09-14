from __future__ import annotations

import json
import os
from typing import Any

import httpx

from app.models.schemas import SemanticTraits

OLLAMA_BASE = os.environ.get("NOEMA_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
# Prefer Qwen3.5 4B; override with NOEMA_OLLAMA_MODEL.
PREFERRED_MODELS = (
    os.environ.get("NOEMA_OLLAMA_MODEL"),
    "qwen3.5:2b",
    "qwen3.5:4b",
    "qwen3.5:4b-instruct",
    "qwen2.5:3b",
    "qwen2.5:7b",
    "qwen2.5:1.5b",
    "llama3.2:3b",
)


TRAITS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "valence": {"type": "number"},
        "calm": {"type": "number"},
        "energy": {"type": "number"},
        "hope": {"type": "number"},
        "certainty": {"type": "number"},
        "warmth": {"type": "number"},
        "complexity": {"type": "number"},
        "introspection": {"type": "number"},
    },
    "required": [
        "valence",
        "calm",
        "energy",
        "hope",
        "certainty",
        "warmth",
        "complexity",
        "introspection",
    ],
}


SYSTEM_PROMPT = """You are a semantic interpreter for a digital garden.
Given a short personal thought (any language), output ONLY JSON with eight floats in [0,1]:
valence, calm, energy, hope, certainty, warmth, complexity, introspection.
No markdown, no explanation."""


async def ollama_available(client: httpx.AsyncClient | None = None) -> bool:
    own = client is None
    client = client or httpx.AsyncClient(timeout=2.0)
    try:
        r = await client.get(f"{OLLAMA_BASE}/api/tags")
        return r.status_code == 200
    except Exception:
        return False
    finally:
        if own:
            await client.aclose()


async def resolve_model(client: httpx.AsyncClient) -> str | None:
    try:
        r = await client.get(f"{OLLAMA_BASE}/api/tags")
        r.raise_for_status()
        names = {m.get("name", "") for m in r.json().get("models", [])}
        # Also match without tag precision
        for preferred in PREFERRED_MODELS:
            if not preferred:
                continue
            if preferred in names:
                return preferred
            base = preferred.split(":")[0]
            for name in names:
                if name == preferred or name.startswith(base + ":"):
                    return name
        # Any installed model as last resort
        if names:
            return sorted(names)[0]
    except Exception:
        return None
    return None


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        text = "\n".join(lines).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start : end + 1]
    return json.loads(text)


async def ask_traits(thought: str, model: str, client: httpx.AsyncClient) -> SemanticTraits:
    payload = {
        "model": model,
        "stream": False,
        "format": "json",
        # Top-level think=false — required for Qwen3.5; options.think is ignored.
        "think": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 256,
        },
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Thought:\n"
                    f"{thought.strip()}\n\n"
                    "Return JSON only with keys: "
                    "valence, calm, energy, hope, certainty, warmth, complexity, introspection."
                ),
            },
        ],
    }
    r = await client.post(f"{OLLAMA_BASE}/api/chat", json=payload, timeout=45.0)
    r.raise_for_status()
    data = r.json()
    message = data.get("message") or {}
    content = message.get("content") or data.get("response") or ""
    if not content and message.get("thinking"):
        # Some builds put leftovers in thinking even with think=false — try extract.
        content = message.get("thinking") or ""
    parsed = _extract_json(content)
    return SemanticTraits.model_validate(parsed)
