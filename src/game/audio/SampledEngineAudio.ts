// ─── Sampled car audio (WebAudio + staged OGG assets) ────────────────────────
// Per-family engine ladders (idle/low/mid/high loops) crossfaded by RPM,
// plus skid/shift/impact/boost/rumble one-shots — NFS-style. Falls back to
// silence for the engine (synth UI blips still work) if the staged assets
// can't be fetched/decoded, so a missing file never crashes the race.
//
// Staging files live at /audio/staging/ — deliberately OUTSIDE the service
// worker's ASSET_PREFIXES so audition swaps are heard on plain reload.

export type AudioFamily = "4cyl-turbo" | "v6-tt" | "v10";

const FAMILY_BY_CAR: Record<string, AudioFamily> = {
  audi: "4cyl-turbo",
  gtr: "v6-tt",
  viper08: "v10",
  viper16: "v10",
  classic: "4cyl-turbo",
};

export function familyForCar(carId?: string): AudioFamily {
  return FAMILY_BY_CAR[carId ?? ""] ?? "4cyl-turbo";
}

const STAGE = "/audio/staging";

/** rpm anchor points for the 4 ladder layers */
const ANCHORS = [0.06, 0.3, 0.62, 1.0];
/** crossfade half-width (rpm units) between adjacent anchors */
const BLEND_W = 0.42;

interface Layer {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export class SampledEngineAudio {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: Layer[] = [];
  private skidGain: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  private bufs: Record<string, AudioBuffer> = {};
  private engineReady = false;
  private lastGear = "";
  private lastNitro = false;
  private lastImpactAt = 0;

  constructor(private family: AudioFamily = "4cyl-turbo") {}

  /** must be called from a user gesture handler */
  resume() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      // limiter: engine + skid + impacts can now sum hot, never clip the output
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 12;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      this.master.connect(limiter).connect(this.ctx.destination);
      void this.loadAssets();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  // ── per-frame drive ──────────────────────────────────────────────────────
  /** rpm 0..1, speed m/s, drifting, nitro, gear ("N","R","1".."7") */
  update(rpm: number, speed: number, drifting: boolean, nitro: boolean, gear?: string) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;

    // engine ladder crossfade — tent weights over the anchor points, sum≈1
    if (this.engineReady) {
      const r = Math.min(Math.max(rpm, 0), 1);
      let sum = 0;
      const w: number[] = ANCHORS.map((a) => {
        const v = Math.max(0, 1 - Math.abs(r - a) / BLEND_W);
        sum += v;
        return v;
      });
      // loud under load — rpm carries the level, speed adds a sense of pace
      const vol = 0.18 + r * 0.34 + Math.min(speed / 70, 1) * 0.12 + (nitro ? 0.12 : 0);
      this.layers.forEach((l, i) => {
        const g = sum > 0 ? (w[i] / sum) * vol : 0;
        l.gain.gain.setTargetAtTime(g, t, 0.06);
        // continuous pitch inside each band: stretch toward the true rpm
        const rate = Math.min(1.16, Math.max(0.9, 1 + (r - ANCHORS[i]) * 0.13));
        l.src.playbackRate.setTargetAtTime(rate, t, 0.08);
      });
    }

    // skid
    this.skidGain?.gain.setTargetAtTime(drifting ? 0.4 : 0, t, 0.05);
    // road rumble at speed (night city or day circuit both live on asphalt)
    this.rumbleGain?.gain.setTargetAtTime(Math.max(0, (speed - 8) / 60) * 0.22, t, 0.1);

    // nitro rising edge → boost whoosh
    if (nitro && !this.lastNitro) this.oneShot("boost", 0.75);
    this.lastNitro = nitro;

    // numeric gear change → shift clunk (launch N→1 included; skips N/R)
    if (gear && gear !== this.lastGear) {
      const isNum = (s: string) => /^[1-7]$/.test(s);
      if (isNum(gear) && isNum(this.lastGear) && gear !== this.lastGear) this.oneShot("shift", 0.55);
      this.lastGear = gear;
    }
  }

  // ── one-shots ───────────────────────────────────────────────────────────
  /** collision strength 0..1 → light/med/heavy metal */
  impact(strength: number) {
    const s = Math.min(Math.max(strength, 0), 1);
    const now = this.ctx?.currentTime ?? 0;
    if (now - this.lastImpactAt < 0.12) return; // no machine-gun impacts
    this.lastImpactAt = now;
    const key = s < 0.4 ? "light" : s < 0.75 ? "med" : "heavy";
    this.oneShot(key, 0.6 + 0.4 * s);
  }

  /** short UI blips: countdown / lap — synth so menus sound before assets land */
  blip(freq = 660, dur = 0.12, type: OscillatorType = "square", vol = 0.25) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + dur + 0.02);
  }

  fanfare(kind: "win" | "lose") {
    const seq = kind === "win" ? [523, 659, 784, 1047] : [392, 330, 262];
    seq.forEach((f, i) => setTimeout(() => this.blip(f, 0.18, "triangle", 0.3), i * 130));
  }

  dispose() {
    try {
      this.layers.forEach((l) => l.src.stop());
      this.skidGain = null;
      this.rumbleGain = null;
      void this.ctx?.close();
    } catch {
      /* noop */
    }
    this.layers = [];
    this.ctx = null;
    this.engineReady = false;
  }

  // ── internals ────────────────────────────────────────────────────────────
  private async loadAssets() {
    const ctx = this.ctx!;
    const names = ["idle", "low", "mid", "high"];
    const jobs: Promise<{ name: string; buf: AudioBuffer | null }>[] = [];
    names.forEach((n, i) =>
      jobs.push(this.loadOne(`${STAGE}/engines/${this.family}/${n}.ogg`).then((buf) => ({ name: `L${i}`, buf })))
    );
    for (const n of ["skid", "shift", "boost", "rumble", "light", "med", "heavy"]) {
      jobs.push(this.loadOne(`${STAGE}/${n}.ogg`).then((buf) => ({ name: n, buf })));
    }
    const results = await Promise.allSettled(jobs);
    if (!this.ctx) return; // disposed while loading
    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value.buf) continue;
      this.bufs[r.value.name] = r.value.buf;
    }
    this.startGraph();
  }

  private async loadOne(url: string): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      return await this.ctx!.decodeAudioData(data);
    } catch {
      return null;
    }
  }

  private startGraph() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    // engine ladder — all four start silent, update() drives the crossfade
    for (let i = 0; i < 4; i++) {
      const buf = this.bufs[`L${i}`];
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(master);
      src.start();
      this.layers.push({ src, gain });
    }
    this.engineReady = this.layers.length === 4;

    // skid + rumble loops
    for (const name of ["skid", "rumble"] as const) {
      const buf = this.bufs[name];
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(master);
      src.start();
      if (name === "skid") this.skidGain = gain;
      else this.rumbleGain = gain;
    }
  }

  private oneShot(name: string, vol: number) {
    const ctx = this.ctx;
    const master = this.master;
    const buf = this.bufs[name];
    if (!ctx || !master || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    src.connect(g).connect(master);
    src.start();
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }
}
