// ─── Race state machine: checkpoints, laps, positions, timing ───────────────
import * as THREE from "three";
import type { Track } from "../world/Track";
import type { Car } from "../world/Car";

export interface RacerStanding {
  car: Car;
  position: number;
  lapsDone: number;
  progress: number;
  finished: boolean;
  totalTimeMs: number;
  bestLapMs: number;
  lapStartMs: number;
  wrongWay: boolean;
}

export type RaceEvent =
  | { type: "lap"; car: Car; lap: number; lapTimeMs: number; isBest: boolean }
  | { type: "finish"; car: Car; position: number; totalTimeMs: number; bestLapMs: number };

export class RaceManager {
  standings: RacerStanding[] = [];
  raceTimeMs = 0;
  started = false;
  private expectedCp: Map<Car, number> = new Map();
  private wrongWayTimer: Map<Car, number> = new Map();

  constructor(
    private track: Track,
    private cars: Car[],
    private totalLaps: number,
    private onEvent: (e: RaceEvent) => void
  ) {
    for (const car of cars) {
      car.lap = 0;
      car.checkpoint = 0;
      car.progress = 0;
      car.finished = false;
      car.finishTime = 0;
      this.expectedCp.set(car, 1);
      this.standings.push({
        car,
        position: 0,
        lapsDone: 0,
        progress: 0,
        finished: false,
        totalTimeMs: 0,
        bestLapMs: 0,
        lapStartMs: 0,
        wrongWay: false,
      });
    }
  }

  get isComplete() {
    return this.standings.length > 0 && this.standings.every((s) => s.finished);
  }

  start() {
    this.started = true;
    this.raceTimeMs = 0;
    for (const s of this.standings) s.lapStartMs = 0;
  }

  update(dt: number, racing: boolean) {
    if (!racing) return;
    this.raceTimeMs += dt * 1000;
    const N = this.track.sampleCount;
    const count = this.track.checkpointCount;

    for (const s of this.standings) {
      const car = s.car;
      if (!car.loc) continue;

      // ── remote cars: trust their reported lap, position via local interp ──
      if (car.kind === "remote") {
        s.lapsDone = car.lap;
        s.progress = car.lap * N + ((car.loc.sDist + N) % N);
        s.wrongWay = false;
        continue;
      }

      // ── checkpoint progression ──
      const zone = this.track.checkpointForIndex(car.loc.index);
      const expected = this.expectedCp.get(car) ?? 1;
      if (zone === expected) {
        const next = (expected + 1) % count;
        this.expectedCp.set(car, next);
        car.checkpoint = expected;
        if (next === 1) {
          // crossed the start/finish gate → lap complete
          s.lapsDone += 1;
          car.lap = s.lapsDone;
          const lapMs = this.raceTimeMs - s.lapStartMs;
          s.lapStartMs = this.raceTimeMs;
          const isBest = lapMs > 500 && (s.bestLapMs === 0 || lapMs < s.bestLapMs);
          if (isBest) s.bestLapMs = lapMs;
          if (s.lapsDone >= this.totalLaps) {
            s.finished = true;
            car.finished = true;
            car.finishTime = this.raceTimeMs;
            s.totalTimeMs = this.raceTimeMs;
            this.onEvent({
              type: "finish",
              car,
              position: this.finishedCount(),
              totalTimeMs: s.totalTimeMs,
              bestLapMs: s.bestLapMs,
            });
          } else {
            // (remote cars never reach here — they `continue` at the top of the loop)
            this.onEvent({ type: "lap", car, lap: s.lapsDone, lapTimeMs: lapMs, isBest });
          }
        }
      }

      // ── progress for position sorting ──
      const base = s.lapsDone * N;
      const sDist = (car.loc.sDist + N) % N;
      s.progress = base + sDist;
      car.progress = s.progress;

      // ── wrong-way detection ──
      const alongVel = car.vel.dot(car.loc.tangent);
      let t = (this.wrongWayTimer.get(car) ?? 0) + (alongVel < -3 ? dt : -dt * 2);
      t = THREE.MathUtils.clamp(t, 0, 1.2);
      this.wrongWayTimer.set(car, t);
      s.wrongWay = t > 0.8 && !s.finished;
    }

    // ── recompute positions (leader first) ──
    const order = [...this.standings].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? 1 : -1; // finished cars keep order
      return b.progress - a.progress;
    });
    order.forEach((s, i) => {
      s.position = i + 1;
    });
    // stable finish positions: finished cars ranked by finish order
    const finished = this.standings.filter((s) => s.finished).sort((a, b) => a.totalTimeMs - b.totalTimeMs);
    finished.forEach((s, i) => (s.position = i + 1));
  }

  private finishedCount() {
    return this.standings.filter((s) => s.finished).length;
  }

  standingFor(car: Car): RacerStanding | undefined {
    return this.standings.find((s) => s.car === car);
  }
}
