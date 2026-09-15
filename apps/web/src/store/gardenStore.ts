import { create } from "zustand";
import { clampGenome, type PlantGenomeV1 } from "@noema/genome";
import {
  deletePlant,
  fetchPlants,
  interpretThought,
  plantThought,
  relayoutPlants,
  type PlantRecord,
} from "../api/client";
import { growthDuration } from "../plant/growth";

export type PlantPhase = "idle" | "reading" | "placing";

export type GardenPlant = PlantRecord & {
  /** Resume or play growth; paired with initialElapsedSec. */
  animateGrowth: boolean;
  /** Seconds already elapsed since created_at (wall clock). */
  initialElapsedSec: number;
};

type GardenStore = {
  plants: GardenPlant[];
  selectedId: number | null;
  loading: boolean;
  planting: boolean;
  plantPhase: PlantPhase;
  removing: boolean;
  error: string | null;
  statusLine: string | null;
  hydrated: boolean;
  loadGarden: () => Promise<void>;
  plantAThought: (thought: string) => Promise<GardenPlant | null>;
  cancelPlanting: () => void;
  removePlant: (id: number) => Promise<boolean>;
  rearrangeGarden: () => Promise<void>;
  selectPlant: (id: number | null) => void;
  clearStatus: () => void;
};

let plantAbort: AbortController | null = null;

function ageSeconds(createdAt: string): number {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - t) / 1000);
}

function normalize(
  record: PlantRecord,
  options?: { fresh?: boolean },
): GardenPlant {
  const genome = clampGenome(record.genome as PlantGenomeV1);
  const duration = growthDuration(genome.growthSpeed);
  if (options?.fresh) {
    return {
      ...record,
      genome,
      animateGrowth: true,
      initialElapsedSec: 0,
    };
  }
  const age = ageSeconds(record.created_at);
  if (age < duration) {
    return {
      ...record,
      genome,
      animateGrowth: true,
      initialElapsedSec: age,
    };
  }
  return {
    ...record,
    genome,
    animateGrowth: false,
    initialElapsedSec: duration,
  };
}

export const useGardenStore = create<GardenStore>((set, get) => ({
  plants: [],
  selectedId: null,
  loading: false,
  planting: false,
  plantPhase: "idle",
  removing: false,
  error: null,
  statusLine: null,
  hydrated: false,

  loadGarden: async () => {
    set({ loading: true, error: null });
    try {
      let rows = await fetchPlants();
      const flagKey = "noema-semantic-relayout-v2";
      const needsRelayout =
        rows.length > 0 &&
        typeof localStorage !== "undefined" &&
        localStorage.getItem(flagKey) !== "1";
      if (needsRelayout) {
        try {
          rows = await relayoutPlants();
          localStorage.setItem(flagKey, "1");
        } catch {
          /* keep fetched positions if relayout fails */
        }
      }
      set({
        plants: rows.map((row) => normalize(row)),
        loading: false,
        hydrated: true,
      });
    } catch (err) {
      set({
        loading: false,
        hydrated: true,
        error: err instanceof Error ? err.message : "Failed to load garden",
      });
    }
  },

  plantAThought: async (thought: string) => {
    const text = thought.trim();
    if (!text || get().planting) return null;

    plantAbort?.abort();
    const controller = new AbortController();
    plantAbort = controller;

    set({
      planting: true,
      plantPhase: "reading",
      error: null,
      statusLine: "正在读懂这句话…",
    });
    const started = performance.now();

    try {
      const interpreted = await interpretThought(text, controller.signal);
      if (controller.signal.aborted) return null;

      set({ plantPhase: "placing", statusLine: "在园里找位置…" });
      const record = await plantThought(
        {
          thought: interpreted.thought,
          traits: interpreted.traits,
          genome: interpreted.genome,
          seed: interpreted.seed,
          source: interpreted.source,
          model: interpreted.model,
          embedding: interpreted.embedding ?? null,
          message: interpreted.message,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return null;

      // Relayout may have moved neighbors — refresh full garden.
      let rows: PlantRecord[];
      try {
        rows = await fetchPlants();
      } catch {
        rows = [...get().plants.filter((p) => p.id !== record.id), record];
      }

      const planted = normalize(record, { fresh: true });
      const elapsed = ((performance.now() - started) / 1000).toFixed(1);
      set({
        plants: rows.map((row) =>
          row.id === record.id ? planted : normalize(row),
        ),
        planting: false,
        plantPhase: "idle",
        selectedId: planted.id,
        statusLine:
          record.source === "ollama"
            ? `已读懂${record.model ? ` · ${record.model}` : ""} · ${elapsed}s`
            : `未能读懂含义，已用默认性状 · ${elapsed}s`,
      });
      if (plantAbort === controller) plantAbort = null;
      return planted;
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        set({
          planting: false,
          plantPhase: "idle",
          statusLine: null,
          error: null,
        });
        if (plantAbort === controller) plantAbort = null;
        return null;
      }
      set({
        planting: false,
        plantPhase: "idle",
        error: err instanceof Error ? err.message : "Failed to plant thought",
        statusLine: null,
      });
      if (plantAbort === controller) plantAbort = null;
      return null;
    }
  },

  cancelPlanting: () => {
    plantAbort?.abort();
    plantAbort = null;
    set({
      planting: false,
      plantPhase: "idle",
      statusLine: null,
      error: null,
    });
  },

  removePlant: async (id: number) => {
    if (get().removing) return false;
    set({ removing: true, error: null });
    try {
      await deletePlant(id);
      set((state) => ({
        plants: state.plants.filter((p) => p.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
        removing: false,
        statusLine: null,
      }));
      return true;
    } catch (err) {
      set({
        removing: false,
        error: err instanceof Error ? err.message : "Failed to remove plant",
      });
      return false;
    }
  },

  rearrangeGarden: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await relayoutPlants();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("noema-semantic-relayout-v2", "1");
      }
      set({
        plants: rows.map((row) => normalize(row)),
        loading: false,
        statusLine: "已按意思重新排布",
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to rearrange garden",
      });
    }
  },

  selectPlant: (id) => set({ selectedId: id }),
  clearStatus: () => set({ statusLine: null, error: null }),
}));
