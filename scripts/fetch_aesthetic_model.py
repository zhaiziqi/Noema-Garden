"""Fetch the model weights the neural aesthetic scorer needs.

Both files land in apps/web/public/models/ so Vite serves them to the browser:

  clip-vit-b32-vision.onnx    CLIP ViT-B/32 image encoder, quantised (~85 MB)
  laion-aesthetic-head.json   LAION-Aesthetics V1 linear head (512 weights + bias)

The head ships as a PyTorch .pth, but it only holds one nn.Linear(512, 1). A
.pth is a zip of pickled metadata plus raw tensor storages, so the weights come
out with zipfile + struct and the project stays free of a torch dependency.

The ONNX runtime is not fetched here — it comes from the onnxruntime-web npm
package and Vite bundles it.

Usage:  python scripts/fetch_aesthetic_model.py [--force]
Set NOEMA_HF_ENDPOINT to pin a mirror, e.g. https://hf-mirror.com
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps" / "web" / "public" / "models"

HF_REPO = "Xenova/clip-vit-base-patch32"
HF_FILE = "onnx/vision_model_quantized.onnx"
HF_ENDPOINTS = (
    os.environ.get("NOEMA_HF_ENDPOINT"),
    "https://huggingface.co",
    "https://hf-mirror.com",
)

HEAD_URL = (
    "https://github.com/LAION-AI/aesthetic-predictor/raw/main/sa_0_4_vit_b_32_linear.pth"
)

ONNX_OUT = OUT_DIR / "clip-vit-b32-vision.onnx"
HEAD_OUT = OUT_DIR / "laion-aesthetic-head.json"

EMBED_DIM = 512


def _download(url: str, dest: Path) -> None:
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(url, timeout=60) as response:
        total = int(response.headers.get("Content-Length") or 0)
        done = 0
        with tmp.open("wb") as handle:
            while True:
                chunk = response.read(1 << 20)
                if not chunk:
                    break
                handle.write(chunk)
                done += len(chunk)
                if total:
                    pct = 100.0 * done / total
                    print(f"\r  {done / 1e6:7.1f} / {total / 1e6:.1f} MB  {pct:5.1f}%", end="")
                else:
                    print(f"\r  {done / 1e6:7.1f} MB", end="")
    print()
    tmp.replace(dest)


def fetch_onnx(force: bool) -> None:
    if ONNX_OUT.exists() and not force:
        print(f"skip  {ONNX_OUT.name} ({ONNX_OUT.stat().st_size / 1e6:.1f} MB already present)")
        return
    errors: list[str] = []
    for endpoint in HF_ENDPOINTS:
        if not endpoint:
            continue
        url = f"{endpoint.rstrip('/')}/{HF_REPO}/resolve/main/{HF_FILE}"
        print(f"fetch {ONNX_OUT.name} from {endpoint}")
        try:
            _download(url, ONNX_OUT)
            return
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            errors.append(f"{endpoint}: {exc}")
            print(f"  failed: {exc}")
    raise SystemExit("could not download the CLIP encoder:\n  " + "\n  ".join(errors))


def extract_head(pth: Path) -> dict[str, object]:
    """Pull nn.Linear(512, 1) weights straight out of the .pth archive."""
    with zipfile.ZipFile(pth) as archive:
        names = archive.namelist()
        meta = next(n for n in names if n.endswith("data.pkl"))
        blob = archive.read(meta)
        # The pickle names each storage; 'weight' is declared before 'bias'.
        if blob.find(b"weight") < 0 or blob.find(b"bias") < 0:
            raise SystemExit(f"unexpected checkpoint layout in {pth.name}")
        if blob.find(b"weight") > blob.find(b"bias"):
            raise SystemExit("weight/bias order differs from the expected layout")

        prefix = meta[: -len("data.pkl")]
        weight_raw = archive.read(f"{prefix}data/0")
        bias_raw = archive.read(f"{prefix}data/1")

    if len(weight_raw) != EMBED_DIM * 4:
        raise SystemExit(f"expected {EMBED_DIM} float32 weights, got {len(weight_raw)} bytes")
    if len(bias_raw) != 4:
        raise SystemExit(f"expected 1 float32 bias, got {len(bias_raw)} bytes")

    weight = list(struct.unpack(f"<{EMBED_DIM}f", weight_raw))
    bias = struct.unpack("<f", bias_raw)[0]
    return {
        "model": "laion-aesthetic-v1",
        "encoder": "clip-vit-b32",
        "dim": EMBED_DIM,
        "weight": weight,
        "bias": bias,
    }


def fetch_head(force: bool) -> None:
    if HEAD_OUT.exists() and not force:
        print(f"skip  {HEAD_OUT.name} (already present)")
        return
    pth = OUT_DIR / "sa_0_4_vit_b_32_linear.pth"
    print(f"fetch {pth.name}")
    _download(HEAD_URL, pth)
    head = extract_head(pth)
    HEAD_OUT.write_text(json.dumps(head), encoding="utf-8")
    pth.unlink()
    norm = sum(w * w for w in head["weight"]) ** 0.5  # type: ignore[union-attr]
    print(f"  wrote {HEAD_OUT.name}  |w|={norm:.3f}  bias={head['bias']:.4f}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-download even if present")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fetch_head(args.force)
    fetch_onnx(args.force)
    print(f"\nweights ready in {OUT_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
