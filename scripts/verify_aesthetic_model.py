"""Offline check that the neural scorer's numerics are wired correctly.

Mirrors the browser path in apps/web/src/aesthetic/neuralScorer.ts: CLIP
preprocessing -> vision encoder -> L2 normalise -> LAION linear head. If the
embedding space or the normalisation convention were wrong, scores would land
far outside LAION's usual 3-7 band, which is what this script is looking for.

Needs onnxruntime + pillow, which the app itself does not:
    pip install onnxruntime pillow
    python scripts/verify_aesthetic_model.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

try:
    import numpy as np
    import onnxruntime as ort
    from PIL import Image, ImageDraw
except ImportError as exc:  # pragma: no cover - dev-only helper
    raise SystemExit(f"missing dev dependency: {exc}\n  pip install onnxruntime pillow")

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "apps" / "web" / "public" / "models"
ONNX = MODELS / "clip-vit-b32-vision.onnx"
HEAD = MODELS / "laion-aesthetic-head.json"

SIZE = 224
MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)


def preprocess(img: Image.Image) -> np.ndarray:
    img = img.convert("RGB").resize((SIZE, SIZE), Image.BICUBIC)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = (arr - MEAN) / STD
    return arr.transpose(2, 0, 1)[None, ...].astype(np.float32)


def make_samples() -> dict[str, Image.Image]:
    rng = np.random.default_rng(0)
    samples: dict[str, Image.Image] = {}

    samples["solid-dark"] = Image.new("RGB", (SIZE, SIZE), (10, 16, 24))
    samples["white-noise"] = Image.fromarray(
        rng.integers(0, 256, (SIZE, SIZE, 3), dtype=np.uint8)
    )

    grad = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    for y in range(SIZE):
        t = y / (SIZE - 1)
        grad[y, :] = (int(30 + 120 * t), int(60 + 130 * t), int(110 + 90 * t))
    samples["sky-gradient"] = Image.fromarray(grad)

    # Crude stand-in for a lit subject on the gallery backdrop.
    plantish = Image.new("RGB", (SIZE, SIZE), (10, 16, 24))
    draw = ImageDraw.Draw(plantish)
    draw.ellipse((20, 150, 204, 210), fill=(26, 40, 50))
    draw.line((112, 200, 112, 70), fill=(120, 150, 110), width=5)
    for dx, dy in ((-34, 110), (34, 100), (-24, 140), (26, 136)):
        draw.line((112, 160, 112 + dx, dy), fill=(110, 140, 105), width=3)
        draw.ellipse(
            (112 + dx - 14, dy - 10, 112 + dx + 14, dy + 10), fill=(140, 175, 130)
        )
    draw.ellipse((92, 50, 132, 90), fill=(220, 190, 170))
    samples["plant-on-dark"] = plantish

    return samples


def main() -> int:
    for path in (ONNX, HEAD):
        if not path.exists():
            raise SystemExit(f"missing {path}; run scripts/fetch_aesthetic_model.py")

    head = json.loads(HEAD.read_text(encoding="utf-8"))
    weight = np.asarray(head["weight"], dtype=np.float32)
    bias = float(head["bias"])

    session = ort.InferenceSession(str(ONNX), providers=["CPUExecutionProvider"])
    inputs = {i.name: i.shape for i in session.get_inputs()}
    outputs = {o.name: o.shape for o in session.get_outputs()}
    print("inputs :", inputs)
    print("outputs:", outputs)
    if "pixel_values" not in inputs:
        raise SystemExit("expected an input named pixel_values")
    if "image_embeds" not in outputs:
        raise SystemExit("expected an output named image_embeds")

    print()
    for name, img in make_samples().items():
        embeds = session.run(["image_embeds"], {"pixel_values": preprocess(img)})[0]
        vec = embeds[0].astype(np.float32)
        if vec.shape != (512,):
            raise SystemExit(f"expected a 512-d embedding, got {vec.shape}")
        norm = float(np.linalg.norm(vec))
        unit = vec / max(norm, 1e-8)
        score = float(np.dot(unit, weight) + bias)
        print(f"  {name:<16} |embed|={norm:7.3f}   laion={score:6.3f}")

    print(
        "\nLAION V1 normally lands around 3-7 on natural images; anything far "
        "outside that would mean the embedding or normalisation is wrong."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
