# Noema Garden

Local digital garden: thoughts become semantic traits, then a reproducible Plant Genome, then a procedural 3D plant.

```text
Thought → Semantic Traits → Genome → Procedural Plant → Garden
```

## Current milestone

**Milestone 6 — Garden** is ready.

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/), plant a thought, watch it grow into the garden, refresh to restore, click a plant to read the original thought.

Requires [Ollama](https://ollama.com) + a Qwen model for real traits; without it the API falls back to default traits + thought seed so plants still generate.

```bash
# After installing Ollama:
ollama pull qwen2.5:3b
# or when available:
ollama pull qwen3.5:4b
```


## Requirements

- Node.js 20+
- Python 3.11+

## Setup

```bash
npm install

python -m venv .venv
# Windows
.\.venv\Scripts\Activate.ps1
pip install -r apps/api/requirements.txt
```

## Run

Terminal 1 — API:

```bash
cd C:\Users\yashuai.wang\Documents\plant_project
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000
```

Terminal 2 — Web (ensure Node is on PATH):

```bash
cd C:\Users\yashuai.wang\Documents\plant_project
npm run dev:web
```

- Garden home: http://127.0.0.1:5173/
- Genome Playground: http://127.0.0.1:5173/dev/genome

## Layout

```text
apps/web                 React + R3F client
apps/api                 FastAPI + SQLite
packages/genome          PlantGenomeV1, mapping, seeded RNG
packages/plant-engine    Procedural generation (no React)
research/aesthetics      Aesthetic Lab (later)
docs/
data/                    SQLite (runtime)
```
