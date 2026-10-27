// Score massif seeds by silhouette raggedness — pick seeds whose crest height
// profile varies strongly with azimuth (broken skyline) rather than reading
// as one smooth cone. Mirrors massifField() from IslandEnvironment.ts.
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function h2(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = h2(xi, zi), b = h2(xi + 1, zi), c = h2(xi, zi + 1), d = h2(xi + 1, zi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function ridged(x, z, octaves) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (1 - Math.abs(2 * vnoise(x * f, z * f) - 1));
    norm += amp; amp *= 0.55; f *= 2.13;
  }
  return sum / norm;
}
function massifField(seed, r, h) {
  const rng = makeRng(seed);
  const ph1 = rng() * Math.PI * 2;
  const ph2 = rng() * Math.PI * 2;
  const lobes = 3 + Math.floor(rng() * 3);
  const ns = 3 + Math.floor(rng() * 3);
  const subs = [];
  for (let k = 0; k < ns; k++) {
    const a = rng() * Math.PI * 2;
    const d = r * (0.08 + rng() * 0.45);
    subs.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, hh: 0.35 + rng() * 0.5, s: r * (0.14 + rng() * 0.16) });
  }
  const ridgeF = (2.1 / r) * (0.8 + rng() * 0.5);
  const gullyF = (5.4 / r) * (0.8 + rng() * 0.4);
  return (lx, lz) => {
    let rn = Math.hypot(lx, lz) / r;
    if (rn >= 1.25) return 0;
    const ang = Math.atan2(lz, lx);
    const outline =
      0.82 + 0.15 * Math.sin(ang * lobes + ph1) + 0.08 * Math.sin(ang * (lobes * 2 + 1) + ph2) +
      0.2 * (vnoise(Math.cos(ang) * 3 + seed, Math.sin(ang) * 3) - 0.5);
    rn /= Math.max(0.55, outline);
    if (rn >= 1) return 0;
    const base = Math.pow(1 - rn, 1.62);
    const ridge = 0.42 + 0.58 * ridged(lx * ridgeF + 9.7, lz * ridgeF - 4.3, 4);
    const gully = 0.72 + 0.28 * vnoise(lx * gullyF - 7.7, lz * gullyF + 3.1);
    const chop = ridged(lx * ridgeF * 4.2 - 3.1, lz * ridgeF * 4.2 + 6.6, 2) * 0.14;
    let y = 0.5 * base * ridge * gully + chop * base;
    for (const s of subs) {
      const d2 = ((lx - s.x) ** 2 + (lz - s.z) ** 2) / (s.s * s.s);
      y += s.hh * Math.exp(-d2) * Math.pow(base, 0.3);
    }
    return Math.min(1.18, y) * h;
  };
}

// score = crest raggedness: sample the silhouette "height profile" from 36
// bearings (max height along each ray), then measure (max-min)/mean and the
// count of distinct local maxima (peaks) in the profile
function score(seed, r, h) {
  const f = massifField(seed, r, h);
  const prof = [];
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    let best = 0;
    for (let d = 0; d <= r * 1.05; d += r / 60) {
      const y = f(Math.cos(a) * d, Math.sin(a) * d);
      if (y > best) best = y;
    }
    prof.push(best);
  }
  const mean = prof.reduce((s, v) => s + v, 0) / prof.length;
  const ragged = (Math.max(...prof) - Math.min(...prof)) / mean;
  let peaks = 0;
  for (let k = 0; k < 36; k++) {
    const prev = prof[(k + 35) % 36], next = prof[(k + 1) % 36];
    if (prof[k] > prev && prof[k] > next) peaks++;
  }
  return { ragged, peaks, mean };
}

// rank candidate seeds for each massif slot
for (const [label, r, h] of [["main 275/195", 275, 195], ["west 165/120", 165, 120], ["east 130/88", 130, 88]]) {
  const rows = [];
  for (let seed = 500; seed < 600; seed++) rows.push({ seed, ...score(seed, r, h) });
  rows.sort((a, b) => b.ragged - a.ragged);
  console.log(`\n${label} — top 6 seeds by crest raggedness:`);
  for (const row of rows.slice(0, 6))
    console.log(`  seed ${row.seed}: ragged ${(row.ragged * 100).toFixed(0)}%  peaks ${row.peaks}`);
}
