# Noema Garden Architecture

## Pipeline

```text
Thought → Semantic Traits → Genome → Procedural Plant → Garden
```

## Apps

- `apps/web` — React + Vite + React Three Fiber garden client
- `apps/api` — FastAPI + SQLite local backend

## Packages

- `packages/genome` — PlantGenome schema, Traits→Genome mapping, seeded RNG
- `packages/plant-engine` — procedural plant generation (independent of React)

## Milestone status

- [x] Milestone 1 — Project Skeleton
- [x] Milestone 2 — Genome Playground
- [x] Milestone 3 — Procedural Plant Engine
- [x] Milestone 4 — Visual Design
- [x] Milestone 5 — Local LLM
- [ ] Milestone 6 — Garden
- [ ] Milestone 7 — Aesthetic Lab
- [ ] Milestone 8 — Polish

## Milestone 2 notes

- `packages/genome` — PlantGenomeV1, SeededRandom, Traits→Genome mapping
- `packages/plant-engine` — recursive branching + Catmull-Rom tubes + phyllotaxis leaves/blooms
- Playground UI: `/dev/genome`
