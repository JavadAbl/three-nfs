// ─── Car-vs-car collision: oriented-box SAT + arcade impulse response ───────
// Cars are rotated rectangles in the XZ plane (heading + collHalfL/W).
// Resolution = positional separation along the minimum translation vector
// plus an equal-mass impulse exchange, a tangential scrub and a small yaw
// kick on offset hits so contacts feel physical. Remote cars are skipped:
// their transforms are network-authoritative and act as ghosts.
import * as THREE from "three";
import type { Car } from "./Car";

export interface CarContact {
  a: Car;
  b: Car;
  /** world-space contact point (middle of the overlap interval) */
  point: THREE.Vector3;
  /** closing speed removed by the impulse (m/s) */
  impact: number;
}

const RESTITUTION = 0.25; // bounce of car-to-car hits
const TANGENT_SCRUB = 0.12; // fraction of relative tangential velocity killed
const YAW_GAIN = 0.01; // heading kick strength from offset hits
const YAW_MAX = 0.05; // rad per pair per frame
const SLOP = 0.02; // penetration allowance (m)
const MAX_SEPARATION = 1.6; // total per pair per frame (spawn-recovery safety)
const FX_MIN_IMPACT = 1.5; // m/s closing speed needed to report a contact

// scratch — avoid per-frame allocations
const _n = new THREE.Vector3();
const _t = new THREE.Vector3();
const _point = new THREE.Vector3();

/** Resolve all pairs among the given cars. Returns FX-worthy contacts. */
export function resolveCarCollisions(cars: Car[]): CarContact[] {
  const contacts: CarContact[] = [];
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.kind === "remote") continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.kind === "remote") continue;
      const contact = resolvePair(a, b);
      if (contact) contacts.push(contact);
    }
  }
  return contacts;
}

function resolvePair(a: Car, b: Car): CarContact | null {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;

  // broad phase — bounding circles
  const rA = Math.hypot(a.collHalfL, a.collHalfW);
  const rB = Math.hypot(b.collHalfL, b.collHalfW);
  const rSum = rA + rB;
  if (dx * dx + dz * dz > rSum * rSum) return null;

  // narrow phase — SAT over both boxes' forward/right axes
  const aFx = Math.sin(a.heading), aFz = Math.cos(a.heading);
  const bFx = Math.sin(b.heading), bFz = Math.cos(b.heading);
  const axes = [aFx, aFz, -aFz, aFx, bFx, bFz, -bFz, bFx];

  let bestOverlap = Infinity;
  let bestUx = 0, bestUz = 0, bestRA = 0, bestRB = 0, bestD = 0;
  for (let k = 0; k < 4; k++) {
    const ux = axes[k * 2], uz = axes[k * 2 + 1];
    const ra =
      Math.abs(aFx * ux + aFz * uz) * a.collHalfL +
      Math.abs(-aFz * ux + aFx * uz) * a.collHalfW;
    const rb =
      Math.abs(bFx * ux + bFz * uz) * b.collHalfL +
      Math.abs(-bFz * ux + bFx * uz) * b.collHalfW;
    const d = Math.abs(dx * ux + dz * uz);
    const overlap = ra + rb - d;
    if (overlap <= 0) return null; // separating axis found
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestUx = ux;
      bestUz = uz;
      bestRA = ra;
      bestRB = rb;
      bestD = d;
    }
  }

  // MTV axis, oriented from A → B
  let nx = bestUx, nz = bestUz;
  if (dx * nx + dz * nz < 0) {
    nx = -nx;
    nz = -nz;
  }

  // ── positional separation (half each, capped) ──
  const sep = Math.min(bestOverlap + SLOP, MAX_SEPARATION) * 0.5;
  a.pos.x -= nx * sep;
  a.pos.z -= nz * sep;
  b.pos.x += nx * sep;
  b.pos.z += nz * sep;

  // contact point = middle of the overlap interval along the MTV axis
  const centre = (bestD - bestRB + bestRA) * 0.5;
  _point.set(a.pos.x + nx * centre, Math.max(a.pos.y, b.pos.y) + 0.45, a.pos.z + nz * centre);

  // ── impulse along the normal (equal masses) ──
  let impact = 0;
  const relN = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
  if (relN < -0.4) {
    const j = -(1 + RESTITUTION) * relN * 0.5;
    impact = -relN;
    a.vel.x -= nx * j;
    a.vel.z -= nz * j;
    b.vel.x += nx * j;
    b.vel.z += nz * j;

    // tangential scrub — metal-on-metal drag
    const tx = -nz, tz = nx;
    const relT = (b.vel.x - a.vel.x) * tx + (b.vel.z - a.vel.z) * tz;
    const scrub = relT * TANGENT_SCRUB * 0.5;
    a.vel.x += tx * scrub;
    a.vel.z += tz * scrub;
    b.vel.x -= tx * scrub;
    b.vel.z -= tz * scrub;

    // offset hits spin the cars slightly: τ.y = r.z·F.x − r.x·F.z
    const rax = _point.x - a.pos.x, raz = _point.z - a.pos.z;
    const rbx = _point.x - b.pos.x, rbz = _point.z - b.pos.z;
    const ta = raz * (-nx * j) - rax * (-nz * j);
    const tb = rbz * (nx * j) - rbx * (nz * j);
    a.heading += THREE.MathUtils.clamp(ta * YAW_GAIN, -YAW_MAX, YAW_MAX);
    b.heading += THREE.MathUtils.clamp(tb * YAW_GAIN, -YAW_MAX, YAW_MAX);
  }

  if (impact < FX_MIN_IMPACT) return null;
  return { a, b, point: _point.clone(), impact };
}
