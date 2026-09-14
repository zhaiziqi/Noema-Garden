import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PlaceholderPlant } from "../plant/PlaceholderPlant";

export function GardenScene() {
  return (
    <Canvas
      camera={{ position: [0, 2.4, 5.5], fov: 42, near: 0.1, far: 100 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#070b10"]} />
      <fog attach="fog" args={["#070b10", 8, 22]} />
      <ambientLight intensity={0.35} color="#c9d4cf" />
      <directionalLight
        position={[4, 8, 2]}
        intensity={1.1}
        color="#f0ebe1"
        castShadow={false}
      />
      <hemisphereLight args={["#8fa3b0", "#1a2228", 0.45]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial
          color="#101820"
          roughness={0.92}
          metalness={0.05}
        />
      </mesh>
      <PlaceholderPlant />
      <OrbitControls
        enablePan={false}
        minPolarAngle={0.6}
        maxPolarAngle={1.45}
        minDistance={3}
        maxDistance={10}
        target={[0, 1.1, 0]}
      />
    </Canvas>
  );
}
