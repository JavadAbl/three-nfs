(() => {
  const g = window.__game;
  const p = g.player;
  const expected = [4,6,8,10,12,14,16,17,18,20,22,24,26,28,30,32,34,35,37,39,41,43,45,47,49,51,53,55,56,57,58,60,62,63,65,66,68,69,71,73,74,75,77,79,81,82,84,86,88,90,92,94,96,98,100,102,104,105,106,107,108,110,112,114,116,118,120,122,123,125,127,129,131,133,135,137,139,141,143,145,147,149,150,152,153,154,156,158,160,162,164,165,167,169,171,173,175,177,178,180,181,183,185,187,188,190,191,193,195,197,199,201,202,204,206,208,209,210,211,212,213,214,216,217,219,221,223,225];
  const present = new Set();
  let count = 0;
  p.group.traverse((o) => {
    if (o.isMesh) {
      count++;
      const m = /Object_(\d+)/.exec(o.name);
      if (m) present.add(parseInt(m[1], 10));
    }
  });
  const missing = expected.filter((n) => !present.has(n));
  return JSON.stringify({ totalMeshes: count, missingScanMeshes: missing });
})()