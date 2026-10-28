(() => {
  const g = window.__game;
  const p = g.player;
  const tall = [];
  p.group.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
      const e = o.matrixWorld.elements;
      const arr = o.geometry.attributes.position.array;
      let ymax = -1e9, ymin = 1e9, zmin = 1e9, zmax = -1e9;
      for (let i = 0; i < arr.length; i += 3) {
        const x = arr[i], y = arr[i + 1], z = arr[i + 2];
        const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
        const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        if (wy > ymax) ymax = wy; if (wy < ymin) ymin = wy;
        if (wz > zmax) zmax = wz; if (wz < zmin) zmin = wz;
      }
      if (ymax > 2.0) tall.push({ n: o.name, y: ymin.toFixed(2) + ".." + ymax.toFixed(2), z: zmin.toFixed(1) + ".." + zmax.toFixed(1) });
    }
  });
  return JSON.stringify({
    ais: g.ais.map((a) => (a.model ? a.model.url : null)),
    playerLamps: {
      head: (p.lampHead || []).map((m) => m.name),
      tail: (p.lampTail || []).map((m) => m.name),
      tailBase: p.lampTailBase,
    },
    meshesAboveRoof: tall,
    phase: g.phase,
  }, null, 1);
})()