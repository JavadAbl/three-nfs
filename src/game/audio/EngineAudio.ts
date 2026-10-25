// ─── Synth engine audio (WebAudio, no assets needed) ────────────────────────
export class EngineAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private screechGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  muted = false;
  private started = false;

  /** must be called from a user gesture handler */
  resume() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.buildGraph();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private buildGraph() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    // engine: saw + sub octave
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0001;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 950;
    this.engineOsc.connect(this.engineGain).connect(engineFilter).connect(this.master);
    this.engineOsc.start();

    this.subOsc = ctx.createOscillator();
    this.subOsc.type = "square";
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    this.subOsc.connect(subGain).connect(this.engineGain);
    this.subOsc.start();

    // shared noise buffer for screech + wind
    const len = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = buf;
    this.noiseSource.loop = true;

    // tyre screech: bandpassed noise
    const screechFilter = ctx.createBiquadFilter();
    screechFilter.type = "bandpass";
    screechFilter.frequency.value = 2400;
    screechFilter.Q.value = 6;
    this.screechGain = ctx.createGain();
    this.screechGain.gain.value = 0;
    this.noiseSource.connect(screechFilter).connect(this.screechGain).connect(this.master);

    // wind at speed
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 600;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.noiseSource.connect(windFilter).connect(this.windGain).connect(this.master);

    this.noiseSource.start();
    this.started = true;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  /** rpm 0..1, speed m/s, drifting, nitro — gear ignored by the synth */
  update(rpm: number, speed: number, drifting: boolean, nitro: boolean, _gear?: string) {
    if (!this.started || !this.ctx || !this.engineOsc || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const hz = 55 + rpm * 180;
    this.engineOsc.frequency.setTargetAtTime(hz, t, 0.03);
    this.subOsc?.frequency.setTargetAtTime(hz / 2, t, 0.03);
    const vol = 0.05 + Math.min(speed / 70, 1) * 0.14 + (nitro ? 0.06 : 0);
    this.engineGain.gain.setTargetAtTime(vol, t, 0.05);
    this.screechGain?.gain.setTargetAtTime(drifting ? 0.1 : 0, t, 0.05);
    this.windGain?.gain.setTargetAtTime(Math.max(0, (speed - 25) / 70) * 0.16, t, 0.1);
  }

  /** collision metal — synth approximation of the sampled impact tiers */
  impact(strength: number) {
    const s = Math.min(Math.max(strength, 0.2), 1);
    this.blip(55 + s * 60, 0.18, "sawtooth", 0.08 + 0.3 * s);
  }

  /** short UI blips: countdown / finish */
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
      this.engineOsc?.stop();
      this.subOsc?.stop();
      this.noiseSource?.stop();
      void this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ctx = null;
  }
}
