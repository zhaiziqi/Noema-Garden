import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Link } from "react-router-dom";
import { Vector3 } from "three";
import { ApiStatus } from "../components/ApiStatus";
import { SharpCanvas } from "../garden/SharpCanvas";
import { MuseumScene } from "../garden/MuseumScene";
import { GardenBed } from "../garden/GardenBed";
import {
  formGloss,
  interpretationLabel,
  pickTraitChips,
} from "../garden/formGloss";
import { fetchLlmStatus } from "../api/client";
import { useGardenStore } from "../store/gardenStore";

function formatPlantDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type OrbitHandle = {
  target: Vector3;
  update: () => void;
};

function CameraRig({
  targetX,
  targetY,
  targetZ,
}: {
  targetX: number;
  targetY: number;
  targetZ: number;
}) {
  const controlsRef = useRef<OrbitHandle | null>(null);
  const desired = useRef(new Vector3(targetX, targetY, targetZ));
  const current = useRef(new Vector3(targetX, targetY, targetZ));

  useEffect(() => {
    desired.current.set(targetX, targetY, targetZ);
  }, [targetX, targetY, targetZ]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const t = 1 - Math.exp(-delta * 4.2);
    current.current.lerp(desired.current, t);
    controls.target.copy(current.current);
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef as never}
      makeDefault
      enablePan
      minPolarAngle={0.25}
      maxPolarAngle={1.4}
      minDistance={4}
      maxDistance={36}
      target={[targetX, targetY, targetZ]}
    />
  );
}

export function HomePage() {
  const [thought, setThought] = useState("");
  const [llmLabel, setLlmLabel] = useState("LLM …");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const plants = useGardenStore((s) => s.plants);
  const selectedId = useGardenStore((s) => s.selectedId);
  const planting = useGardenStore((s) => s.planting);
  const plantPhase = useGardenStore((s) => s.plantPhase);
  const removing = useGardenStore((s) => s.removing);
  const loading = useGardenStore((s) => s.loading);
  const error = useGardenStore((s) => s.error);
  const statusLine = useGardenStore((s) => s.statusLine);
  const hydrated = useGardenStore((s) => s.hydrated);
  const loadGarden = useGardenStore((s) => s.loadGarden);
  const plantAThought = useGardenStore((s) => s.plantAThought);
  const cancelPlanting = useGardenStore((s) => s.cancelPlanting);
  const removePlant = useGardenStore((s) => s.removePlant);
  const rearrangeGarden = useGardenStore((s) => s.rearrangeGarden);
  const selectPlant = useGardenStore((s) => s.selectPlant);

  const selected = useMemo(
    () => plants.find((p) => p.id === selectedId) ?? null,
    [plants, selectedId],
  );

  const lookAt = useMemo(() => {
    if (selected) {
      return {
        x: selected.position.x,
        y: 1.15,
        z: selected.position.z,
      };
    }
    return { x: 0, y: 1.1, z: 0 };
  }, [selected]);

  const camDist = 14 + Math.min(10, plants.length * 0.45);

  useEffect(() => {
    void loadGarden();
  }, [loadGarden]);

  useEffect(() => {
    setConfirmRemove(false);
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const status = await fetchLlmStatus();
      if (cancelled) return;
      if (status.ollama === "ok" && status.model) {
        setLlmLabel(`LLM · ${status.model}`);
      } else if (status.ollama === "ok") {
        setLlmLabel("LLM online · no model");
      } else {
        setLlmLabel("LLM offline · meaning unread");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitThought(raw: string) {
    const text = raw.trim();
    if (!text || planting) return;
    const planted = await plantAThought(text);
    if (planted) setThought("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submitThought(thought);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitThought(thought);
    }
  }

  const emptyGarden = hydrated && plants.length === 0 && !planting;
  const interp = selected ? interpretationLabel(selected.source) : null;
  const chips = selected ? pickTraitChips(selected.traits) : [];
  const gloss = selected ? formGloss(selected.genome, selected.traits) : null;

  const phaseHint =
    plantPhase === "reading"
      ? "正在读懂这句话…"
      : plantPhase === "placing"
        ? "在园里找位置…"
        : "Enter · Shift+Enter 换行";

  const progressClass =
    plantPhase === "reading"
      ? "plant-progress plant-progress--reading"
      : plantPhase === "placing"
        ? "plant-progress plant-progress--placing"
        : "plant-progress";

  return (
    <div className="app-shell">
      <header className="brand-overlay brand-overlay--garden">
        <p className="brand">NOEMA</p>
        <p className="subtitle">Plant a thought.</p>

        <form className="thought-form" onSubmit={onSubmit}>
          <textarea
            ref={inputRef}
            className="thought-input"
            rows={3}
            placeholder="最近有一点迷茫，但感觉事情正在慢慢变好。"
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={planting}
          />
          {planting ? (
            <div className={progressClass} aria-hidden>
              <div className="plant-progress__bar" />
            </div>
          ) : null}
          <div className="thought-actions">
            {planting ? (
              <button
                type="button"
                className="thought-cancel-btn"
                onClick={() => cancelPlanting()}
              >
                取消
              </button>
            ) : (
              <button
                type="submit"
                className="thought-plant-btn"
                disabled={!thought.trim()}
              >
                Plant
              </button>
            )}
            <p className="thought-hint">{phaseHint}</p>
          </div>
          {error ? <p className="thought-error">{error}</p> : null}
          {statusLine && !error ? <p className="thought-status">{statusLine}</p> : null}
        </form>
      </header>

      {selected ? (
        <aside className="plant-inspect" aria-live="polite">
          <p className="plant-inspect__species">{selected.species}</p>
          <p className="plant-inspect__date">{formatPlantDate(selected.created_at)}</p>
          {interp && interp.kind !== "interpreted" ? (
            <p
              className={`plant-inspect__badge plant-inspect__badge--${interp.kind}`}
            >
              {interp.text}
            </p>
          ) : null}
          {gloss ? <p className="plant-inspect__gloss">{gloss}</p> : null}
          {chips.length > 0 ? (
            <ul className="plant-inspect__chips">
              {chips.map((chip) => (
                <li key={chip.key}>
                  {chip.label}{" "}
                  <span>{chip.value.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <blockquote className="plant-inspect__thought">“{selected.thought}”</blockquote>
          <div className="plant-inspect__actions">
            <button
              type="button"
              className="plant-inspect__close"
              onClick={() => selectPlant(null)}
            >
              Close
            </button>
            {!confirmRemove ? (
              <button
                type="button"
                className="plant-inspect__remove"
                onClick={() => setConfirmRemove(true)}
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                className="plant-inspect__remove plant-inspect__remove--confirm"
                disabled={removing}
                onClick={() => {
                  void removePlant(selected.id);
                }}
              >
                {removing ? "Removing…" : "Remove?"}
              </button>
            )}
          </div>
        </aside>
      ) : null}

      {emptyGarden ? (
        <div className="garden-empty-block">
          <p className="garden-empty">园子还空着——写下第一句想法吧。</p>
          <button
            type="button"
            className="garden-empty-focus"
            onClick={() => inputRef.current?.focus()}
          >
            去写下想法
          </button>
        </div>
      ) : null}

      <p className="garden-legend">
        意思相近的会靠在一起 · 希望仍偏中心
      </p>

      {loading && !hydrated ? <p className="garden-empty">Restoring garden…</p> : null}

      <div className="home-badges home-badges--quiet">
        {plants.length > 0 ? (
          <button
            type="button"
            className="garden-rearrange"
            onClick={() => {
              void rearrangeGarden();
            }}
            disabled={loading || planting}
          >
            Rearrange
          </button>
        ) : null}
        <div className="api-status" data-state="ok">
          {plants.length} plant{plants.length === 1 ? "" : "s"}
        </div>
        {llmLabel.includes("offline") || llmLabel.includes("unread") || llmLabel.includes("no model") ? (
          <div className="api-status" data-state="error">
            {llmLabel}
          </div>
        ) : null}
        <ApiStatus quiet />
      </div>

      {import.meta.env.DEV ? (
        <Link className="dev-corner-link" to="/dev/genome">
          Dev · Genome
        </Link>
      ) : null}

      <SharpCanvas
        camera={{
          position: [camDist * 0.9, 5.5, camDist],
          fov: 38,
          near: 0.05,
          far: 200,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onPointerMissed={() => selectPlant(null)}
        onCreated={({ gl }) => {
          gl.setClearColor("#0a1018", 1);
          gl.toneMappingExposure = 1.22;
        }}
      >
        <MuseumScene
          groundRadius={18}
          onGroundClick={() => selectPlant(null)}
        >
          <GardenBed
            plants={plants}
            selectedId={selectedId}
            onSelect={selectPlant}
          />
        </MuseumScene>
        <CameraRig targetX={lookAt.x} targetY={lookAt.y} targetZ={lookAt.z} />
      </SharpCanvas>
    </div>
  );
}
