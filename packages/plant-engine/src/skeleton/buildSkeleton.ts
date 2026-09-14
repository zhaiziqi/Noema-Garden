import type { PlantGenomeV1 } from "@noema/genome";
import { SeededRandom } from "@noema/genome";
import type { BranchSegment, Vec3 } from "../types";
import { hashNoise } from "../rng";
import {
  add,
  cross,
  normalize,
  rotateAround,
  scale,
} from "../math";

type BuildOpts = {
  genome: PlantGenomeV1;
  rng: SeededRandom;
};

type Job = {
  origin: Vec3;
  direction: Vec3;
  length: number;
  radius: number;
  depth: number;
  id: string;
};

function curvePoints(
  start: Vec3,
  direction: Vec3,
  length: number,
  curvature: number,
  asymmetry: number,
  segments: number,
  rng: SeededRandom,
  depth: number,
  upwardBias: number,
): Vec3[] {
  const points: Vec3[] = [start];
  let pos: Vec3 = [...start];
  let dir = normalize(direction);
  const up: Vec3 = [0, 1, 0];
  let side = normalize(cross(dir, Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : up));

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const bend =
      (curvature - 0.5) * 0.85 +
      rng.jitter(0.07 * curvature) +
      (asymmetry - 0.5) * 0.3 * (depth % 2 === 0 ? 1 : -1);

    const twist = rng.jitter(0.1 + asymmetry * 0.22);
    dir = normalize(rotateAround(side, bend * 0.32, dir));
    dir = normalize(rotateAround(dir, twist, dir));
    dir = normalize(add(dir, [0, upwardBias * (1 - curvature * 0.5), 0]));

    const step = length / segments;
    pos = add(pos, scale(dir, step * (1 - t * 0.06)));
    points.push(pos);
    side = normalize(cross(dir, up));
  }

  return points;
}

function archetypeProfile(genome: PlantGenomeV1) {
  const g = genome;
  if (g.archetype === "tree") {
    return {
      // Tall clear trunk, high canopy — little overlap with shrub/flower height
      heightScale: 2.8 + g.height * 3.6,
      baseRadius: 0.065 + g.trunkThickness * 0.14,
      maxDepth: 3 + Math.round(g.branchDensity * 3),
      childBase: 2 + Math.round(g.branchDensity * 3),
      lengthKeep: 0.5 + g.branchLength * 0.28,
      upwardBias: 0.14,
      radiusDecay: 0.56,
      tipAngle: (0.22 + g.branchAngle * 0.75) * Math.PI * 0.45,
      multiStem: 0,
    };
  }
  if (g.archetype === "shrub") {
    return {
      // Wide low crown from many basal stems
      heightScale: 0.85 + g.height * 1.15,
      baseRadius: 0.026 + g.trunkThickness * 0.05,
      maxDepth: 2 + Math.round(g.branchDensity * 2),
      childBase: 3 + Math.round(g.branchDensity * 4),
      lengthKeep: 0.58 + g.branchLength * 0.28,
      upwardBias: 0.03,
      radiusDecay: 0.64,
      tipAngle: (0.4 + g.branchAngle * 0.95) * Math.PI * 0.58,
      multiStem: 5 + Math.round(g.branchDensity * 6),
    };
  }
  // flower — single slender stem, sparse side shoots, tip-focused
  return {
    heightScale: 1.35 + g.height * 1.1,
    baseRadius: 0.012 + g.trunkThickness * 0.028,
    maxDepth: 1 + Math.round(g.branchDensity * 1.2),
    childBase: 1 + Math.round(g.branchDensity * 1.5),
    lengthKeep: 0.36 + g.branchLength * 0.22,
    upwardBias: 0.2,
    radiusDecay: 0.7,
    tipAngle: (0.1 + g.branchAngle * 0.4) * Math.PI * 0.32,
    multiStem: 0,
  };
}

/**
 * Archetype-specialized recursive branching (Catmull-Rom later in renderer).
 */
export function buildSkeleton({ genome, rng }: BuildOpts): BranchSegment[] {
  const branches: BranchSegment[] = [];
  const g = genome;
  const p = archetypeProfile(g);
  const queue: Job[] = [];

  if (p.multiStem > 0) {
    for (let i = 0; i < p.multiStem; i++) {
      const n = hashNoise(g.seed, i, 2, 7);
      const yaw = (i / p.multiStem) * Math.PI * 2 + (g.asymmetry - 0.5) * 0.8;
      const lean = 0.15 + g.branchAngle * 0.45 + n * 0.2;
      const dir = normalize([
        Math.cos(yaw) * Math.sin(lean),
        Math.cos(lean),
        Math.sin(yaw) * Math.sin(lean),
      ]);
      const radial = 0.04 + n * 0.08;
      queue.push({
        origin: [Math.cos(yaw) * radial, 0, Math.sin(yaw) * radial],
        direction: dir,
        length: p.heightScale * (0.55 + g.branchLength * 0.3) * (0.75 + n * 0.4),
        radius: p.baseRadius * (0.75 + n * 0.35),
        depth: 0,
        id: `stem-${i}`,
      });
    }
  } else {
    queue.push({
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      length: p.heightScale * (0.55 + g.branchLength * 0.28),
      radius: p.baseRadius,
      depth: 0,
      id: "trunk",
    });
  }

  let safety = 0;
  const cap = g.archetype === "tree" ? 280 : g.archetype === "shrub" ? 240 : 120;

  while (queue.length > 0 && safety < cap) {
    safety += 1;
    const job = queue.shift()!;
    const segs = 5 + Math.round((1 - job.depth / (p.maxDepth + 1)) * 5);
    const points = curvePoints(
      job.origin,
      job.direction,
      job.length,
      g.curvature,
      g.asymmetry,
      segs,
      rng.fork(job.id),
      job.depth,
      p.upwardBias,
    );

    branches.push({
      id: job.id,
      points,
      radiusStart: job.radius,
      radiusEnd: Math.max(0.006, job.radius * p.radiusDecay * 0.85),
      depth: job.depth,
    });

    if (job.depth >= p.maxDepth) continue;

    const tip = points[points.length - 1]!;
    const prev = points[Math.max(0, points.length - 2)]!;
    const tipDir = normalize([
      tip[0] - prev[0],
      tip[1] - prev[1],
      tip[2] - prev[2],
    ]);

    let children =
      job.depth === 0
        ? p.childBase
        : Math.max(
            1,
            Math.round(p.childBase * (0.75 - job.depth * 0.12)),
          );

    // Flower: almost no side shoots — keep a single readable stem
    if (g.archetype === "flower" && job.depth === 0) {
      children = Math.min(children, 1 + Math.round(g.branchDensity * 0.8));
    }
    if (g.archetype === "flower" && job.depth > 0) {
      children = 0;
    }

    for (let i = 0; i < children; i++) {
      const noise = hashNoise(g.seed, job.depth + 1, i, job.id.length + 3);
      const yaw =
        (i / children) * Math.PI * 2 +
        (g.asymmetry - 0.5) * 1.1 +
        (noise - 0.5) * 0.7;

      const pitch = p.tipAngle + (noise - 0.5) * 0.4 * g.branchAngle;
      let dir = rotateAround([0, 1, 0], yaw, tipDir);
      const axis = normalize(cross(dir, [0, 1, 0]));
      if (Math.hypot(axis[0], axis[1], axis[2]) > 1e-5) {
        dir = normalize(rotateAround(axis, pitch, dir));
      }

      const len =
        job.length * p.lengthKeep * (0.82 + noise * 0.32);

      queue.push({
        origin: tip,
        direction: dir,
        length: Math.max(0.12, len),
        radius: job.radius * p.radiusDecay,
        depth: job.depth + 1,
        id: `${job.id}-${i}`,
      });
    }
  }

  return branches;
}
