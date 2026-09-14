import type { Quat, Vec3 } from "./types";

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function rotateAround(axis: Vec3, angle: number, v: Vec3): Vec3 {
  const [x, y, z] = normalize(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dot = x * v[0] + y * v[1] + z * v[2];
  return [
    v[0] * c + (y * v[2] - z * v[1]) * s + x * dot * (1 - c),
    v[1] * c + (z * v[0] - x * v[2]) * s + y * dot * (1 - c),
    v[2] * c + (x * v[1] - y * v[0]) * s + z * dot * (1 - c),
  ];
}

/** Rotate +Y toward `direction`, then twist around that axis. */
export function quatFromUp(direction: Vec3, twist: number): Quat {
  const [dx, dy, dz] = direction;
  const len = Math.hypot(dx, dy, dz) || 1;
  const x = dx / len;
  const y = dy / len;
  const z = dz / len;

  const dot = y;
  let qx = 0;
  let qy = 0;
  let qz = 0;
  let qw = 1;

  if (dot < -0.999999) {
    qx = 1;
    qw = 0;
  } else if (dot < 0.999999) {
    const ax = -z;
    const ay = 0;
    const az = x;
    const al = Math.hypot(ax, ay, az) || 1;
    const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
    const s = Math.sin(angle / 2);
    qx = (ax / al) * s;
    qy = (ay / al) * s;
    qz = (az / al) * s;
    qw = Math.cos(angle / 2);
  }

  const half = twist / 2;
  const tx = x * Math.sin(half);
  const ty = y * Math.sin(half);
  const tz = z * Math.sin(half);
  const tw = Math.cos(half);

  return [
    tw * qx + tx * qw + ty * qz - tz * qy,
    tw * qy - tx * qz + ty * qw + tz * qx,
    tw * qz + tx * qy - ty * qx + tz * qw,
    tw * qw - tx * qx - ty * qy - tz * qz,
  ];
}

export function quatEulerYXZ(tiltX: number, yaw: number, tiltZ: number): Quat {
  const hx = tiltX * 0.5;
  const hy = yaw * 0.5;
  const hz = tiltZ * 0.5;
  const sx = Math.sin(hx);
  const cx = Math.cos(hx);
  const sy = Math.sin(hy);
  const cy = Math.cos(hy);
  const sz = Math.sin(hz);
  const cz = Math.cos(hz);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

export function directionAt(points: Vec3[], index: number): Vec3 {
  const i0 = Math.max(0, index - 1);
  const i1 = Math.min(points.length - 1, index + 1);
  const a = points[i0]!;
  const b = points[i1]!;
  return normalize([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
}

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
