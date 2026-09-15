import { useEffect, useRef, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import type { CanvasProps, RootState } from "@react-three/fiber";

type Props = {
  children: ReactNode;
  className?: string;
  camera?: CanvasProps["camera"];
  gl?: CanvasProps["gl"];
  onCreated?: CanvasProps["onCreated"];
  onPointerMissed?: CanvasProps["onPointerMissed"];
};

/**
 * Blurry root cause (measured in DevTools):
 * - CSS box: ~1560×1080
 * - WebGL drawing buffer: stuck at HTML default 300×150
 * Browser upscales 300×150 → looks extremely soft.
 *
 * R3F's built-in resizer can fight/re-lock that tiny size when it measures
 * the canvas itself. We disable it and size exclusively from the outer host.
 */
export function SharpCanvas({
  children,
  className = "sharp-canvas-host",
  camera,
  gl,
  onCreated,
  onPointerMissed,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<RootState | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const apply = () => {
      const state = stateRef.current;
      if (!state) return;

      const width = Math.max(1, Math.floor(host.clientWidth));
      const height = Math.max(1, Math.floor(host.clientHeight));
      if (width < 2 || height < 2) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.setDpr(dpr);
      state.setSize(width, height);
      state.gl.setPixelRatio(dpr);
      state.gl.setSize(width, height, false);

      const canvas = state.gl.domElement;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.display = "block";
    };

    const ro = new ResizeObserver(() => apply());
    ro.observe(host);
    window.addEventListener("resize", apply);

    // Apply once state exists; also retry a few frames for late WebGL init.
    const timers = [0, 32, 100, 250].map((ms) => window.setTimeout(apply, ms));

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return (
    <div ref={hostRef} className={className}>
      <Canvas
        camera={camera}
        dpr={1}
        gl={gl}
        // Avoid R3F measuring the canvas default 300×150 box.
        // `resize={false}` is intentional; we size from the outer host.
        {...({ resize: false } as object)}
        onPointerMissed={onPointerMissed}
        onCreated={(state) => {
          stateRef.current = state;
          const host = hostRef.current;
          if (host) {
            const width = Math.max(1, Math.floor(host.clientWidth));
            const height = Math.max(1, Math.floor(host.clientHeight));
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            state.setDpr(dpr);
            state.setSize(width, height);
            state.gl.setPixelRatio(dpr);
            state.gl.setSize(width, height, false);
            state.gl.domElement.style.width = `${width}px`;
            state.gl.domElement.style.height = `${height}px`;
          }
          onCreated?.(state);
        }}
      >
        {children}
      </Canvas>
    </div>
  );
}
