import type { PlantGenomeV1, SemanticTraits } from "@noema/genome";

export type InterpretResponse = {
  thought: string;
  traits: SemanticTraits;
  genome: PlantGenomeV1;
  seed: number;
  source: "ollama" | "fallback";
  model: string | null;
  message: string | null;
  embedding?: number[] | null;
};

export type LlmStatus = {
  ollama: "ok" | "offline";
  base_url: string;
  model: string | null;
};

export type AestheticFacet = {
  key: string;
  label: string;
  value: number;
};

export type AestheticScore = {
  score: number;
  version: string;
  facets: AestheticFacet[];
  /** Rank within the whole garden, 1 = best. Recomputed per request. */
  rank?: number | null;
  total?: number | null;
  percentile?: number | null;
};

export type NeuralAesthetic = {
  /** Model output before normalisation; only meaningful relative to the garden. */
  raw: number;
  version: string;
  score: number;
  rank?: number | null;
  total?: number | null;
  percentile?: number | null;
};

export type PlantRecord = {
  id: number;
  thought: string;
  traits: SemanticTraits;
  genome: PlantGenomeV1;
  seed: number;
  species: string;
  position: { x: number; z: number };
  created_at: string;
  source?: "ollama" | "fallback" | null;
  model?: string | null;
  message?: string | null;
  aesthetic?: AestheticScore | null;
  neural?: NeuralAesthetic | null;
};

export type PlantThoughtPayload = {
  thought: string;
  traits?: SemanticTraits;
  genome?: PlantGenomeV1;
  seed?: number;
  source?: "ollama" | "fallback";
  model?: string | null;
  embedding?: number[] | null;
  message?: string | null;
};

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { detail?: unknown };
    if (typeof json.detail === "string") return json.detail;
  } catch {
    /* plain text */
  }
  return text || `HTTP ${response.status}`;
}

export async function interpretThought(
  thought: string,
  signal?: AbortSignal,
): Promise<InterpretResponse> {
  const response = await fetch("/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thought }),
    signal,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as InterpretResponse;
}

export async function fetchLlmStatus(): Promise<LlmStatus> {
  const response = await fetch("/api/llm/status");
  if (!response.ok) {
    return { ollama: "offline", base_url: "http://127.0.0.1:11434", model: null };
  }
  return (await response.json()) as LlmStatus;
}

export async function fetchPlants(): Promise<PlantRecord[]> {
  const response = await fetch("/api/plants");
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as PlantRecord[];
}

export async function plantThought(
  payload: PlantThoughtPayload | string,
  signal?: AbortSignal,
): Promise<PlantRecord> {
  const body =
    typeof payload === "string"
      ? { thought: payload }
      : {
          thought: payload.thought,
          traits: payload.traits,
          genome: payload.genome,
          seed: payload.seed,
          source: payload.source,
          model: payload.model,
          embedding: payload.embedding,
          message: payload.message,
        };
  const response = await fetch("/api/plants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as PlantRecord;
}

export async function deletePlant(id: number): Promise<void> {
  const response = await fetch(`/api/plants/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response));
}

export async function putNeuralScore(
  id: number,
  raw: number,
  version: string,
): Promise<PlantRecord> {
  const response = await fetch(`/api/plants/${id}/neural`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw, version }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as PlantRecord;
}

export async function relayoutPlants(): Promise<PlantRecord[]> {
  const response = await fetch("/api/plants/relayout", { method: "POST" });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as PlantRecord[];
}
