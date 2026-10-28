(() => {
  const g = window.__threeNfs || window.__game;
  const p = g.player;
  // drive 6 seconds with autoSteer + full throttle
  g.debugTick(360, { autoSteer: true });
  const spins = {};
  (p.modelWheels || []).forEach((w) => {
    spins[w.pivot.name] = +w.pivot.rotation.x.toFixed(3);
  });
  const steers = {};
  (p.modelWheels || []).forEach((w) => {
    if (w.isFront) steers[w.pivot.name] = +w.pivot.rotation.y.toFixed(3);
  });
  return JSON.stringify({
    phase: g.phase,
    speedKmh: +(p.speed * 3.6).toFixed(1),
    wheelSpinAccum: +p.wheelSpin.toFixed(2),
    pivotSpinX: spins,
    frontSteerY: steers,
  }, null, 1);
})()