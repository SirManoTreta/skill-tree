import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  Handle,
  Position,
} from "reactflow";
import 'reactflow/dist/style.css';

const STORAGE_KEYS = ["skill-tree-dnd-v1", "skill-tree-data-v1"];
const THEME_KEY = "skill-tree-theme";

const download = async (filename, text, mime = "text/plain") => {
  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(href); } catch {}
      try { document.body.removeChild(a); } catch {}
    }, 0);
  } catch {}
  try {
    const dataUrl = `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
    window.open(dataUrl, "_blank");
  } catch {}
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      alert("Conteúdo exportado. Se o download não iniciou, o texto foi copiado para a área de transferência.");
    }
  } catch {}
};

const uid = () => Math.random().toString(36).slice(2, 10);
const cx = (...c) => c.filter(Boolean).join(" ");

const NODE_TYPES = [
  { value: "Feat", label: "Talento" },
  { value: "Class Feature", label: "Recurso de Classe" },
  { value: "Subclass Feature", label: "Recurso de Subclasse" },
  { value: "Fighting Style", label: "Estilo de Luta" },
  { value: "Maneuver", label: "Manobra" },
  { value: "Invocation", label: "Invocação" },
  { value: "Metamagic", label: "Metamágia" },
  { value: "Spell", label: "Magia" },
  { value: "Other", label: "Outro" },
];

// Mantido como você pediu (sem lista completa)
const CLASSES_5E = [
  { value: "Gunslinger", label: "Pistoleiro" },
  { value: "Fighter", label: "Guerreiro" },
];

const ACTION_TYPES = [
  { value: "Class Resource", label: "Recurso de Classe" },
  { value: "Passive", label: "Passiva" },
  { value: "Action", label: "Ação" },
  { value: "Bonus Action", label: "Ação Bônus" },
  { value: "Reaction", label: "Reação" },
  { value: "Free", label: "Livre" },
  { value: "Varies", label: "Varia" },
];

const USES_TYPES = [
  { value: "At Will", label: "À vontade" },
  { value: "Per Short Rest", label: "Por Descanso Curto" },
  { value: "Per Long Rest", label: "Por Descanso Longo" },
  { value: "Proficiency Bonus/Day", label: "Bônus de Proficiência/Dia" },
  { value: "Spell Slot", label: "Espaço de Magia" },
  { value: "Limited", label: "Limitado" },
];

const getLabel = (list, value) => list.find((x) => x.value === value)?.label ?? value;
const parseTags = (s) => s.split(/[;,]/).map((t) => t.trim()).filter(Boolean);
const formatTags = (arr) => (arr || []).join(", ");

// ---------- NÓ (memo para evitar re-render desnecessário) ----------
const SkillNode = React.memo(function SkillNode({ data, selected }) {
  const { name, color, type, dndClass, levelReq, prereqMode, shortText } = data || {};
  const isDark = data?.__theme === "dark";
  const badge = cx(
    "px-2 py-0.5 rounded-full border",
    isDark ? "bg-zinc-800 border-zinc-700 text-zinc-100" : "bg-slate-100 border-slate-200"
  );

  return (
    <div
      className={cx(
        "rounded-2xl shadow-lg border text-sm w-[260px] overflow-hidden",
        data?.__dim ? "opacity-40" : "",
        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200 text-slate-900",
        selected ? "ring-2 ring-offset-2 ring-indigo-500" : ""
      )}
    >
      <div
        className="px-3 py-2 text-white flex items-center justify-between"
        style={{ background: color || "#ff0000ff" }}
      >
        <div className="font-semibold truncate pr-2">{name || "Nova Habilidade"}</div>
        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">Nv {levelReq || 1}</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className={badge}>{getLabel(NODE_TYPES, type || "Feat")}</span>
          {dndClass ? <span className={badge}>{getLabel(CLASSES_5E, dndClass)}</span> : null}
          <span className={badge}>{prereqMode === "any" ? "Pré-req: qualquer um" : "Pré-req: todos"}</span>
        </div>
        {shortText ? (
          <p className={cx("text-xs line-clamp-3", isDark ? "text-zinc-300" : "text-gray-600")}>{shortText}</p>
        ) : (
          <p className={cx("text-xs italic", isDark ? "text-zinc-500" : "text-gray-400")}>Sem resumo</p>
        )}
      </div>

      {/* Aumentar área de clique dos handles */}
      <Handle type="target" position={Position.Left} id="in-left" className="!bg-indigo-500" style={{ width: 18, height: 18 }} />
      <Handle type="target" position={Position.Right} id="in-right" className="!bg-indigo-500" style={{ width: 18, height: 18 }} />
      <Handle type="target" position={Position.Top} id="in-top" className="!bg-indigo-500" style={{ width: 18, height: 18 }} />
      <Handle type="target" position={Position.Bottom} id="in-bottom" className="!bg-indigo-500" style={{ width: 18, height: 18 }} />
      <Handle type="source" position={Position.Left} id="out-left" className="!bg-indigo-500" style={{ width: 18, height: 18 }} />
      <Handle type="source" position={Position.Right} id="out-right" className="!bg-indigo-500" style={{ width: 18, height: 18 }} />
      <Handle type="source" position={Position.Top} id="out-top" className="!bg-indigo-500" style={{ width: 18, height: 18 }} />
      <Handle type="source" position={Position.Bottom} id="out-bottom" className="!bg-indigo-500" style={{ width: 18, height: 18 }} />
    </div>
  );
});

const nodeTypes = { skill: SkillNode };

// ---------- utils de grafo ----------
function buildGraph(nodes, edges) {
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

function detectCycle(nodes, edges) {
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

function topologicalLayers(nodes, edges) {
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

const defaultRoot = () => ({
  id: "root",
  type: "skill",
  position: { x: 0, y: 0 },
  data: {
    name: "Nível 1 / Raiz",
    type: "Other",
    dndClass: "Other",
    levelReq: 1,
    color: "#ff0000ff",
    prereqMode: "all",
    shortText: "Ponto de partida da árvore.",
    tags: ["D&D"],
  },
});

export default function SkillTreeBuilderDnd() {
  const initial = useMemo(() => {
    for (const key of STORAGE_KEYS) {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return null;
  }, []);

  const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return prefersDark() ? "dark" : "light";
  });
  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const [nodes, setNodes] = useState(() => initial?.nodes || [defaultRoot()]);
  const [edges, setEdges] = useState(() => initial?.edges || []);
  const [selectedNodeId, setSelectedNodeId] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("skill-tree-selected") || "null");
    } catch {
      return null;
    }
  });
  const [selectedEdgeIds, setSelectedEdgeIds] = useState([]);
  const [filter, setFilter] = useState("");
  const [rfInstance, setRfInstance] = useState(null);
  useEffect(() => {
    try {
      localStorage.setItem("skill-tree-selected", JSON.stringify(selectedNodeId));
    } catch {}
  }, [selectedNodeId]);
  const [lastValidation, setLastValidation] = useState(null);

  // NOVO: estados/refs para as barras e MiniMapa
  const [showTopPanel, setShowTopPanel] = useState(false);
  const topPanelRef = useRef(null);
  const [openRight, setOpenRight] = useState(false);
  const rightCloseT = useRef(null);
  const [showMiniMap, setShowMiniMap] = useState(true);

  const openRightNow = () => {
    if (rightCloseT.current) {
      clearTimeout(rightCloseT.current);
      rightCloseT.current = null;
    }
    setOpenRight(true);
  };
  const scheduleRightClose = () => {
    if (rightCloseT.current) clearTimeout(rightCloseT.current);
    rightCloseT.current = setTimeout(() => setOpenRight(false), 300);
  };
  useEffect(() => () => rightCloseT.current && clearTimeout(rightCloseT.current), []);

  // Fechar painel superior ao clicar fora
  useEffect(() => {
    const onDown = (e) => {
      if (!showTopPanel) return;
      if (topPanelRef.current && !topPanelRef.current.contains(e.target)) {
        setShowTopPanel(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showTopPanel]);

  // Salvar com debounce
  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS[0], JSON.stringify({ nodes, edges }));
    }, 250);
    return () => clearTimeout(id);
  }, [nodes, edges]);

  // Handlers do React Flow
  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params) => {
    setEdges((eds) => {
      if (params.source === params.target) return eds; // evita auto-loop
      if (eds.some((e) => e.source === params.source && e.target === params.target)) return eds; // sem duplicata
      return addEdge({ ...params, label: " ", markerEnd: { type: MarkerType.ArrowClosed } }, eds);
    });
  }, []);
  const onSelectionChange = useCallback((sel) => {
    setSelectedNodeId(sel?.nodes?.[0]?.id ?? null);
    setSelectedEdgeIds(sel?.edges?.map((e) => e.id) ?? []);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );
  const otherNodes = nodes.filter((n) => n.id !== selectedNodeId);

  const addSkill = (preset) => {
    const id = uid();
    const base = {
      id,
      type: "skill",
      position:
        rfInstance?.project({ x: 200 + Math.random() * 120, y: 80 + Math.random() * 160 }) || { x: 200, y: 120 },
      data: {
        name: preset?.name || "Nova Habilidade",
        type: preset?.type || "Feat",
        dndClass: preset?.dndClass || "Other",
        levelReq: preset?.levelReq ?? 1,
        color: preset?.color || "#ff0000ff",
        prereqMode: "all",
        shortText: preset?.shortText || "",
        abilityReq: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
        actionType: preset?.actionType || "Passive",
        uses: preset?.uses || "At Will",
        tags: preset?.tags || [],
        spell: preset?.spell || null,
      },
    };
    setNodes((nds) => [...nds, base]);
    setSelectedNodeId(id);
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setSelectedNodeId(null);
  };

  const deleteSelectedEdges = () => {
    if (!selectedEdgeIds.length) return;
    setEdges((eds) => eds.filter((e) => !selectedEdgeIds.includes(e.id)));
    setSelectedEdgeIds([]);
  };

  const clearAll = () => {
    if (!confirm("Tem certeza que deseja limpar toda a árvore?")) return;
    setNodes([defaultRoot()]);
    setEdges([]);
    setSelectedNodeId("root");
    setLastValidation(null);
  };

  const exportJSON = async () => {
    const data = JSON.stringify({ nodes, edges }, null, 2);
    await download(
      `skill-tree-dnd-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
      data,
      "application/json"
    );
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.nodes && parsed.edges) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          setSelectedNodeId(null);
        } else {
          alert("Arquivo inválido. Esperado JSON com { nodes, edges }.");
        }
      } catch (e) {
        alert("Não foi possível ler o JSON.");
      }
    };
    reader.readAsText(file);
  };

  const exportMarkdown = async () => {
    const cycle = detectCycle(nodes, edges);
    const layers = topologicalLayers(nodes, edges);
    const map = new Map(nodes.map((n) => [n.id, n]));
    let md = `# Árvore de Habilidades — D&D 5e\n\n`;
    if (cycle) md += `> **Aviso:** ciclo detectado: ${cycle.join(" → ")}\n\n`;
    layers.forEach((layer, i) => {
      md += `## Camada ${i + 1}\n\n`;
      layer.forEach((id) => {
        const n = map.get(id);
        if (!n) return;
        const d = n.data || {};
        const tags = formatTags(d.tags);
        md += `### ${d.name || id}\n`;
        md += `*Tipo:* ${getLabel(NODE_TYPES, d.type || "Feat")}  |  *Classe:* ${getLabel(
          CLASSES_5E,
          d.dndClass || "—"
        )}  |  *Nível mínimo:* ${d.levelReq || 1}  |  *Modo de Pré-req:* ${
          d.prereqMode === "any" ? "Qualquer um" : "Todos"
        }\n`;
        const incoming = edges
          .filter((e) => e.target === id)
          .map((e) => map.get(e.source)?.data?.name || e.source);
        if (incoming.length) md += `*Pré-requisitos:* ${incoming.join(", ")}\n`;
        const abl = d.abilityReq || {};
        const ablText = Object.entries(abl)
          .filter(([, v]) => (v || 0) > 0)
          .map(([k, v]) => `${k} ${v}+`)
          .join(", ");
        if (ablText) md += `*Atributos mínimos:* ${ablText}\n`;
        if (d.actionType) md += `*Ação:* ${getLabel(ACTION_TYPES, d.actionType)}  |  *Usos:* ${getLabel(
          USES_TYPES,
          d.uses || "—"
        )}\n`;
        if (tags) md += `*Tags:* ${tags}\n`;
        if (d.shortText) md += `\n${d.shortText}\n`;
        if (d.description) md += `\n${d.description}\n`;
        md += `\n`;
      });
    });
    await download(
      `skill-tree-dnd-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`,
      md,
      "text/markdown"
    );
  };

  const fit = () => rfInstance?.fitView({ padding: 0.2, duration: 500 });

  const validate = () => {
    const cycle = detectCycle(nodes, edges);
    const { indeg } = buildGraph(nodes, edges);
    const roots = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);
    const layers = topologicalLayers(nodes, edges);
    setLastValidation({ cycle, roots, layersCount: layers.length });
    if (cycle) alert(`Ciclo detectado: ${cycle.join(" → ")}`);
  };

  const autoLayout = () => {
    const cycle = detectCycle(nodes, edges);
    if (cycle) {
      alert("Não é possível aplicar layout automático: há ciclos.");
      return;
    }
    const layers = topologicalLayers(nodes, edges);
    const xGap = 320,
      yGap = 180;
    const updated = nodes.map((n) => ({ ...n }));
    const map = new Map(updated.map((n) => [n.id, n]));
    layers.forEach((layer, i) => {
      layer.forEach((id, idx) => {
        const node = map.get(id);
        if (node) node.position = { x: i * xGap, y: idx * yGap };
      });
    });
    setNodes(updated);
    setTimeout(() => fit(), 50);
  };

  const patchSelected = (patch) => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
  };

  const quickLinkFromSelected = (targetId) => {
    if (!selectedNodeId || !targetId || selectedNodeId === targetId) return;
    setEdges((eds) =>
      addEdge(
        { source: selectedNodeId, target: targetId, label: "pré-req", markerEnd: { type: MarkerType.ArrowClosed } },
        eds
      )
    );
  };

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e) => {
      const k = (e.key || "").toLowerCase();
      if (k === "insert") {
        if (selectedNodeId) {
          e.preventDefault();
          deleteSelectedNode();
        } else if (selectedEdgeIds.length) {
          e.preventDefault();
          deleteSelectedEdges();
        }
      }
      if (k === "_") addSkill();
      if (k === "{") autoLayout();
      if (k === "}") fit();
      if ((e.ctrlKey || e.metaKey) && k === "s") {
        e.preventDefault();
        exportJSON();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNodeId, selectedEdgeIds]);

  // ---------- PROPS MEMOIZADAS E NODES MAPEADOS ----------
  const defaultEdgeOptions = useMemo(
    () => ({ type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }),
    []
  );

  // Não recriar objetos de nó a cada render — preserva referência quando possível
  const mappedNodes = useMemo(() => {
    const term = (filter || "").trim().toLowerCase();
    return nodes.map((n) => {
      const matches =
        !term ||
        n.data?.name?.toLowerCase().includes(term) ||
        (n.data?.tags || []).some((t) => (t || "").toLowerCase().includes(term)) ||
        (n.data?.type || "").toLowerCase().includes(term);

      const nextDim = term ? !matches : false;
      const prev = n.data || {};

      // Se nada relevante mudou, retorna o MESMO objeto (evita re-render)
      if (prev.__theme === theme && !!prev.__dim === !!nextDim) return n;

      return { ...n, data: { ...prev, __theme: theme, __dim: nextDim } };
    });
  }, [nodes, theme, filter]);

  return (
    <div className={cx("w-full h-screen flex", isDark ? "bg-zinc-900 text-zinc-100" : "bg-slate-50 text-slate-900")}>
      <div className="flex-1 relative">
        {/* Botões compactos no topo esquerdo */}
        <div className="absolute z-30 top-3 left-3 flex items-center gap-2">
          <button
            onClick={() => setShowTopPanel((v) => !v)}
            className={cx(
              "px-3 py-1.5 rounded-lg border shadow",
              isDark ? "bg-zinc-900/90 border-zinc-700 hover:bg-zinc-800" : "bg-white/90 border-slate-200 hover:bg-slate-50"
            )}
            title={showTopPanel ? "Fechar menu" : "Abrir menu"}
          >
            ☰ Menu
          </button>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cx(
              "px-3 py-1.5 rounded-lg border",
              isDark
                ? "bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700"
                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
            )}
          >
            {isDark ? "☀️ Claro" : "🌙 Escuro"}
          </button>
        </div>

        {/* Painel superior (abre por clique; fecha clicando fora) */}
        {showTopPanel && (
          <div
            ref={topPanelRef}
            className={cx(
              "absolute z-20 top-14 left-3 flex flex-wrap gap-2 backdrop-blur border rounded-xl p-2 shadow",
              isDark ? "bg-zinc-900/90 border-zinc-700" : "bg-white/90 border-slate-200"
            )}
          >
            <button onClick={() => addSkill()} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
              + Nó D&D
            </button>

            <div className="relative group">
              <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white">+ Pacote Exemplo</button>
              <div
                className={cx(
                  "absolute mt-1 hidden group-hover:block border rounded-lg shadow p-2 text-sm min-w-[220px]",
                  isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-slate-200"
                )}
              >
                <button
                  onClick={() =>
                    addSkill({
                      name: "Talento (ASI)",
                      type: "Feat",
                      dndClass: "Other",
                      levelReq: 4,
                      shortText: "Aumento de Atributo.",
                    })
                  }
                  className={cx("block w-full text-left px-2 py-1 rounded", isDark ? "hover:bg-zinc-800" : "hover:bg-slate-50")}
                >
                  Talento / ASI
                </button>
                <button
                  onClick={() =>
                    addSkill({
                      name: "Ataque Extra",
                      type: "Class Feature",
                      dndClass: "Fighter",
                      levelReq: 5,
                      shortText: "Ataque adicional ao realizar a ação de Ataque.",
                    })
                  }
                  className={cx("block w-full text-left px-2 py-1 rounded", isDark ? "hover:bg-zinc-800" : "hover:bg-slate-50")}
                >
                  Ataque Extra
                </button>
                <button
                  onClick={() =>
                    addSkill({
                      name: "Conjuração Nv 1",
                      type: "Class Feature",
                      dndClass: "Wizard",
                      levelReq: 1,
                      shortText: "Acesso a magias de nível 1.",
                    })
                  }
                  className={cx("block w-full text-left px-2 py-1 rounded", isDark ? "hover:bg-zinc-800" : "hover:bg-slate-50")}
                >
                  Conjuração Nv 1
                </button>
                <button
                  onClick={() =>
                    addSkill({
                      name: "Surto de Ação",
                      type: "Class Feature",
                      dndClass: "Fighter",
                      levelReq: 2,
                      shortText: "Uma ação adicional no seu turno (1/Descanso Curto).",
                      actionType: "Free",
                      uses: "Per Short Rest",
                    })
                  }
                  className={cx("block w-full text-left px-2 py-1 rounded", isDark ? "hover:bg-zinc-800" : "hover:bg-slate-50")}
                >
                  Surto de Ação
                </button>
              </div>
            </div>

            <button onClick={autoLayout} className="px-3 py-1.5 rounded-lg bg-sky-700 text-white hover:bg-sky-800">
              Layout automático
            </button>
            <button onClick={validate} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
              Validar
            </button>
            <button onClick={fit} className="px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900">
              Ajustar visão
            </button>

            {/* Toggle MiniMapa */}
            <button
              onClick={() => setShowMiniMap((v) => !v)}
              className={cx(
                "px-3 py-1.5 rounded-lg border",
                isDark ? "bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800" : "bg-white border-slate-200 hover:bg-slate-50"
              )}
            >
              {showMiniMap ? "Ocultar MiniMapa" : "Mostrar MiniMapa"}
            </button>

            <button onClick={exportJSON} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              Exportar JSON
            </button>
            <button onClick={exportMarkdown} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800">
              Exportar Markdown
            </button>
            <label className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer">
              Importar JSON
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])}
              />
            </label>
            <button onClick={clearAll} className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700">
              Limpar
            </button>
            <button
              onClick={() => {
                if (selectedNodeId) {
                  const src = nodes.find((n) => n.id === selectedNodeId);
                  if (src) {
                    const id = uid();
                    const clone = { ...src, id, position: { x: src.position.x + 40, y: src.position.y + 40 } };
                    setNodes((nds) => [...nds, clone]);
                    setSelectedNodeId(id);
                  }
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
              disabled={!selectedNodeId}
            >
              Duplicar nó
            </button>
            <button
              onClick={deleteSelectedEdges}
              disabled={!selectedEdgeIds.length}
              className="px-3 py-1.5 rounded-lg bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
            >
              Excluir ligações
            </button>
            <div
              className={cx(
                "px-3 py-1.5 rounded-lg border flex items-center gap-2",
                isDark ? "bg-zinc-900 border-zinc-700 text-zinc-300" : "bg-white border-slate-200 text-slate-700"
              )}
            >
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar nome/tags/tipo..."
                className={cx(
                  "px-3 py-1.5 rounded-lg border flex-1",
                  isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100 placeholder-zinc-500" : "bg-white border-slate-200"
                )}
              />
              <span className="text-xs opacity-75">
                {nodes.length} nós • {edges.length} conexões
              </span>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={mappedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(inst) => {
            setRfInstance(inst);
            try {
              const vp = JSON.parse(localStorage.getItem("skill-tree-viewport") || "null");
              if (vp) inst.setViewport(vp, { duration: 0 });
            } catch {}
          }}
          onMoveEnd={(e, vp) => {
            try {
              localStorage.setItem("skill-tree-viewport", JSON.stringify(vp));
            } catch {}
          }}
          onSelectionChange={onSelectionChange}
          onEdgeDoubleClick={(e, edge) => setEdges((eds) => eds.filter((x) => x.id !== edge.id))}
          fitView
          nodeTypes={nodeTypes}
          connectionLineStyle={{ strokeWidth: 2 }}
          connectionLineType="smoothstep"
          defaultEdgeOptions={defaultEdgeOptions}
          snapToGrid
          snapGrid={[16, 16]}
        >
          {showMiniMap && <MiniMap pannable zoomable className={isDark ? "!bg-zinc-900/80" : "!bg-white/80"} />}
          <Controls showInteractive={true} />
          <Background variant="dots" gap={16} size={1} color={isDark ? "#3f3f46" : "#9ca3af"} />
        </ReactFlow>

        {/* Painel direito retrátil por hover (com "hover inteligente") */}
        <div
          className="absolute top-0 right-0 bottom-0 z-30"
          onMouseEnter={openRightNow}
          onMouseLeave={scheduleRightClose}
        >
          {/* zona de hover para abrir */}
          <div className="absolute left-[-10px] top-0 h-full w-[10px] bg-transparent cursor-ew-resize" />
          <aside
            style={{ willChange: "transform" }}
            className={cx(
              "w-[380px] h-full border-l p-4 space-y-4 overflow-auto transform transition-transform duration-300 ease-out shadow-lg",
              isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200",
              openRight ? "translate-x-0" : "translate-x-full"
            )}
          >
            <h2 className="text-lg font-semibold">ViewMode</h2>

            {!selectedNode ? (
              <div className={cx("text-sm space-y-2", isDark ? "text-zinc-300" : "text-gray-600")}>
                <p>
                  <strong>Dica:</strong> A seta significa pré-requisito. Arraste da bolinha para o próximo nó.
                </p>
                <p>
                  Use <em>Layout automático</em> para organizar em camadas por ordem de desbloqueio.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Editar Nó</h3>
                  <button
                    onClick={deleteSelectedNode}
                    className="px-2 py-1 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                  >
                    Excluir
                  </button>
                </div>

                <label className="text-sm">
                  Nome
                  <input
                    className={cx(
                      "mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                    )}
                    value={selectedNode.data.name || ""}
                    onChange={(e) => patchSelected({ name: e.target.value })}
                    placeholder="Ex.: Ataque Extra"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    Tipo
                    <select
                      className={cx(
                        "mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                      )}
                      value={selectedNode.data.type || "Feat"}
                      onChange={(e) => patchSelected({ type: e.target.value })}
                    >
                      {NODE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Classe (opcional)
                    <select
                      className={cx(
                        "mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                      )}
                      value={selectedNode.data.dndClass || "Other"}
                      onChange={(e) => patchSelected({ dndClass: e.target.value })}
                    >
                      {CLASSES_5E.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-2 items-end">
                  <label className="text-sm col-span-2">
                    Resumo curto
                    <input
                      className={cx(
                        "mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                      )}
                      value={selectedNode.data.shortText || ""}
                      onChange={(e) => patchSelected({ shortText: e.target.value })}
                      placeholder="Uma frase que resuma o efeito"
                    />
                  </label>
                  <label className="text-sm">
                    Nível mín.
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className={cx(
                        "mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                      )}
                      value={selectedNode.data.levelReq ?? 1}
                      onChange={(e) => patchSelected({ levelReq: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <label className="text-sm">
                  Descrição
                  <textarea
                    className={cx(
                      "mt-1 w-full border rounded-md px-2 py-1.5 min-h-[100px]",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                    )}
                    value={selectedNode.data.description || ""}
                    onChange={(e) => patchSelected({ description: e.target.value })}
                    placeholder="Texto completo da característica / magia / talento."
                  />
                </label>

                <div className={cx("border rounded-lg p-3", isDark ? "border-zinc-800" : "border-slate-200")}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Pré-req. de Atributos</span>
                    <span className={cx("text-xs", isDark ? "text-zinc-400" : "text-gray-500")}>(0 = nenhum)</span>
                  </div>
                  <div className="grid grid-cols-6 gap-2 text-center">
                    {["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((key) => (
                      <div key={key} className="space-y-1">
                        <div className={cx("text-[11px]", isDark ? "text-zinc-400" : "text-gray-600")}>{key}</div>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          className={cx(
                            "w-full border rounded-md px-1 py-1 text-center",
                            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                          )}
                          value={selectedNode.data.abilityReq?.[key] ?? 0}
                          onChange={(e) =>
                            patchSelected({
                              abilityReq: { ...(selectedNode.data.abilityReq || {}), [key]: Number(e.target.value) },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    Economia de Ação
                    <select
                      className={cx(
                        "mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                      )}
                      value={selectedNode.data.actionType || "Passive"}
                      onChange={(e) => patchSelected({ actionType: e.target.value })}
                    >
                      {ACTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Usos
                    <select
                      className={cx(
                        "mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                      )}
                      value={selectedNode.data.uses || "At Will"}
                      onChange={(e) => patchSelected({ uses: e.target.value })}
                    >
                      {USES_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {selectedNode.data.type === "Spell" && (
                  <div className={cx("rounded-lg p-3", isDark ? "border border-zinc-800" : "border border-slate-200")}>
                    <div className="text-sm font-medium">Magia</div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-sm">
                        Escola
                        <input
                          className={cx(
                            "mt-1 w-full border rounded-md px-2 py-1.5",
                            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                          )}
                          value={selectedNode.data.spell?.school || ""}
                          onChange={(e) => patchSelected({ spell: { ...(selectedNode.data.spell || {}), school: e.target.value } })}
                          placeholder="Evocação, Ilusão..."
                        />
                      </label>
                      <label className="text-sm">
                        Nível
                        <input
                          type="number"
                          min={0}
                          max={9}
                          className={cx(
                            "mt-1 w-full border rounded-md px-2 py-1.5",
                            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                          )}
                          value={selectedNode.data.spell?.slot ?? 1}
                          onChange={(e) => patchSelected({ spell: { ...(selectedNode.data.spell || {}), slot: Number(e.target.value) } })}
                        />
                      </label>
                      <label className="text-sm">
                        Concentração
                        <select
                          className={cx(
                            "mt-1 w-full border rounded-md px-2 py-1.5",
                            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                          )}
                          value={selectedNode.data.spell?.concentration ? "yes" : "no"}
                          onChange={(e) =>
                            patchSelected({ spell: { ...(selectedNode.data.spell || {}), concentration: e.target.value === "yes" } })
                          }
                        >
                          <option value="no">Não</option>
                          <option value="yes">Sim</option>
                        </select>
                      </label>
                    </div>
                    <label className="text-sm">
                      Duração
                      <input
                        className={cx(
                          "mt-1 w-full border rounded-md px-2 py-1.5",
                          isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                        )}
                        value={selectedNode.data.spell?.duration || ""}
                        onChange={(e) => patchSelected({ spell: { ...(selectedNode.data.spell || {}), duration: e.target.value } })}
                        placeholder="Ex.: 1 minuto, 1 hora"
                      />
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    Cor
                    <input
                      type="color"
                      className={cx("mt-1 w-full h-10 border rounded-md", isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-slate-300")}
                      value={selectedNode.data.color || "#6366f1"}
                      onChange={(e) => patchSelected({ color: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    Modo de Pré-req.
                    <select
                      className={cx(
                        "mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                      )}
                      value={selectedNode.data.prereqMode || "all"}
                      onChange={(e) => patchSelected({ prereqMode: e.target.value })}
                    >
                      <option value="all">Todos</option>
                      <option value="any">Qualquer um</option>
                    </select>
                  </label>
                </div>

                <label className="text-sm">
                  Tags (separe por vírgulas)
                  <input
                    className={cx(
                      "mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                    )}
                    value={formatTags(selectedNode.data.tags)}
                    onChange={(e) => patchSelected({ tags: parseTags(e.target.value) })}
                    placeholder="Ex.: marcial, à distância, smite"
                  />
                </label>

                <div className="pt-2">
                  <div className="text-sm font-medium mb-2">Definir como pré-requisito de…</div>
                  {otherNodes.length === 0 ? (
                    <div className={cx("text-xs", isDark ? "text-zinc-400" : "text-gray-500")}>Não há outros nós.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto">
                      {otherNodes.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => quickLinkFromSelected(n.id)}
                          className={cx(
                            "px-2 py-1.5 text-xs rounded-md border text-left",
                            isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          ➜ {n.data?.name || n.id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={cx("border rounded-lg p-3", isDark ? "border-zinc-800" : "border-slate-200")}>
                  <div className="text-sm font-medium mb-2">Pré-requisitos deste nó</div>
                  <ul className={cx("text-sm list-disc pl-5 space-y-1", isDark ? "text-zinc-300" : "text-gray-700")}>
                    {edges
                      .filter((e) => e.target === selectedNode.id)
                      .map((e, idx) => {
                        const n = nodes.find((x) => x.id === e.source);
                        return <li key={idx}>{n?.data?.name || e.source}</li>;
                      })}
                    {edges.filter((e) => e.target === selectedNode.id).length === 0 && (
                      <li className={cx(isDark ? "text-zinc-500" : "text-gray-500")}>Nenhum</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-4 border-t space-y-2 text-sm">
              <details>
                <summary className="cursor-pointer font-medium">Ajuda rápida</summary>
                <ul className={cx("mt-2 list-disc pl-5 space-y-1", isDark ? "text-zinc-300" : "text-gray-700")}>
                  <li>Conecte nós para indicar pré-requisitos (seta ➜ do requisito para a habilidade).</li>
                  <li>
                    Use <strong>Layout automático</strong> para organizar por ordem de desbloqueio.
                  </li>
                  <li>Campos de D&D: Tipo, Classe, Nível mínimo, Atributos, Ação e Usos.</li>
                  <li>
                    Exporte em <em>JSON</em> (para reabrir) ou <em>Markdown</em> (para documentação).
                  </li>
                  <li>
                    Dê <em>duplo clique</em> em uma ligação para removê-la.
                  </li>
                  <li>
                    '_' adiciona nó, abre colchete arruma automático, fecha colchete mostra tudo, Insert apaga o nó.
                    Vai ser ajustado
                  </li>
                </ul>
              </details>

              {lastValidation && (
                <div className={cx("border rounded-lg p-3", isDark ? "border-zinc-800" : "border-slate-200")}>
                  <div className="font-medium mb-1">Relatório de Validação</div>
                  {lastValidation.cycle ? (
                    <div className="text-red-500">Ciclo: {lastValidation.cycle.join(" → ")}</div>
                  ) : (
                    <div className="text-emerald-500">Sem ciclos detectados.</div>
                  )}
                  <div className={cx(isDark ? "text-zinc-300" : "text-gray-700")}>
                    Raízes: <span className="font-mono">{(lastValidation.roots || []).join(", ") || "—"}</span>
                  </div>
                  <div className={cx(isDark ? "text-zinc-300" : "text-gray-700")}>Camadas: {lastValidation.layersCount}</div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
