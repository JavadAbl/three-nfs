(() => {
  const g = window.__threeNfs || window.__game;
  const p = g.player;
  const pivots = {};
  let mirrorInPivot = [];
  const staticMeshes = [];
  (p.modelWheels || []).forEach((w) => {
    pivots[w.pivot ? w.pivot.name : "?"] = { axis: w.axis, front: w.isFront };
    (w.pivot ? w.pivot.children : []).forEach((c) => {
      if (/body\.00[27]/.test(c.name)) mirrorInPivot.push(c.name);
    });
  });
  p.group.traverse((o) => {
    if (o.isMesh && /Cube_Material|Cube_1_|Cube\.001_M|Cube\.003_M|Cube\.004_M|sidelight/.test(o.name)) {
      staticMeshes.push(o.name + (o.parent && o.parent.name ? " < " + o.parent.name : ""));
    }
  });
  return JSON.stringify({
    id: p.id,
    wheels: pivots,
    mirrorSpinning: mirrorInPivot,
    specialMeshes: staticMeshes,
    camDims: p.camDims,
    collHalfW: p.collHalfW,
    collHalfL: p.collHalfL,
    lampsHead: (p.lampHead || []).map((m) => m.name + "@" + m.emissiveIntensity),
    lampsTail: (p.lampTail || []).map((m) => m.name + "@" + m.emissiveIntensity),
  }, null, 1);
})()