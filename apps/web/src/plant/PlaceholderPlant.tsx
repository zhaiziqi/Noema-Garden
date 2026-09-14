export function PlaceholderPlant() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 1.4, 12]} />
        <meshStandardMaterial color="#5f7a68" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.42, 24, 16]} />
        <meshStandardMaterial
          color="#8fae95"
          roughness={0.55}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh position={[0.35, 1.35, 0.1]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial
          color="#a8c4ad"
          roughness={0.6}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}
