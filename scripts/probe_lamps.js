(() => {
  const g = window.__game;
  const seen = {};
  const collect = (car, tag) => {
    car.group.traverse((o) => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m && m.name && /phare|feux|stop|luz|light|lamp|veil|cligno|_head$|_rear$/i.test(m.name)) {
            seen[tag + " " + o.name + " [" + m.name + "] ei=" + (m.emissiveIntensity ?? "?")] = (m.emissive ? m.emissive.getHexString() : "no-em");
          }
        }
      }
    });
  };
  collect(g.player, "P(r5)");
  g.ais.forEach((a, i) => collect(a, "AI" + i + "(" + (a.model && a.model.wheels ? a.model.wheels.length : "?") + "w)"));
  return JSON.stringify(seen, null, 1);
})()