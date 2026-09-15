import { useEffect, useRef, type MutableRefObject } from "react";
import { growthDuration } from "./growth";

export type GrowthClock = {
  startedAt: number;
  durationSec: number;
  generation: number;
};

/**
 * Growth timing only — progress is sampled in useFrame (no per-frame React renders).
 * initialElapsedSec is sampled when resetKey changes, not on every age tick.
 */
export function useGrowthClock(
  growthSpeed: number,
  resetKey: string | number,
  options?: {
    startFullyGrown?: boolean;
    /** Wall-clock seconds already elapsed (resume after refresh). */
    initialElapsedSec?: number;
  },
): MutableRefObject<GrowthClock> {
  const durationSec = growthDuration(growthSpeed);
  const startFullyGrown = options?.startFullyGrown ?? false;
  const initialElapsedRef = useRef(options?.initialElapsedSec ?? 0);
  initialElapsedRef.current = options?.initialElapsedSec ?? 0;

  const clockRef = useRef<GrowthClock>({
    startedAt: performance.now(),
    durationSec,
    generation: 0,
  });

  useEffect(() => {
    const duration = growthDuration(growthSpeed);
    let elapsedMs: number;
    if (startFullyGrown) {
      elapsedMs = duration * 1000;
    } else {
      elapsedMs =
        Math.max(0, Math.min(duration, initialElapsedRef.current)) * 1000;
    }
    clockRef.current = {
      startedAt: performance.now() - elapsedMs,
      durationSec: duration,
      generation: clockRef.current.generation + 1,
    };
  }, [growthSpeed, resetKey, startFullyGrown]);

  return clockRef;
}
