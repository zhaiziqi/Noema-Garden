import { create } from "zustand";
import { clampGenome, type PlantGenomeV1 } from "@noema/genome";
import {
  deletePlant,
  fetchPlants,
  plantThought,
  type PlantRecord,
} from "../api/client";

export type GardenPlant = PlantRecord & {
  /** When true, play growth animation from seed. */
  animateGrowth: boolean;
};

type GardenStore = {
  plants: GardenPlant[];
  selectedId: number | null;
  loading: boolean;
  planting: boolean;
  removing: boolean;
  error: string | null;
  statusLine: string | null;
  hydrated: boolean;
  loadGarden: () => Promise<void>;
  plantAThought: (thought: string) => Promise<GardenPlant | null>;
  removePlant: (id: number) => Promise<boolean>;
  selectPlant: (id: number | null) => void;
  clearStatus: () => void;
};

function normalize(record: PlantRecord, animateGrowth: boolean): GardenPlant {
  return {
    ...record,
    genome: clampGenome(record.genome as PlantGenomeV1),
    animateGrowth,
  };
}

export const useGardenStore = create<GardenStore>((set, get) => ({
  plants: [],
  selectedId: null,
  loading: false,
  planting: false,
  removing: false,
  error: null,
  statusLine: null,
  hydrated: false,

  loadGarden: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await fetchPlants();
      set({
        plants: rows.map((row) => normalize(row, false)),
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
    set({ planting: true, error: null, statusLine: null });
    try {
      const record = await plantThought(text);
      const planted = normalize(record, true);
      set((state) => ({
        plants: [...state.plants, planted],
        planting: false,
        selectedId: planted.id,
        statusLine:
          record.source === "ollama"
            ? `Interpreted${record.model ? ` · ${record.model}` : ""}`
            : "Default traits — meaning not read",
      }));
      return planted;
    } catch (err) {
      set({
        planting: false,
        error: err instanceof Error ? err.message : "Failed to plant thought",
      });
      return null;
    }
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

  selectPlant: (id) => set({ selectedId: id }),
  clearStatus: () => set({ statusLine: null, error: null }),
}));
