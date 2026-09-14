import type { PlantGenomeV1, SemanticTraits } from "@noema/genome";

export type InterpretResponse = {
  thought: string;
  traits: SemanticTraits;
  genome: PlantGenomeV1;
  seed: number;
  source: "ollama" | "fallback";
  model: string | null;
  message: string | null;
};

export type LlmStatus = {
  ollama: "ok" | "offline";
  base_url: string;
  model: string | null;
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

export async function interpretThought(thought: string): Promise<InterpretResponse> {
  const response = await fetch("/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thought }),
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

export async function plantThought(thought: string): Promise<PlantRecord> {
  const response = await fetch("/api/plants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thought }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as PlantRecord;
}

export async function deletePlant(id: number): Promise<void> {
  const response = await fetch(`/api/plants/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response));
}

export async function relayoutPlants(): Promise<PlantRecord[]> {
  const response = await fetch("/api/plants/relayout", { method: "POST" });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as PlantRecord[];
}
