import { createDefaultGenome } from "../../genome/src/index.ts";
import { generatePlant } from "../src/generatePlant.ts";

const genome = createDefaultGenome(12345);
const a = generatePlant(genome);
const b = generatePlant(genome);

function sig(p: ReturnType<typeof generatePlant>) {
  return JSON.stringify({
    b: p.branches.map((x) => [x.id, x.points, x.radiusStart]),
    l: p.leaves.map((x) => [x.position, x.scale, x.quaternion]),
    f: p.blooms.map((x) => [x.position, x.scale, x.petalCount]),
    c: p.palette,
  });
}

const same = sig(a) === sig(b);
const changed = sig(a) !== sig(generatePlant({ ...genome, height: 0.95 }));

console.log(
  JSON.stringify(
    {
      same,
      changed,
      branches: a.branches.length,
      leaves: a.leaves.length,
      blooms: a.blooms.length,
      height: a.boundsHeight,
    },
    null,
    2,
  ),
);

if (!same || !changed) process.exit(1);
