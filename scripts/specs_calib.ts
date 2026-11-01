// specs_calib.ts — class-based spec normalization solver.
//
// The fleet is split into NFS classes; each class owns a band:
//   MUSCLE (viper08, c7, c6r, classic): 0-100 2.25-2.55s (fastest launches,
//     big engine + brick aero → high drag), handling at the bottom of the
//     fleet (tail-happy: low grip, low steerRate, low lateral budget).
//   TUNER (audi, elegy, r5): highest handling (grip/steer/lat all top),
//     slowest straight line (0-100 2.85-3.15s, lowest tops).
//   EXOTIC (gtr, viper16): balanced + fleet-topping top speed; mid accel,
//     mid-high handling — best all-round package.
//
// This script solves the (enginePower, drag) pair per car from the target
// (natural top, 0-100) using the analytic drag ODE, cross-checks the exact
// discrete integrator order used by Car.update, prints the resulting tuning
// line + garage bars, and asserts the class invariants:
//   min(muscle accel)  > max(exotic accel)  > max(tuner accel)
//   min(tuner handling) > max(exotic handling) > max(muscle handling)
//   min(exotic top)    > max(muscle top)    > max(tuner top)
// Run: bun scripts/specs_calib.ts
const V100 = 100 / 3.6; // 27.78 m/s
const DT = 1 / 60;

interface Target {
  id: string;
  short: string;
  cls: "muscle" | "tuner" | "exotic";
  topKmh: number; // natural top target (P/drag)
  t100: number; // analytic 0-100 km/h target
  grip: number;
  steerRate: number;
  maxLatAccel: number;
  mass: number;
}

// ── per-class target table (top/t100 solve P+drag; the rest are direct) ────
const TARGETS: Target[] = [
  // muscle — big engine, brick aero, wild tails
  { id: "classic", short: "MUSCLE", cls: "muscle", topKmh: 285, t100: 2.28, grip: 5.6, steerRate: 1.75, maxLatAccel: 23.5, mass: 1.1 },
  { id: "viper08", short: "SRT10", cls: "muscle", topKmh: 295, t100: 2.4, grip: 6.0, steerRate: 1.85, maxLatAccel: 24.5, mass: 1.05 },
  { id: "c7", short: "C7", cls: "muscle", topKmh: 287, t100: 2.45, grip: 6.3, steerRate: 1.9, maxLatAccel: 25.2, mass: 1.05 },
  { id: "c6r", short: "C6.R", cls: "muscle", topKmh: 298, t100: 2.32, grip: 6.5, steerRate: 1.95, maxLatAccel: 26.0, mass: 1.08 },
  // exotic — balanced, fleet-topping top speed
  { id: "gtr", short: "GT-R", cls: "exotic", topKmh: 303, t100: 2.55, grip: 7.4, steerRate: 2.1, maxLatAccel: 27.2, mass: 1.15 },
  { id: "viper16", short: "ACR", cls: "exotic", topKmh: 305, t100: 2.5, grip: 7.5, steerRate: 2.15, maxLatAccel: 28.0, mass: 1.0 },
  // tuner — corner carvers
  { id: "audi", short: "TT RS", cls: "tuner", topKmh: 250, t100: 3.0, grip: 7.9, steerRate: 2.35, maxLatAccel: 27.5, mass: 0.95 },
  { id: "elegy", short: "R34", cls: "tuner", topKmh: 265, t100: 2.85, grip: 8.0, steerRate: 2.2, maxLatAccel: 28.5, mass: 1.05 },
  { id: "r5", short: "R5", cls: "tuner", topKmh: 240, t100: 3.15, grip: 8.2, steerRate: 2.5, maxLatAccel: 29.0, mass: 0.82 },
];

// analytic: t100 = (1/drag)·ln(top/(top−v100))  →  drag = ln(...)/t100
function solve(topKmh: number, t100: number) {
  const top = topKmh / 3.6;
  const drag = Math.log(top / (top - V100)) / t100;
  return { top, drag, P: top * drag };
}

// exact discrete integrator order (Car.update): engine accel, drag, wall clamp
function simT100(P: number, drag: number, wall: number) {
  let v = 0;
  let t = 0;
  for (let i = 0; i < 30 / DT; i++) {
    v += P * DT;
    v -= v * drag * DT;
    v = Math.min(v, wall);
    t += DT;
    if (v >= V100) return { t100: t, top: v };
  }
  return { t100: -1, top: v };
}

// garage bars — same formulas as registry.statsOf (with the re-centred accel
// window that ships with this normalization: 2.25-3.3s → 100-0%)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
function bars(t: { top: number; t100: number; grip: number; steerRate: number; maxLatAccel: number }) {
  return {
    topSpeed: Math.round(clamp01((t.top - 63) / 23) * 100),
    accel: Math.round(clamp01((3.3 - t.t100) / 1.05) * 100),
    handling: Math.round(
      clamp01(
        0.45 * clamp01((t.grip - 5.2) / 3.4) +
          0.25 * clamp01((t.steerRate - 1.7) / 0.7) +
          0.3 * clamp01((t.maxLatAccel - 22) / 8),
      ) * 100,
    ),
  };
}

console.log("══════ CLASS SPEC NORMALIZATION SOLVER ══════\n");
let fail = 0;
const expect = (ok: boolean, msg: string) => {
  if (!ok) {
    fail++;
    console.log(`  ✗ FAIL ${msg}`);
  }
};

const byClass: Record<string, ReturnType<typeof bars>[]> = { muscle: [], tuner: [], exotic: [] };
const lines: string[] = [];

for (const t of TARGETS) {
  const { top, drag, P } = solve(t.topKmh, t.t100);
  const wall = Math.round((top + 4) * 10) / 10; // safety wall: natural top + ~14 km/h
  const sim = simT100(P, drag, wall);
  const b = bars({ top, t100: sim.t100 > 0 ? sim.t100 : t.t100, grip: t.grip, steerRate: t.steerRate, maxLatAccel: t.maxLatAccel });
  byClass[t.cls].push(b);

  console.log(
    `${t.short.padEnd(6)} [${t.cls.padEnd(6)}] top ${t.topKmh} km/h · 0-100 ${t.t100.toFixed(2)}s → P ${P.toFixed(2)} · drag ${drag.toFixed(3)} · wall ${wall}`,
  );
  console.log(
    `       discrete 0-100 ${sim.t100.toFixed(2)}s · bars: top ${b.topSpeed} / accel ${b.accel} / handling ${b.handling} · lat ${(t.maxLatAccel / 9.81).toFixed(2)}g`,
  );
  lines.push(
    `    tuning: { enginePower: ${P.toFixed(2)}, drag: ${drag.toFixed(3)}, maxSpeed: ${wall}, grip: ${t.grip}, steerRate: ${t.steerRate}, maxLatAccel: ${t.maxLatAccel}, mass: ${t.mass} },`,
  );

  expect(Math.abs(sim.t100 - t.t100) < 0.05, `${t.short}: discrete 0-100 ${sim.t100.toFixed(2)}s vs target ${t.t100}s`);
  expect(top < wall, `${t.short}: natural top binds on wall`);
}

console.log("\n── registry-ready tuning lines ──");
for (const l of lines) console.log(l);

// ── class invariants ──
const min = (a: ReturnType<typeof bars>[]) => Math.min(...a.map((b) => b.accel));
const max = (a: ReturnType<typeof bars>[]) => Math.max(...a.map((b) => b.accel));
const hMin = (a: ReturnType<typeof bars>[]) => Math.min(...a.map((b) => b.handling));
const hMax = (a: ReturnType<typeof bars>[]) => Math.max(...a.map((b) => b.handling));
const tMin = (a: ReturnType<typeof bars>[]) => Math.min(...a.map((b) => b.topSpeed));
const tMax = (a: ReturnType<typeof bars>[]) => Math.max(...a.map((b) => b.topSpeed));

console.log("\n── class invariants ──");
console.log(`muscle accel ${min(byClass.muscle)}-${max(byClass.muscle)}  vs exotic ${min(byClass.exotic)}-${max(byClass.exotic)}  vs tuner ${min(byClass.tuner)}-${max(byClass.tuner)}`);
console.log(`tuner handling ${hMin(byClass.tuner)}-${hMax(byClass.tuner)}  vs exotic ${hMin(byClass.exotic)}-${hMax(byClass.exotic)}  vs muscle ${hMin(byClass.muscle)}-${hMax(byClass.muscle)}`);
console.log(`exotic top ${tMin(byClass.exotic)}-${tMax(byClass.exotic)}  vs muscle ${tMin(byClass.muscle)}-${tMax(byClass.muscle)}  vs tuner ${tMin(byClass.tuner)}-${tMax(byClass.tuner)}`);
expect(min(byClass.muscle) > max(byClass.exotic), "muscle accel not strictly above exotic");
expect(min(byClass.exotic) > max(byClass.tuner), "exotic accel not strictly above tuner");
expect(hMin(byClass.tuner) > hMax(byClass.exotic), "tuner handling not strictly above exotic");
expect(hMin(byClass.exotic) > hMax(byClass.muscle), "exotic handling not strictly above muscle");
expect(tMin(byClass.exotic) > tMax(byClass.muscle), "exotic top not strictly above muscle");
expect(tMin(byClass.muscle) > tMax(byClass.tuner), "muscle top not strictly above tuner");

console.log(fail === 0 ? "\nALL CHECKS PASS" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
