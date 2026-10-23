// excitement_calib.ts — verify the "too tame" rework BEFORE/after source edits.
// Solves the per-car drag+enginePower pairs for target (top speed, 0-100),
// cross-checks them against the game's EXACT discrete integrator order
// (engine accel -> linear drag -> wall clamp), then validates:
//   - natural top speeds (must sit below the per-car wall, never bind)
//   - 0-100 km/h full throttle, with and without nitro
//   - nitro never raises top speed (hold at cruise => stays at natural top)
//   - yaw caps at race speeds vs the raw steer model
//   - AI corner budgets vs the real map curvature (hairpins/sweepers)
//   - statsOf garage bars
// Run: bun scripts/excitement_calib.ts
import * as THREE from "three";
import { MAP_LIBRARY } from "../src/game/maps/registry";
import { GAME_CONFIG } from "../src/game/constants";
import { resolveCarTuning, statsOf, CAR_LIBRARY } from "../src/game/cars/registry";

const DT = 1 / 60;
const V100 = 100 / 3.6; // 27.78 m/s

// ── exact game integrator (Car.update order): engine, nitro, drag, clamp ──
function simFullThrottle(P: number, drag: number, wall: number, nitro: boolean, nitroPower: number, fadeSpan: number) {
  const naturalTop = P / drag;
  let v = 0;
  let t = 0;
  let t100 = -1;
  let peak = 0;
  // 30 s is enough to converge on equilibrium for every car
  for (let i = 0; i < 30 / DT; i++) {
    if (nitro && v > 2) {
      const fade = THREE.MathUtils.clamp((naturalTop - v) / (naturalTop * fadeSpan), 0, 1);
      v += nitroPower * fade * DT;
    }
    v += P * DT;
    v -= v * drag * DT;
    v = Math.min(v, wall);
    t += DT;
    peak = Math.max(peak, v);
    if (t100 < 0 && v >= V100) t100 = t;
  }
  return { t100, top: v, peak };
}

// hold nitro from a cruise just below natural top: peak must not exceed natural
function nitroAtCruise(P: number, drag: number, wall: number, nitroPower: number, fadeSpan: number) {
  const naturalTop = P / drag;
  let v = naturalTop * 0.95;
  let peak = v;
  for (let i = 0; i < 10 / DT; i++) {
    const fade = THREE.MathUtils.clamp((naturalTop - v) / (naturalTop * fadeSpan), 0, 1);
    v += nitroPower * fade * DT;
    v += P * DT;
    v -= v * drag * DT;
    v = Math.min(v, wall);
    peak = Math.max(peak, v);
  }
  return { peak, naturalTop };
}

// ── map curvature (same sampling as Track / steer_calib) ──
const N = GAME_CONFIG.TRACK_SAMPLES;
function mapCurvature(def: (typeof MAP_LIBRARY)[number]) {
  const pts = def.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
  const positions = curve.getSpacedPoints(N);
  positions.pop();
  const tangents = positions.map((pos, i) => {
    const next = positions[(i + 1) % N];
    const prev = positions[(i - 1 + N) % N];
    return next.clone().sub(prev).normalize();
  });
  const totalLen = curve.getLength();
  const span = 6;
  const curv: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = tangents[(i - span + N) % N];
    const b = tangents[(i + span) % N];
    const angle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    const length = (span * 2 * totalLen) / N;
    curv.push(angle / length);
  }
  curv.sort((x, y) => y - x);
  return {
    km: totalLen / 1000,
    minR: 1 / curv[0],
    p05R: 1 / curv[Math.floor(N * 0.05)],
    sweeperR: 1 / curv[Math.floor(N * 0.25)],
  };
}

console.log("══════ EXCITEMENT CALIB — 'too tame, all cars' rework ══════\n");
const mainMap = mapCurvature(MAP_LIBRARY[0]);
console.log(
  `${MAP_LIBRARY[0].id}: ${mainMap.km.toFixed(2)} km · tightest R ${mainMap.minR.toFixed(1)} m · top-5% ${mainMap.p05R.toFixed(1)} m · sweeper(25%) ${mainMap.sweeperR.toFixed(0)} m\n`
);

const REF_KMH = [60, 100, 150, 200, 250, 290];
const kmh = (v: number) => (v * 3.6).toFixed(1);
let fail = 0;
const expect = (ok: boolean, msg: string) => {
  if (!ok) {
    fail++;
    console.log(`    ✗ FAIL ${msg}`);
  }
};

for (const def of CAR_LIBRARY) {
  const T = resolveCarTuning(def.id);
  const naturalTop = T.enginePower / T.drag;
  const plain = simFullThrottle(T.enginePower, T.drag, T.maxSpeed, false, 0, 0);
  const boost = simFullThrottle(T.enginePower, T.drag, T.maxSpeed, true, T.nitroPower, T.nitroFadeSpan);
  const cruise = nitroAtCruise(T.enginePower, T.drag, T.maxSpeed, T.nitroPower, T.nitroFadeSpan);
  const bars = statsOf(T);
  const offRoadTop = T.enginePower / (T.drag + T.offRoadDrag);

  console.log(`${def.short.padEnd(6)} P ${T.enginePower}  drag ${T.drag}  wall ${T.maxSpeed}  lat ${T.maxLatAccel} (${(T.maxLatAccel / 9.81).toFixed(2)}g)`);
  console.log(`  natural top ${kmh(naturalTop)} km/h (discrete ${kmh(plain.top)}) · wall ${kmh(T.maxSpeed)} · off-road ${kmh(offRoadTop)}`);
  console.log(`  0-100: ${plain.t100.toFixed(2)}s plain · ${boost.t100.toFixed(2)}s nitro · nitro launch peak ${kmh(boost.peak)}`);
  console.log(`  nitro at 95% cruise: peak ${kmh(cruise.peak)} vs natural ${kmh(cruise.naturalTop)} (delta ${((cruise.peak - cruise.naturalTop) * 3.6).toFixed(1)} km/h)`);
  console.log(`  bars: top ${bars.topSpeed} / accel ${bars.accel} / handling ${bars.handling}`);
  console.log(`  yaw cap °/s @ ${REF_KMH.join("/")} km/h: ${REF_KMH.map((s) =>
    ((T.maxLatAccel / Math.max(s / 3.6, 3.5)) * (180 / Math.PI)).toFixed(0)
  ).join("/")}`);
  console.log(
    `  corner vmax: hairpin(${mainMap.minR.toFixed(0)}m) ${kmh(Math.sqrt(T.maxLatAccel * mainMap.minR))} · 5%(${mainMap.p05R.toFixed(0)}m) ${kmh(Math.sqrt(T.maxLatAccel * mainMap.p05R))} · sweeper(${mainMap.sweeperR.toFixed(0)}m) ${kmh(Math.sqrt(T.maxLatAccel * mainMap.sweeperR))}`
  );
  console.log("");

  expect(naturalTop < T.maxSpeed, `${def.short}: natural top binds on wall`);
  expect(plain.t100 > 1.5 && plain.t100 < 3.4, `${def.short}: 0-100 ${plain.t100.toFixed(2)}s outside 1.5-3.4s`);
  expect(boost.peak <= naturalTop + 0.15, `${def.short}: nitro launch peak exceeds natural top`);
  expect(cruise.peak <= cruise.naturalTop + 0.15, `${def.short}: nitro at cruise exceeds natural top`);
  expect(offRoadTop < 12, `${def.short}: off-road top too high (${kmh(offRoadTop)})`);
}

// AI corner budgets vs curvature (skill 0.78..0.94 as in AICar)
console.log("── AI corner budgets (maxLatAccel × (0.72 + skill×0.18)) vs map ──");
for (const def of CAR_LIBRARY) {
  const T = resolveCarTuning(def.id);
  for (const skill of [0.78, 0.94]) {
    const budget = T.maxLatAccel * (0.72 + skill * 0.18);
    const vHairpin = Math.sqrt(budget / (1 / mainMap.minR));
    expect(vHairpin < Math.sqrt(T.maxLatAccel * mainMap.minR) + 0.01, `${def.short} skill ${skill}: AI hairpin target exceeds physics`);
    console.log(`  ${def.short.padEnd(6)} skill ${skill}: budget ${budget.toFixed(1)} m/s² · hairpin target ${kmh(vHairpin)} km/h (physics max ${kmh(Math.sqrt(T.maxLatAccel * mainMap.minR))})`);
  }
}

console.log(fail === 0 ? "\nALL CHECKS PASSED" : `\n${fail} CHECKS FAILED`);
process.exit(fail === 0 ? 0 : 1);
