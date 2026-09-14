# Genome

## PlantGenomeV1

Continuous visual params are `0.0 … 1.0`. Schema lives in `packages/genome/src/schema.ts`.

Key fields:

- structure: `height`, `trunkThickness`, `branchDensity`, `branchAngle`, `branchLength`, `curvature`, `asymmetry`
- foliage: `leafDensity`, `leafSize`, `leafShape`
- bloom: `bloomDensity`, `petalCount`, `petalScale`
- look: `hue`, `saturation`, `brightness`, `translucency`
- motion hooks: `growthSpeed`, `windResponse`
- identity: `seed`, `archetype`, `genome_version = 1`

## Rules

- Genome + seed must be fully reproducible
- Plant generation never calls uncontrolled `Math.random()`
- Use `SeededRandom` from `packages/genome/src/random.ts`
- Traits → Genome mapping stays in `packages/genome/src/mapping.ts`

## Playground

Open `/dev/genome` to scrub parameters against a live procedural plant.
