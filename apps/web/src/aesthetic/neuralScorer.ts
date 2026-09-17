/**
 * Neural aesthetic scoring: CLIP ViT-B/32 image embedding -> LAION-Aesthetics
 * V1 linear head, all in the browser via onnxruntime-web.
 *
 * The model weights come from scripts/fetch_aesthetic_model.py; the ONNX
 * runtime itself is bundled. When the weights are missing the module reports
 * unavailable rather than throwing, so a garden without the download still
 * works — it just shows no visual score.
 */

import * as ort from "onnxruntime-web/wasm";
// Let Vite emit the runtime and hand us hashed URLs. Serving these from
// public/ instead would break the dev server: onnxruntime imports the glue
// module at runtime, and Vite refuses module imports out of public/.
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";

export const NEURAL_VERSION = "clip-b32-laion-v1";

const MODEL_URL = "/models/clip-vit-b32-vision.onnx";
const HEAD_URL = "/models/laion-aesthetic-head.json";

/** CLIP ViT-B/32 input resolution. */
export const INPUT_SIZE = 224;
const EMBED_DIM = 512;

// Standard CLIP image normalisation.
const MEAN = [0.48145466, 0.4578275, 0.40821073] as const;
const STD = [0.26862954, 0.26130258, 0.27577711] as const;

// Single-threaded keeps us off cross-origin isolation headers, and the runtime
// is bundled rather than pulled from a CDN so scoring works offline.
ort.env.wasm.wasmPaths = { wasm: ortWasmUrl, mjs: ortMjsUrl };
ort.env.wasm.numThreads = 1;

type Head = { weight: Float32Array; bias: number };

type Loaded = {
  session: ort.InferenceSession;
  head: Head;
};

let loadPromise: Promise<Loaded | null> | null = null;

async function loadHead(): Promise<Head> {
  const response = await fetch(HEAD_URL);
  if (!response.ok) throw new Error(`head ${response.status}`);
  const json = (await response.json()) as { weight: number[]; bias: number };
  if (!Array.isArray(json.weight) || json.weight.length !== EMBED_DIM) {
    throw new Error(`head expects ${EMBED_DIM} weights, got ${json.weight?.length}`);
  }
  return { weight: Float32Array.from(json.weight), bias: Number(json.bias) };
}

/** Resolves to null when the model assets are not installed. */
export function loadNeuralScorer(): Promise<Loaded | null> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const [head, session] = await Promise.all([
          loadHead(),
          ort.InferenceSession.create(MODEL_URL, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          }),
        ]);
        return { session, head };
      } catch (err) {
        console.warn(
          "[noema] neural aesthetic scorer unavailable — run scripts/fetch_aesthetic_model.py",
          err,
        );
        return null;
      }
    })();
  }
  return loadPromise;
}

/**
 * RGBA bytes -> CLIP-normalised NCHW float tensor data.
 * Alpha is composited onto black to match what the scene shows.
 */
export function toPixelValues(rgba: Uint8ClampedArray): Float32Array {
  const area = INPUT_SIZE * INPUT_SIZE;
  const out = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    const o = i * 4;
    const a = rgba[o + 3]! / 255;
    for (let c = 0; c < 3; c++) {
      const v = (rgba[o + c]! / 255) * a;
      out[c * area + i] = (v - MEAN[c]!) / STD[c]!;
    }
  }
  return out;
}

function l2Normalize(vec: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i]! * vec[i]!;
  const norm = Math.sqrt(sum);
  if (norm < 1e-8) return vec;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i]! / norm;
  return out;
}

/**
 * Raw LAION aesthetic score for one 224x224 RGBA frame, or null when the
 * model is not installed. Values land roughly in 3–7 for natural images.
 */
export async function scoreFrame(rgba: Uint8ClampedArray): Promise<number | null> {
  const loaded = await loadNeuralScorer();
  if (!loaded) return null;

  const tensor = new ort.Tensor("float32", toPixelValues(rgba), [
    1,
    3,
    INPUT_SIZE,
    INPUT_SIZE,
  ]);
  const outputs = await loaded.session.run({ pixel_values: tensor });
  const embeds = outputs.image_embeds;
  if (!embeds) throw new Error("model did not return image_embeds");

  const normalized = l2Normalize(embeds.data as Float32Array);
  let score = loaded.head.bias;
  for (let i = 0; i < EMBED_DIM; i++) score += normalized[i]! * loaded.head.weight[i]!;
  return score;
}
