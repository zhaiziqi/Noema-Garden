import { create } from "zustand";
import {
  clampGenome,
  createDefaultGenome,
  type PlantArchetype,
  type PlantGenomeV1,
  type GenomeParamKey,
} from "@noema/genome";

type GenomeStore = {
  genome: PlantGenomeV1;
  setParam: (key: GenomeParamKey, value: number) => void;
  setSeed: (seed: number) => void;
  setArchetype: (archetype: PlantArchetype) => void;
  reset: () => void;
  randomizeSeed: () => void;
};

export const useGenomeStore = create<GenomeStore>((set, get) => ({
  genome: createDefaultGenome(42),
  setParam: (key, value) => {
    set({ genome: clampGenome({ ...get().genome, [key]: value }) });
  },
  setSeed: (seed) => {
    set({ genome: clampGenome({ ...get().genome, seed }) });
  },
  setArchetype: (archetype) => {
    set({ genome: clampGenome({ ...get().genome, archetype }) });
  },
  reset: () => set({ genome: createDefaultGenome(get().genome.seed) }),
  randomizeSeed: () => {
    // Deterministic-looking scramble without Math.random in plant code;
    // UI-only seed pick may use Date for convenience.
    const seed = (Date.now() ^ (get().genome.seed * 1664525)) >>> 0;
    set({ genome: clampGenome({ ...get().genome, seed }) });
  },
}));
