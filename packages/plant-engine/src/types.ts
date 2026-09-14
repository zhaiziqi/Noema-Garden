export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export type BranchSegment = {
  id: string;
  points: Vec3[];
  radiusStart: number;
  radiusEnd: number;
  depth: number;
};

export type LeafInstance = {
  position: Vec3;
  quaternion: Quat;
  scale: number;
  /** 0 = rounder, 1 = more elongated */
  shape: number;
};

export type BloomInstance = {
  position: Vec3;
  quaternion: Quat;
  scale: number;
  petalCount: number;
};

/** Individual petals for flower heads (InstancedMesh). */
export type PetalInstance = {
  position: Vec3;
  quaternion: Quat;
  scale: number;
};

export type PlantPalette = {
  stem: string;
  leaf: string;
  bloom: string;
  translucency: number;
};

export type PlantStructure = {
  archetype: "flower" | "shrub" | "tree";
  branches: BranchSegment[];
  leaves: LeafInstance[];
  blooms: BloomInstance[];
  petals: PetalInstance[];
  palette: PlantPalette;
  boundsHeight: number;
};
