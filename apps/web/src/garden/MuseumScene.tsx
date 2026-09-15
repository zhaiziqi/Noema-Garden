import type { ReactNode } from "react";
import { ContactShadows } from "@react-three/drei";

type Props = {
  children?: ReactNode;
  /** Show soft contact shadow under the plant */
  shadows?: boolean;
  /** Ground disk radius (museum default ~7.5, garden bed ~18) */
  groundRadius?: number;
  /** Click empty ground (deselect plant). */
  onGroundClick?: () => void;
};

/**
 * Midnight Botanical Museum atmosphere — shared by Garden + Playground.
 * Readable night: lifted fill/key and ground, fog pushed back so forms stay crisp.
 */
export function MuseumScene({
  children,
  shadows = true,
  groundRadius = 7.5,
  onGroundClick,
}: Props) {
  const ringInner = groundRadius * 0.2;
  const ringOuter = groundRadius * 0.28;
  const ringMid = groundRadius * 0.48;
  const ringFar = groundRadius * 0.72;
  const ringRim = groundRadius * 0.92;

  return (
    <>
      <color attach="background" args={["#0a1018"]} />
      <fog attach="fog" args={["#0a1018", groundRadius * 1.8, groundRadius * 3.6]} />

      {/* Soft museum key + cool fill + thin rim — lifted for stem/leaf readability */}
      <ambientLight intensity={0.58} color="#e4ece6" />
      <hemisphereLight args={["#d0e0d6", "#243040", 0.95]} />
      <directionalLight
        position={[groundRadius * 0.55, groundRadius * 0.7, groundRadius * 0.35]}
        intensity={1.95}
        color="#f7f3ea"
        castShadow={false}
      />
      <directionalLight
        position={[-groundRadius * 0.5, groundRadius * 0.35, -groundRadius * 0.25]}
        intensity={0.7}
        color="#8eb0c4"
      />
      <directionalLight
        position={[0.5, 2.5, -groundRadius * 0.55]}
        intensity={0.5}
        color="#e4d4b8"
      />
      {/* Thin cool rim so silhouettes separate from the void */}
      <directionalLight
        position={[-2.5, 1.8, groundRadius * 0.45]}
        intensity={0.55}
        color="#c5dde8"
      />
      {/* Soft fill for the whole bed — not center-only under-glow */}
      <pointLight
        position={[0, 1.2, 0]}
        intensity={0.28}
        color="#9bb8a6"
        distance={groundRadius * 1.6}
      />
      <pointLight
        position={[groundRadius * 0.45, 0.8, groundRadius * 0.2]}
        intensity={0.18}
        color="#a8b8a0"
        distance={groundRadius * 0.9}
      />
      <pointLight
        position={[-groundRadius * 0.4, 0.8, -groundRadius * 0.25]}
        intensity={0.16}
        color="#8aa0b0"
        distance={groundRadius * 0.9}
      />

      {/* Ground plane — charcoal-green, not void black */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onGroundClick?.();
        }}
      >
        <circleGeometry args={[groundRadius, 96]} />
        <meshStandardMaterial
          color="#1a2832"
          roughness={0.92}
          metalness={0.04}
        />
      </mesh>

      {/* Soft rings — inner clearing + mid belts + outer garden rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[ringInner, ringInner + 0.06, 96]} />
        <meshBasicMaterial color="#a8c0b4" transparent opacity={0.28} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[ringOuter, ringOuter + 0.035, 96]} />
        <meshBasicMaterial color="#8a9e94" transparent opacity={0.14} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry args={[ringMid, ringMid + 0.03, 112]} />
        <meshBasicMaterial color="#7a9088" transparent opacity={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <ringGeometry args={[ringFar, ringFar + 0.028, 128]} />
        <meshBasicMaterial color="#6d8278" transparent opacity={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[ringRim, ringRim + 0.04, 128]} />
        <meshBasicMaterial color="#7a9088" transparent opacity={0.14} />
      </mesh>

      {shadows ? (
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.32}
          scale={groundRadius * 1.85}
          blur={2.8}
          far={6}
          color="#05080c"
        />
      ) : null}

      {children}
    </>
  );
}
