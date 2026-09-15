from __future__ import annotations

import httpx

from app.garden.embeddings import embed_text
from app.genome.mapping import thought_to_seed, traits_to_genome
from app.llm.ollama_client import ask_traits, ollama_available, resolve_model
from app.models.schemas import DEFAULT_TRAITS, InterpretResponse, SemanticTraits


async def interpret_thought(thought: str) -> InterpretResponse:
    """
    Thought → Semantic Traits (Ollama) → Genome (deterministic code).

    On LLM failure: retry once, then DEFAULT_TRAITS.
    Seed always derived from thought so plants stay unique even on fallback.
    Embedding is best-effort and never blocks planting.
    """
    cleaned = thought.strip()
    seed = thought_to_seed(cleaned)

    async with httpx.AsyncClient() as client:
        if not await ollama_available(client):
            genome = traits_to_genome(DEFAULT_TRAITS, seed)
            return InterpretResponse(
                thought=cleaned,
                traits=DEFAULT_TRAITS,
                genome=genome,
                seed=seed,
                source="fallback",
                model=None,
                message="Ollama offline — meaning not read; default traits used.",
                embedding=None,
            )

        model = await resolve_model(client)
        if not model:
            genome = traits_to_genome(DEFAULT_TRAITS, seed)
            return InterpretResponse(
                thought=cleaned,
                traits=DEFAULT_TRAITS,
                genome=genome,
                seed=seed,
                source="fallback",
                model=None,
                message="No local model — meaning not read; default traits used.",
                embedding=None,
            )

        traits: SemanticTraits | None = None
        last_error: str | None = None
        for _attempt in range(2):
            try:
                traits = await ask_traits(cleaned, model, client)
                break
            except Exception as exc:  # noqa: BLE001 — must never crash plant flow
                last_error = str(exc)

        embedding = await embed_text(cleaned, client)

        if traits is None:
            genome = traits_to_genome(DEFAULT_TRAITS, seed)
            return InterpretResponse(
                thought=cleaned,
                traits=DEFAULT_TRAITS,
                genome=genome,
                seed=seed,
                source="fallback",
                model=model,
                message="Could not read meaning after retry — default traits used.",
                embedding=embedding,
            )

        genome = traits_to_genome(traits, seed)
        return InterpretResponse(
            thought=cleaned,
            traits=traits,
            genome=genome,
            seed=seed,
            source="ollama",
            model=model,
            message=None,
            embedding=embedding,
        )
