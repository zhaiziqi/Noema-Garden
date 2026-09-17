/**
 * Offscreen "portrait studio" for neural scoring.
 *
 * A plant's score has to describe the plant, not the snapshot, so everything
 * about the capture is fixed: 224x224 at dpr 1, one lighting setup, one camera
 * angle, and a distance derived from the plant's own height so every subject
 * fills the frame identically. The clock starts fully grown so age never leaks
 * into the score.
 *
 * Bump RIG_VERSION whenever any of that changes — stored scores are only
 * comparable within one rig.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { generatePlant } from "@noema/plant-engine";
import type { GardenPlant } from "../store/gardenStore";
import { ProceduralPlantView } from "../plant/ProceduralPlantView";
import { useGrowthClock } from "../plant/useGrowthClock";
import { INPUT_SIZE } from "./neuralScorer";

export const RIG_VERSION = "portrait-1";

/** Frames to let instanced matrices and branch scales settle before reading. */
const WARMUP_FRAMES = 4;

const BACKGROUND = "#0a1018";
const VIEW_DIR = new Vector3(0.36, 0.42, 0.83).normalize();

function archetypeScale(archetype: string): number {
  if (archetype === "tree") return 1.0;
  if (archetype === "shrub") return 1.12;
  return 1.28;
}

function PortraitCamera({ height }: { height: number }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const distance = height * 2.2;
    camera.position.copy(VIEW_DIR).multiplyScalar(distance);
    camera.lookAt(0, height * 0.5, 0);
    camera.updateProjectionMatrix();
  }, [camera, height]);
  return null;
}

function FrameGrabber({
  token,
  onFrame,
}: {
  token: number;
  onFrame: (rgba: Uint8ClampedArray) => void;
}) {
  const gl = useThree((s) => s.gl);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const seen = useRef(-1);
  const frames = useRef(0);

  useFrame(() => {
    if (seen.current === token) return;
    frames.current += 1;
    if (frames.current < WARMUP_FRAMES) return;

    if (!scratch.current) {
      const canvas = document.createElement("canvas");
      canvas.width = INPUT_SIZE;
      canvas.height = INPUT_SIZE;
      scratch.current = canvas;
    }
    const ctx = scratch.current.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    ctx.drawImage(gl.domElement, 0, 0, INPUT_SIZE, INPUT_SIZE);

    seen.current = token;
    frames.current = 0;
    onFrame(ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data);
  });

  // A new subject restarts the warm-up count.
  useEffect(() => {
    frames.current = 0;
  }, [token]);

  return null;
}

function Subject({ plant }: { plant: GardenPlant }) {
  const structure = useMemo(
    () => generatePlant(plant.genome),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed identifies the genome
    [plant.id, plant.genome.seed, plant.genome.archetype],
  );
  const scale = archetypeScale(plant.genome.archetype);
  const growthClock = useGrowthClock(plant.genome.growthSpeed, `portrait-${plant.id}`, {
    startFullyGrown: true,
  });
  const height = Math.max(0.8, structure.boundsHeight * scale);

  return (
    <>
      <PortraitCamera height={height} />
      <color attach="background" args={[BACKGROUND]} />

      {/* Fixed three-point setup — intensities must not depend on the subject. */}
      <ambientLight intensity={0.58} color="#e4ece6" />
      <hemisphereLight args={["#d0e0d6", "#243040", 0.95]} />
      <directionalLight position={[3.2, 4.4, 2.4]} intensity={1.95} color="#f7f3ea" />
      <directionalLight position={[-2.8, 2.2, -1.6]} intensity={0.7} color="#8eb0c4" />
      <directionalLight position={[-1.4, 1.2, 2.8]} intensity={0.55} color="#c5dde8" />

      {/* Ground disk scaled to the subject so the composition stays constant. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[height * 1.35, 64]} />
        <meshStandardMaterial color="#1a2832" roughness={0.92} metalness={0.04} />
      </mesh>

      <ProceduralPlantView
        structure={structure}
        growthClock={growthClock}
        windResponse={0}
        scale={scale}
      />
    </>
  );
}

type Props = {
  plant: GardenPlant | null;
  /** Monotonic token; a change means "capture this subject once". */
  token: number;
  onFrame: (rgba: Uint8ClampedArray) => void;
};

/**
 * Mounted only while there is something to score, so the extra WebGL context
 * goes away once the queue drains.
 */
export function PortraitRig({ plant, token, onFrame }: Props) {
  if (!plant) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: "-10000px",
        top: 0,
        width: INPUT_SIZE,
        height: INPUT_SIZE,
        pointerEvents: "none",
      }}
    >
      <Canvas
        dpr={1}
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          alpha: false,
          powerPreference: "low-power",
        }}
        camera={{ fov: 35, near: 0.05, far: 200 }}
        style={{ width: INPUT_SIZE, height: INPUT_SIZE }}
      >
        <Subject key={plant.id} plant={plant} />
        <FrameGrabber token={token} onFrame={onFrame} />
      </Canvas>
    </div>
  );
}
