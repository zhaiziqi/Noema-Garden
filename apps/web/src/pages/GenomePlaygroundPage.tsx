import { useMemo, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import { Link } from "react-router-dom";
import { generatePlant } from "@noema/plant-engine";
import { GENOME_PARAM_KEYS, type GenomeParamKey } from "@noema/genome";
import { ProceduralPlantView } from "../plant/ProceduralPlantView";
import { useGenomeStore } from "../store/genomeStore";
import { SharpCanvas } from "../garden/SharpCanvas";
import { MuseumScene } from "../garden/MuseumScene";
import { useGrowthClock } from "../plant/useGrowthClock";
import { growthDuration } from "../plant/growth";

const SLIDER_KEYS: GenomeParamKey[] = [
  "height",
  "trunkThickness",
  "branchDensity",
  "branchAngle",
  "branchLength",
  "curvature",
  "asymmetry",
  "leafDensity",
  "leafSize",
  "leafShape",
  "bloomDensity",
  "petalCount",
  "petalScale",
  "hue",
  "saturation",
  "brightness",
  "translucency",
  "growthSpeed",
  "windResponse",
];

const LABELS: Record<GenomeParamKey, string> = {
  height: "Height",
  trunkThickness: "Trunk thickness",
  branchDensity: "Branch density",
  branchAngle: "Branch angle",
  branchLength: "Branch length",
  curvature: "Curvature",
  asymmetry: "Asymmetry",
  leafDensity: "Leaf density",
  leafSize: "Leaf size",
  leafShape: "Leaf shape",
  bloomDensity: "Bloom density",
  petalCount: "Petal count",
  petalScale: "Petal scale",
  hue: "Hue",
  saturation: "Saturation",
  brightness: "Brightness",
  translucency: "Translucency",
  growthSpeed: "Growth speed",
  windResponse: "Wind response",
};

function GenomePanel({ onReplay }: { onReplay: () => void }) {
  const genome = useGenomeStore((s) => s.genome);
  const setParam = useGenomeStore((s) => s.setParam);
  const setSeed = useGenomeStore((s) => s.setSeed);
  const setArchetype = useGenomeStore((s) => s.setArchetype);
  const reset = useGenomeStore((s) => s.reset);
  const randomizeSeed = useGenomeStore((s) => s.randomizeSeed);

  return (
    <aside className="genome-panel">
      <div className="genome-panel__header">
        <p className="genome-kicker">Dev</p>
        <h1>Genome Playground</h1>
        <p className="genome-note">
          Midnight Botanical Museum — drag parameters, watch growth & wind.
        </p>
      </div>

      <label className="genome-field">
        <span>Seed</span>
        <div className="genome-seed-row">
          <input
            type="number"
            value={genome.seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
          />
          <button type="button" onClick={randomizeSeed}>
            Reseed
          </button>
          <button type="button" onClick={reset}>
            Reset
          </button>
        </div>
      </label>

      <label className="genome-field">
        <span>Archetype</span>
        <select
          value={genome.archetype}
          onChange={(e) =>
            setArchetype(e.target.value as "flower" | "shrub" | "tree")
          }
        >
          <option value="flower">Flower</option>
          <option value="shrub">Shrub</option>
          <option value="tree">Tree</option>
        </select>
      </label>

      <button type="button" className="genome-replay" onClick={onReplay}>
        Replay growth ({growthDuration(genome.growthSpeed).toFixed(1)}s)
      </button>

      <div className="genome-sliders">
        {SLIDER_KEYS.map((key) => (
          <label key={key} className="genome-slider">
            <div className="genome-slider__meta">
              <span>{LABELS[key]}</span>
              <span>{genome[key].toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={genome[key]}
              onChange={(e) => setParam(key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <p className="genome-footer">
        Params tracked: {GENOME_PARAM_KEYS.length} · version{" "}
        {genome.genome_version}
      </p>
      <Link className="genome-home-link" to="/home">
        ← Garden home
      </Link>
    </aside>
  );
}

function PlantViewport({ replayToken }: { replayToken: number }) {
  const genome = useGenomeStore((s) => s.genome);
  const structure = useMemo(() => generatePlant(genome), [genome]);
  const targetY = Math.max(0.85, structure.boundsHeight * 0.4);
  const resetKey = `${genome.seed}-${genome.archetype}-${replayToken}-${Math.round(genome.height * 100)}-${Math.round(genome.branchDensity * 100)}-${Math.round(genome.bloomDensity * 100)}`;
  const growthClock = useGrowthClock(genome.growthSpeed, resetKey);
  const camDist = 3.4 + structure.boundsHeight * 0.55;

  return (
    <div className="genome-viewport">
      <SharpCanvas
        camera={{
          position: [camDist * 0.72, 1.6 + structure.boundsHeight * 0.28, camDist],
          fov: 38,
          near: 0.05,
          far: 100,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0a1018", 1);
          gl.toneMappingExposure = 1.22;
        }}
      >
        <MuseumScene>
          <ProceduralPlantView
            structure={structure}
            growthClock={growthClock}
            windResponse={genome.windResponse}
            scale={1.05}
          />
        </MuseumScene>

        <OrbitControls
          makeDefault
          enablePan={false}
          minPolarAngle={0.3}
          maxPolarAngle={1.42}
          minDistance={2}
          maxDistance={14}
          target={[0, targetY, 0]}
        />
      </SharpCanvas>
      <div className="genome-stats">
        {structure.archetype} · branches {structure.branches.length} · leaves{" "}
        {structure.leaves.length} · petals {structure.petals.length} · blooms{" "}
        {structure.blooms.length} · h {structure.boundsHeight.toFixed(2)}
      </div>
    </div>
  );
}

export function GenomePlaygroundPage() {
  const [replay, setReplay] = useState(0);

  return (
    <div className="genome-layout">
      <GenomePanel onReplay={() => setReplay((n) => n + 1)} />
      <PlantViewport replayToken={replay} />
    </div>
  );
}
