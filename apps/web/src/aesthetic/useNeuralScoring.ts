/**
 * Background driver for neural aesthetic scoring.
 *
 * Walks every plant that has no score for the current model+rig combination,
 * one at a time, during idle time. New plants and the initial backfill of an
 * existing garden take the same path. Nothing here blocks the UI: if the model
 * assets are missing the whole thing switches itself off.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { putNeuralScore } from "../api/client";
import { useGardenStore, type GardenPlant } from "../store/gardenStore";
import { NEURAL_VERSION, scoreFrame } from "./neuralScorer";
import { RIG_VERSION } from "./PortraitRig";

/** Scores are only comparable within one model *and* one capture rig. */
export const SCORER_TAG = `${NEURAL_VERSION}+${RIG_VERSION}`;

/**
 * Breathing room between subjects so the garden stays responsive. Capture is
 * driven by the render loop, which already pauses on a hidden tab, so a plain
 * timer is enough — requestIdleCallback can stall indefinitely in background
 * tabs and would leave the queue stuck.
 */
const GAP_MS = 400;

export function useNeuralScoring(plants: GardenPlant[]) {
  const setPlantNeural = useGardenStore((s) => s.setPlantNeural);
  const refreshGarden = useGardenStore((s) => s.refreshGarden);

  const [current, setCurrent] = useState<GardenPlant | null>(null);
  const [token, setToken] = useState(0);

  const currentRef = useRef<GardenPlant | null>(null);
  currentRef.current = current;

  const busy = useRef(false);
  const unsupported = useRef(false);
  const skipped = useRef<Set<number>>(new Set());
  const scoredAny = useRef(false);

  const pending = useMemo(
    () =>
      plants.filter(
        (p) => p.neural?.version !== SCORER_TAG && !skipped.current.has(p.id),
      ),
    [plants],
  );

  // Pick up the next subject once the previous one is done.
  useEffect(() => {
    if (unsupported.current || busy.current || current || pending.length === 0) return;
    const next = pending[0]!;
    const handle = window.setTimeout(() => {
      setCurrent(next);
      setToken((t) => t + 1);
    }, GAP_MS);
    return () => window.clearTimeout(handle);
  }, [pending, current]);

  // Ranks are garden-wide, so they only settle after the last subject.
  useEffect(() => {
    if (current || pending.length > 0 || !scoredAny.current) return;
    scoredAny.current = false;
    void refreshGarden();
  }, [current, pending.length, refreshGarden]);

  const onFrame = useCallback(
    async (rgba: Uint8ClampedArray) => {
      const plant = currentRef.current;
      if (!plant || busy.current) return;
      busy.current = true;
      try {
        const raw = await scoreFrame(rgba);
        if (raw === null) {
          // Assets absent — stop trying for this session.
          unsupported.current = true;
          return;
        }
        const record = await putNeuralScore(plant.id, raw, SCORER_TAG);
        setPlantNeural(plant.id, record.neural ?? null);
        scoredAny.current = true;
      } catch (err) {
        console.warn(`[noema] could not score plant ${plant.id}`, err);
        skipped.current.add(plant.id);
      } finally {
        busy.current = false;
        setCurrent(null);
      }
    },
    [setPlantNeural],
  );

  return {
    subject: current,
    token,
    onFrame,
    remaining: pending.length,
  };
}
