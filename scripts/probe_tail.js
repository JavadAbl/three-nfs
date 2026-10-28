(() => {
  const g = window.__game;
  const p = g.player;
  const out = { tailMats: [], tailMeshes: [], phase: g.phase };
  p.group.traverse((o) => {
    if (o.isMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && m.name && /feux|stop|phare/i.test(m.name)) {
          out.tailMats.push(o.name + " [" + m.name + "] ei=" + m.emissiveIntensity + " em=" + m.emissive.getHexString());
        }
      }
      if (/Object_74|Object_217|Object_106/.test(o.name)) out.tailMeshes.push(o.name);
    }
  });
  return JSON.stringify(out, null, 1);
})()