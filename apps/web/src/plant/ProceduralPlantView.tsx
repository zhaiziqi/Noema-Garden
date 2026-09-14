import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";
import type { PlantStructure } from "@noema/plant-engine";
import {
  branchReveal,
  evaluateGrowth,
  type GrowthStages,
} from "./growth";
import type { GrowthClock } from "./useGrowthClock";

type Props = {
  structure: PlantStructure;
  growthClock: MutableRefObject<GrowthClock>;
  windResponse?: number;
  scale?: number;
};

function buildBranchGeometry(
  points: [number, number, number][],
  radiusStart: number,
  radiusEnd: number,
): TubeGeometry | null {
  const cleaned = points.filter(
    (p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]),
  );
  if (cleaned.length < 2) return null;

  const unique: typeof cleaned = [cleaned[0]!];
  for (let i = 1; i < cleaned.length; i++) {
    const a = unique[unique.length - 1]!;
    const b = cleaned[i]!;
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 1e-4) {
      unique.push(b);
    }
  }
  if (unique.length < 2) return null;

  const curve = new CatmullRomCurve3(
    unique.map((p) => new Vector3(p[0], p[1], p[2])),
    false,
    "catmullrom",
    0.28,
  );
  const tubular = Math.max(14, unique.length * 5);
  const radius = Math.max(0.008, (radiusStart + radiusEnd) * 0.5);
  return new TubeGeometry(curve, tubular, radius, 8, false);
}

function BranchMesh({
  points,
  radiusStart,
  radiusEnd,
  color,
  depth,
  maxDepth,
  growthRef,
}: {
  points: [number, number, number][];
  radiusStart: number;
  radiusEnd: number;
  color: string;
  depth: number;
  maxDepth: number;
  growthRef: MutableRefObject<GrowthStages>;
}) {
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<MeshStandardMaterial>(null);
  const geometry = useMemo(
    () => buildBranchGeometry(points, radiusStart, radiusEnd),
    [points, radiusStart, radiusEnd],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;
    const reveal = branchReveal(depth, maxDepth, growthRef.current);
    mesh.visible = reveal > 0.02;
    // Soft fade-in (avoid scaleScalar — it shrinks tubes from centroid)
    mat.opacity = 0.2 + reveal * 0.8;
  });

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        ref={matRef}
        color={color}
        roughness={0.68}
        metalness={0.06}
        transparent
        opacity={1}
        emissive={color}
        emissiveIntensity={0.14}
      />
    </mesh>
  );
}

function LeafField({
  structure,
  growthRef,
  windResponse,
}: {
  structure: PlantStructure;
  growthRef: MutableRefObject<GrowthStages>;
  windResponse: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const matRef = useRef<MeshStandardMaterial>(null);
  const count = structure.leaves.length;
  const baseRef = useRef<{
    pos: Vector3[];
    quat: Quaternion[];
    scl: Vector3[];
  } | null>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;
    const pos: Vector3[] = [];
    const quat: Quaternion[] = [];
    const scl: Vector3[] = [];
    const color = new Color(structure.palette.leaf);

    for (let i = 0; i < count; i++) {
      const leaf = structure.leaves[i]!;
      pos.push(new Vector3(leaf.position[0], leaf.position[1], leaf.position[2]));
      quat.push(
        new Quaternion(
          leaf.quaternion[0],
          leaf.quaternion[1],
          leaf.quaternion[2],
          leaf.quaternion[3],
        ).normalize(),
      );
      const elongate = 0.9 + leaf.shape * 1.35;
      const width = 0.55 + (1 - leaf.shape) * 0.35;
      scl.push(new Vector3(leaf.scale * width, leaf.scale * elongate, 1));
      mesh.setColorAt(i, color);
    }
    baseRef.current = { pos, quat, scl };
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [structure, count]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const base = baseRef.current;
    if (!mesh || !base || count === 0) return;
    const reveal = growthRef.current.leaves;
    const matrix = new Matrix4();
    const tmpS = new Vector3();
    const t = clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const local = Math.min(1, Math.max(0, (reveal - (i / count) * 0.35) / 0.65));
      const ease = local * local * (3 - 2 * local);
      const flutter =
        Math.sin(t * (1.2 + windResponse) + i * 0.37) * 0.05 * windResponse * ease;
      tmpS.copy(base.scl[i]!).multiplyScalar(ease);
      tmpS.x *= 1 + flutter;
      matrix.compose(base.pos[i]!, base.quat[i]!, tmpS);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (matRef.current) {
      matRef.current.opacity = Math.min(
        0.98,
        (0.86 + structure.palette.translucency * 0.12) * Math.min(1, reveal * 1.2),
      );
    }
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      key={`leaves-${structure.archetype}-${count}`}
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <circleGeometry args={[1, 7]} />
      <meshStandardMaterial
        ref={matRef}
        color={structure.palette.leaf}
        roughness={0.42}
        metalness={0.03}
        transparent
        opacity={0.92}
        side={DoubleSide}
        emissive={structure.palette.leaf}
        emissiveIntensity={0.22}
      />
    </instancedMesh>
  );
}

function PetalField({
  structure,
  growthRef,
}: {
  structure: PlantStructure;
  growthRef: MutableRefObject<GrowthStages>;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const matRef = useRef<MeshPhysicalMaterial>(null);
  const count = structure.petals.length;
  const baseRef = useRef<{
    pos: Vector3[];
    quat: Quaternion[];
    scl: Vector3[];
  } | null>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;
    const pos: Vector3[] = [];
    const quat: Quaternion[] = [];
    const scl: Vector3[] = [];
    const color = new Color(structure.palette.bloom);

    for (let i = 0; i < count; i++) {
      const petal = structure.petals[i]!;
      pos.push(new Vector3(petal.position[0], petal.position[1], petal.position[2]));
      quat.push(
        new Quaternion(
          petal.quaternion[0],
          petal.quaternion[1],
          petal.quaternion[2],
          petal.quaternion[3],
        ).normalize(),
      );
      scl.push(new Vector3(petal.scale * 0.45, petal.scale * 1.15, 1));
      mesh.setColorAt(i, color);
    }
    baseRef.current = { pos, quat, scl };
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [structure, count]);

  useFrame(() => {
    const mesh = meshRef.current;
    const base = baseRef.current;
    if (!mesh || !base || count === 0) return;
    const reveal = growthRef.current.flowers;
    const matrix = new Matrix4();
    const tmpS = new Vector3();

    for (let i = 0; i < count; i++) {
      const local = Math.min(1, Math.max(0, (reveal - (i / count) * 0.25) / 0.75));
      const ease = local * local * (3 - 2 * local);
      tmpS.copy(base.scl[i]!).multiplyScalar(ease);
      matrix.compose(base.pos[i]!, base.quat[i]!, tmpS);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (matRef.current) {
      matRef.current.opacity = 0.94 * Math.min(1, reveal * 1.15);
      matRef.current.emissiveIntensity = 0.05 + reveal * 0.08;
    }
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      key={`petals-${structure.archetype}-${count}`}
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <circleGeometry args={[1, 8]} />
      <meshPhysicalMaterial
        ref={matRef}
        color={structure.palette.bloom}
        roughness={0.28}
        metalness={0.04}
        transparent
        opacity={0.94}
        transmission={structure.palette.translucency * 0.14}
        thickness={0.22}
        emissive={structure.palette.bloom}
        emissiveIntensity={0.08}
        side={DoubleSide}
      />
    </instancedMesh>
  );
}

function BloomCenters({
  structure,
  growthRef,
}: {
  structure: PlantStructure;
  growthRef: MutableRefObject<GrowthStages>;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const count = structure.blooms.length;
  const baseRef = useRef<
    { pos: Vector3; quat: Quaternion; scale: number }[] | null
  >(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;
    const color = new Color(structure.palette.bloom).offsetHSL(0, 0, 0.05);
    const bases: { pos: Vector3; quat: Quaternion; scale: number }[] = [];

    for (let i = 0; i < count; i++) {
      const bloom = structure.blooms[i]!;
      bases.push({
        pos: new Vector3(bloom.position[0], bloom.position[1], bloom.position[2]),
        quat: new Quaternion(
          bloom.quaternion[0],
          bloom.quaternion[1],
          bloom.quaternion[2],
          bloom.quaternion[3],
        ).normalize(),
        scale: bloom.scale,
      });
      mesh.setColorAt(i, color);
    }
    baseRef.current = bases;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [structure, count]);

  useFrame(() => {
    const mesh = meshRef.current;
    const bases = baseRef.current;
    if (!mesh || !bases || count === 0) return;
    const reveal = growthRef.current.flowers;
    const matrix = new Matrix4();
    const scl = new Vector3();

    for (let i = 0; i < count; i++) {
      const b = bases[i]!;
      const r = Math.min(1, Math.max(0, reveal));
      const ease = r * r * (3 - 2 * r);
      scl.set(b.scale * ease, b.scale * 0.7 * ease, b.scale * ease);
      matrix.compose(b.pos, b.quat, scl);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = reveal > 0.02;
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      key={`centers-${count}`}
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 12, 10]} />
      <meshStandardMaterial
        color={structure.palette.bloom}
        roughness={0.36}
        metalness={0.08}
        emissive={structure.palette.bloom}
        emissiveIntensity={0.1}
      />
    </instancedMesh>
  );
}

export function ProceduralPlantView({
  structure,
  growthClock,
  windResponse = 0.4,
  scale = 1.1,
}: Props) {
  const windRef = useRef<Group>(null);
  const growthRef = useRef<GrowthStages>(evaluateGrowth(0, 4));
  const maxDepth = useMemo(
    () => structure.branches.reduce((m, b) => Math.max(m, b.depth), 0),
    [structure.branches],
  );

  useFrame(({ clock }) => {
    const gc = growthClock.current;
    const elapsed = (performance.now() - gc.startedAt) / 1000;
    growthRef.current = evaluateGrowth(elapsed, gc.durationSec);

    const g = windRef.current;
    if (!g) return;
    const w = windResponse;
    const t = clock.elapsedTime;
    g.rotation.z = Math.sin(t * 0.55) * 0.035 * w;
    g.rotation.x = Math.sin(t * 0.37 + 1.1) * 0.018 * w;
    g.rotation.y = Math.sin(t * 0.22) * 0.012 * w;
  });

  return (
    <group ref={windRef} scale={scale}>
      {structure.branches.map((branch) => (
        <BranchMesh
          key={`${branch.id}-${growthClock.current.generation}`}
          points={branch.points}
          radiusStart={branch.radiusStart}
          radiusEnd={branch.radiusEnd}
          color={structure.palette.stem}
          depth={branch.depth}
          maxDepth={maxDepth}
          growthRef={growthRef}
        />
      ))}
      <LeafField
        structure={structure}
        growthRef={growthRef}
        windResponse={windResponse}
      />
      <PetalField structure={structure} growthRef={growthRef} />
      <BloomCenters structure={structure} growthRef={growthRef} />
    </group>
  );
}
