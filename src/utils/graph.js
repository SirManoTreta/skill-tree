// ====================== Árvore (mesmo core) ======================
export function buildGraph(nodes, edges) {
  const adj = new Map();
  const indeg = new Map();
  nodes.forEach((n) => {
    adj.set(n.id, []);
    indeg.set(n.id, 0);
  });
  edges.forEach((e) => {
    if (adj.has(e.source)) adj.get(e.source).push(e.target);
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
  });
  return { adj, indeg };
}

export function detectCycle(nodes, edges) {
  const { adj } = buildGraph(nodes, edges);
  const visited = new Set();
  const stack = new Set();
  let found = null;
  const path = [];
  const dfs = (u) => {
    if (found) return;
    visited.add(u);
    stack.add(u);
    path.push(u);
    for (const v of adj.get(u) || []) {
      if (!visited.has(v)) dfs(v);
      else if (stack.has(v) && !found) {
        const idx = path.indexOf(v);
        found = path.slice(idx).concat(v);
        return;
      }
    }
    stack.delete(u);
    path.pop();
  };
  for (const n of nodes) if (!visited.has(n.id)) dfs(n.id);
  return found;
}

export function topologicalLayers(nodes, edges) {
  const { adj, indeg } = buildGraph(nodes, edges);
  const q = [];
  const indegCopy = new Map(indeg);
  indegCopy.forEach((d, id) => {
    if (!d) q.push(id);
  });
  const layers = [];
  const assigned = new Map();
  let current = q;
  let layer = 0;
  while (current.length) {
    layers.push(current);
    current.forEach((id) => assigned.set(id, layer));
    const next = [];
    current.forEach((id) => {
      for (const v of adj.get(id) || []) {
        indegCopy.set(v, (indegCopy.get(v) || 0) - 1);
        if (indegCopy.get(v) === 0) next.push(v);
      }
    });
    current = next;
    layer++;
  }
  if (assigned.size !== nodes.length) {
    const remaining = nodes.map((n) => n.id).filter((id) => !assigned.has(id));
    if (remaining.length) layers.push(remaining);
  }
  return layers;
}