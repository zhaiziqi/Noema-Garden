import { useEffect, useRef, type MutableRefObject } from "react";
import { growthDuration } from "./growth";

export type GrowthClock = {
  startedAt: number;
  durationSec: number;
  generation: number;
};

/**
 * Growth timing only — progress is sampled in useFrame (no per-frame React renders).
 */
export function useGrowthClock(
  growthSpeed: number,
  resetKey: string | number,
  options?: { startFullyGrown?: boolean },
): MutableRefObject<GrowthClock> {
  const durationSec = growthDuration(growthSpeed);
  const startFullyGrown = options?.startFullyGrown ?? false;
  const clockRef = useRef<GrowthClock>({
    startedAt: performance.now() - (startFullyGrown ? durationSec * 1000 : 0),
    durationSec,
    generation: 0,
  });

  useEffect(() => {
    const duration = growthDuration(growthSpeed);
    clockRef.current = {
      startedAt: performance.now() - (startFullyGrown ? duration * 1000 : 0),
      durationSec: duration,
      generation: clockRef.current.generation + 1,
    };
  }, [growthSpeed, resetKey, startFullyGrown]);

  return clockRef;
}
