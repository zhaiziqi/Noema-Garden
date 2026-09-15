import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { generatePlant } from "@noema/plant-engine";
import type { GardenPlant } from "../store/gardenStore";
import { ProceduralPlantView } from "../plant/ProceduralPlantView";
import { useGrowthClock } from "../plant/useGrowthClock";

type Props = {
  plant: GardenPlant;
  selected: boolean;
  onSelect: (id: number) => void;
};

function GardenPlantInstance({ plant, selected, onSelect }: Props) {
  const structure = useMemo(() => generatePlant(plant.genome), [plant.genome]);
  const grown = !plant.animateGrowth;
  const growthClock = useGrowthClock(
    plant.genome.growthSpeed,
    `${plant.id}-${grown ? "settled" : "grow"}-${plant.initialElapsedSec.toFixed(2)}`,
    {
      startFullyGrown: grown,
      initialElapsedSec: plant.initialElapsedSec,
    },
  );

  const scale =
    plant.genome.archetype === "tree" ? 1.0 : plant.genome.archetype === "shrub" ? 1.12 : 1.28;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(plant.id);
  }

  return (
    <group
      position={[plant.position.x, 0, plant.position.z]}
      onClick={handleClick}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, structure.boundsHeight * 0.45, 0]} visible={false}>
        <cylinderGeometry args={[0.55, 0.7, structure.boundsHeight * 0.95, 12]} />
        <meshBasicMaterial />
      </mesh>

      <ProceduralPlantView
        structure={structure}
        growthClock={growthClock}
        windResponse={plant.genome.windResponse}
        scale={scale}
      />

      {selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.55, 0.62, 48]} />
          <meshBasicMaterial color="#c9d8cc" transparent opacity={0.55} />
        </mesh>
      ) : null}
    </group>
  );
}

type BedProps = {
  plants: GardenPlant[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function GardenBed({ plants, selectedId, onSelect }: BedProps) {
  return (
    <group>
      {plants.map((plant) => (
        <GardenPlantInstance
          key={plant.id}
          plant={plant}
          selected={plant.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
