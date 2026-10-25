// Offline audit: run LAMP_MAT / NOT_LAMP_MAT against every material name in
// all 4 car GLBs + synthetic edge cases. Must run green before re-testing live.
import { readFileSync } from "node:fs";

const LAMP_MAT =
  /(?<![A-Za-z])(head.?lights?|tail.?lights?|tail.?lamps?|brake.?lights?|lights?|lamps?|luz(?:es)?|lamp(?:es|en)?|faroles?|leuchten?|phares?|feux|glows?|emiss\w*)(?![A-Za-z])/i;
const NOT_LAMP_MAT = /glass|vidrio|windshield|window/i;

function glbMats(path: string): string[] {
  const buf = readFileSync(path);
  let off = 12;
  while (off < buf.length) {
    const clen = buf.readUInt32LE(off);
    const ctype = buf.readUInt32LE(off + 4);
    if (ctype === 0x4e4f534a) {
      // JSON chunk — scan for material name fields
      const js = JSON.parse(buf.subarray(off + 8, off + 8 + clen).toString("utf8"));
      return (js.materials ?? []).map((m: { name?: string }) => m.name ?? "");
    }
    off += 8 + clen + (clen & 3);
  }
  return [];
}

/** three states: "victim" = lamp-family (dark in the fleet — glow gate
 * then admits it), "bright" = lamp-family but fleet-bright (glow gate
 * skips — no clone), "guard" = glass-named impostor (NOT_LAMP blocks). */
const expected: Record<string, "victim" | "bright" | "guard"> = {
  TTRS_luz: "victim",
  TTRS_luz2: "victim",
  headlight: "bright",
  taillight: "bright",
  dMAT_Lights_315: "bright",
  emiss: "bright",
  glass_light: "guard",
};
const neverMatch = [
  "dMAT_Details_MAT_606",
  "dMAT_Details_EXT_319",
  "dMAT_Details_Chassis_061",
  "dMAT_Details_Grid_01_192",
  "dMAT_Details_INT_049",
  "TTRS_paint",
  "TTRS_inter",
  "TTRS_plast",
  "TTRS_rin",
  "cromo",
  "llanta",
  "disk",
  "vidrios",
  "bajo",
  "parrilla2",
  "Calipers_AO",
  "tire",
  "rims_AO",
  "car_dodge_viper_acrDefault1",
  "carbon",
  "interior",
  "Car_Paint_Red_AO",
  "CarPaint_Black_AO",
  "CarPaint_AO_1",
  "red_stripe",
  "glass",
  "grulle",
  "phong12under",
  "plate",
  "dMAT_Glass_292",
  "dMAT_Tire_Brake_301",
  "dMAT_Tire_Disk_151",
  "dMAT_Tire_Hub_163",
  "red_glass",
  "tneuma6",
  "CarpaintMetallicBlack",
  "tirerubber",
  "brakedisc",
  "gloassywhitemat",
];

let fails = 0;
const all = new Set<string>();
for (const f of [
  "public/models/audi-tt-rs-2010.glb",
  "public/models/nissan-gtr-r35.glb",
  "public/models/viper-srt10-2008.glb",
  "public/models/viper-acr-2016.glb",
]) {
  for (const m of glbMats(f)) all.add(m);
}

const isLampFamily = (n: string) => !NOT_LAMP_MAT.test(n) && LAMP_MAT.test(n);

for (const [name, exp] of Object.entries(expected)) {
  const match = isLampFamily(name);
  const want = exp !== "guard";
  if (match !== want) {
    console.log(`FAIL ${name} (${exp}): lampFamily=${match}, expected ${want}`);
    fails++;
  }
}
for (const name of all) {
  if (expected[name] === undefined && isLampFamily(name)) {
    console.log(`FAIL fleet material "${name}" unexpectedly matches LAMP_MAT`);
    fails++;
  }
}
for (const name of neverMatch) {
  if (isLampFamily(name)) { console.log(`FAIL ${name} matched LAMP_MAT (must never)`); fails++; }
}
// synthetic edge cases
const synth: [string, boolean][] = [
  ["luz2", true], ["Headlight_Glass", false], ["taillamp", true],
  ["Lampen", true], ["brakelight", true], ["underglow", false],
  ["Retail_Box", false], ["Details_Chassis", false],
];
for (const [n, exp] of synth) {
  const isLamp = NOT_LAMP_MAT.test(n) ? false : LAMP_MAT.test(n);
  if (isLamp !== exp) { console.log(`FAIL synth ${n}: ${isLamp} != ${exp}`); fails++; }
}

console.log(`audited ${all.size} real material names + ${neverMatch.length + synth.length} edge cases — ${fails === 0 ? "ALL GREEN" : fails + " FAILURES"}`);
console.log("lamp-family matches among fleet:", [...all].filter((n) => !NOT_LAMP_MAT.test(n) && LAMP_MAT.test(n)).join(", "));
process.exit(fails === 0 ? 0 : 1);
