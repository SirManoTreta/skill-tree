import SkillNode from "./components/SkillNode";
import GroupNode from "./components/GroupNode";
import InventoryManager from "./inventory/InventoryManager";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS, THEME_KEY, PAGE_KEY, INVENTORY_KEY } from "./constants/storage";
import { NODE_TYPES, CLASSES_5E, ACTION_TYPES, USES_TYPES } from "./constants/dnd";
import { cx, uid, download, parseTags, formatTags, getLabel } from "./utils/misc";
import { buildGraph, detectCycle, topologicalLayers } from "./utils/graph";
import { t, getLang, setLang } from "./utils/i18n";
import CharacterSheet from "./sheet/CharacterSheet";
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

const nodeTypes = { skill: SkillNode, group: GroupNode };

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
    const bg = isDark ? "#09090b" /* zinc-950 aprox. */ : "#f8fafc" /* slate-50 aprox. */;
    try { document.documentElement.style.backgroundColor = bg; } catch {}
    try { document.body.style.backgroundColor = bg; } catch {}
  }, [isDark]);
  
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const [page, setPage] = useState(() => localStorage.getItem(PAGE_KEY) || "tree");
  useEffect(() => {
    try { localStorage.setItem(PAGE_KEY, page); } catch {}
  }, [page]);

  const [nodes, setNodes] = useState(() => initial?.nodes || [defaultRoot()]);
  const [edges, setEdges] = useState(() => initial?.edges || []);
  const [selectedNodeId, setSelectedNodeId] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("skill-tree-selected") || "null");
    } catch {
      return null;
    }
  });
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState([]);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);
  const [filter, setFilter] = useState("");
  const [rfInstance, setRfInstance] = useState(null);
  useEffect(() => {
    try {
      localStorage.setItem("skill-tree-selected", JSON.stringify(selectedNodeId));
    } catch {}
  }, [selectedNodeId]);
  const [lastValidation, setLastValidation] = useState(null);

  // Barras e MiniMapa (apenas na página "tree")
  const [showTopPanel, setShowTopPanel] = useState(false);
  const topPanelRef = useRef(null);
  const topToggleBtnRef = useRef(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const rightPanelRef = useRef(null);
  const rightToggleBtnRef = useRef(null);
  const [showMiniMap, setShowMiniMap] = useState(true);

  // Ao trocar de página, garante que menus da árvore fiquem fechados
  useEffect(() => {
    setShowTopPanel(false);
    setShowRightPanel(false);
  }, [page]);

  // Fechar painéis ao clicar fora
  useEffect(() => {
    const onDown = (e) => {
      if (page !== "tree") return; // só importa na árvore
      if (showTopPanel) {
        const clickInsidePanel = topPanelRef.current && topPanelRef.current.contains(e.target);
        const clickOnToggle = topToggleBtnRef.current && topToggleBtnRef.current.contains(e.target);
        if (!clickInsidePanel && !clickOnToggle) setShowTopPanel(false);
      }
      if (showRightPanel) {
        const clickInsidePanel = rightPanelRef.current && rightPanelRef.current.contains(e.target);
        const clickOnToggle = rightToggleBtnRef.current && rightToggleBtnRef.current.contains(e.target);
        if (!clickInsidePanel && !clickOnToggle) setShowRightPanel(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showTopPanel, showRightPanel, page]);

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
  // Validar conexão antes de criar (sem loops, sem duplicatas)
  const isValidConnection = useCallback((conn) => {
    if (!conn?.source || !conn?.target) return false;
    if (conn.source === conn.target) return false;
    if (edges.some((e) => e.source === conn.source && e.target === conn.target)) return false;
    const temp = [...edges, { id: "__temp__", source: conn.source, target: conn.target }];
    return !detectCycle(nodes, temp);
  }, [edges, nodes]);

  const onSelectionChange = useCallback((sel) => {
    const ids = sel?.nodes?.map((n) => n.id) ?? [];
    setSelectedNodeIds(ids);
    setSelectedNodeId(ids[0] ?? null);
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
    let md = `# Árvore de Habilidades — D&D 5e

`;
    if (cycle) md += `> **Aviso:** ciclo detectado: ${cycle.join(" → ")}

`;
    layers.forEach((layer, i) => {
      md += `## Camada ${i + 1}

`;
      layer.forEach((id) => {
        const n = map.get(id);
        if (!n) return;
        const d = n.data || {};
        const tags = formatTags(d.tags);
        md += `### ${d.name || id}
`;
        md += `*Tipo:* ${getLabel(NODE_TYPES, d.type || "Feat")}  |  *Classe:* ${getLabel(
          CLASSES_5E,
          d.dndClass || "—"
        )}  |  *Nível mínimo:* ${d.levelReq || 1}  |  *Modo de Pré-req:* ${
          d.prereqMode === "any" ? "Qualquer um" : "Todos"
        }
`;
        const incoming = edges
          .filter((e) => e.target === id)
          .map((e) => map.get(e.source)?.data?.name || e.source);
        if (incoming.length) md += `*Pré-requisitos:* ${incoming.join(", ")}
`;
        const abl = d.abilityReq || {};
        const ablText = Object.entries(abl)
          .filter(([, v]) => (v || 0) > 0)
          .map(([k, v]) => `${k} ${v}+`)
          .join(", ");
        if (ablText) md += `*Atributos mínimos:* ${ablText}
`;
        if (d.actionType) md += `*Ação:* ${getLabel(ACTION_TYPES, d.actionType)}  |  *Usos:* ${getLabel(
          USES_TYPES,
          d.uses || "—"
        )}
`;
        if (tags) md += `*Tags:* ${tags}
`;
        if (d.shortText) md += `
${d.shortText}
`;
        if (d.description) md += `
${d.description}
`;
        md += `
`;
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
    const xGap = 320, yGap = 180;
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

  

  // Recebe itens do Inventário e cria nós à direita em área vazia
  const addItemsToTree = (itemsFromInventory) => {
    try {
      const xGap = 320, yGap = 180, perCol = 4;
      // Compute base at the rightmost X
      const maxX = nodes.reduce((m, n) => Math.max(m, Number(n?.position?.x || 0)), 0);
      const baseX = (nodes.length ? maxX + xGap : xGap);
      const baseY = 0;

      const categoryTag = (cat) => {
        switch ((cat || '').toLowerCase()) {
          case 'armor': return 'Armaduras';
          case 'weapon': return 'Armas / Munição';
          case 'keys': return 'Chaves';
          case 'dice': return 'Dados';
          case 'misc': default: return 'Miscelânia';
        }
      };
      const shortText = (it) => {
        const bits = [];
        if (Number(it.ac || 0)) bits.push(`AC +${it.ac}`);
        if (it.notes) bits.push(String(it.notes));
        return bits.join(' • ');
      };
      const gridPos = (idx) => {
        const col = idx % perCol;
        const row = Math.floor(idx / perCol);
        return { x: baseX + col * xGap, y: baseY + row * yGap };
      };

      const existingIds = new Set(nodes.map(n => n.id));
      const toAdd = (itemsFromInventory || []).map((it, i) => ({
        id: `item-${it.id}`,
        type: "skill",
        position: gridPos(i),
        data: {
          name: it.name || "Item",
          type: "Other",
          dndClass: "Other",
          levelReq: 1,
          color: "#6366f1",
          prereqMode: "all",
          shortText: shortText(it),
          tags: [
            categoryTag(it.category),
            it.equipped ? "Equipped" : null,
            it.attuned ? "Attuned" : null,
          ].filter(Boolean),
        },
      })).filter(n => !existingIds.has(n.id));

      if (!toAdd.length) {
        alert("Nenhum nó novo para adicionar — itens já existem na árvore.");
        return;
      }

      setNodes((nds) => [...nds, ...toAdd]);
      // keep edges
      setTimeout(() => fit(), 40);
    } catch (e) {
      console.error(e);
      alert("Falha ao adicionar itens na árvore.");
    }
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

  // —————————————————————————————————————————————
  // Grupos: abrir/fechar, agrupar e desagrupar
  // —————————————————————————————————————————————
  const toggleGroupCollapse = useCallback((groupId) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== groupId || n.type !== "group") return n;
        return { ...n, data: { ...n.data, collapsed: !n.data?.collapsed } };
      })
    );
  }, []);

  const groupSelection = useCallback(() => {
  // Se houver um grupo na seleção, adiciona os demais nós nele.
  const selectedGroups = nodes.filter((n) => selectedNodeIds.includes(n.id) && n.type === "group");
  const members = nodes.filter((n) => selectedNodeIds.includes(n.id) && n.type !== "group");
  if (members.length === 0) return;
  if (selectedGroups.length >= 1) {
    const gid = selectedGroups[0].id;
    setNodes((nds) =>
      nds.map((n) =>
        members.some((m) => m.id === n.id) ? { ...n, data: { ...n.data, groupId: gid } } : n
      )
    );
    setSelectedNodeId(gid);
    return;
  }
  // Caso contrário, cria um novo grupo normalmente.
  const cx = members.reduce((s, n) => s + (n.position?.x || 0), 0) / members.length;
  const cy = members.reduce((s, n) => s + (n.position?.y || 0), 0) / members.length;
  const id = uid();
  const groupNode = {
    id,
    type: "group",
    position: { x: cx, y: cy },
    data: { name: "Grupo", color: "#6366f1", collapsed: true, tags: ["group"] },
  };
  setNodes((nds) => [
    ...nds.map((n) =>
      members.some((m) => m.id === n.id) ? { ...n, data: { ...n.data, groupId: id } } : n
    ),
    groupNode,
  ]);
  setSelectedNodeId(id);
}, [nodes, selectedNodeIds]);

  const ungroupSelection = useCallback(() => {
    const ids = new Set(selectedNodeIds);
    setNodes((nds) => {
      const updated = nds.map((n) =>
        ids.has(n.id) && n.type !== "group" ? { ...n, data: { ...n.data, groupId: undefined } } : n
      );
      const usedGroupIds = new Set(
        updated.filter((n) => n.type !== "group" && n.data?.groupId).map((n) => n.data.groupId)
      );
      return updated.filter((n) => n.type !== "group" || usedGroupIds.has(n.id));
    });
  }, [selectedNodeIds]);

// Drag-over em grupos: quando arrastar um nó comum sobre a "bolinha" de um grupo, destaca e, ao soltar, move para o grupo.
const getNodeCenter = useCallback((n) => {
  const w = n.type === "group" ? 128 : 260;
  const h = n.type === "group" ? 128 : 120;
  return { x: (n.position?.x || 0) + w / 2, y: (n.position?.y || 0) + h / 2 };
}, []);

const getGroupAtPoint = useCallback((x, y) => {
  const groups = nodes.filter((n) => n.type === "group");
  for (const g of groups) {
    const cx = (g.position?.x || 0) + 64;
    const cy = (g.position?.y || 0) + 64;
    const r = 74; // um pouco maior que 64 pra facilitar o acerto
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= r * r) return g.id;
  }
  return null;
}, [nodes]);

const onNodeDrag = useCallback((evt, node) => {
  if (!node || node.type === "group") { setDragOverGroupId(null); return; }
  const c = getNodeCenter(node);
  const gid = getGroupAtPoint(c.x, c.y);
  setDragOverGroupId(gid);
}, [getNodeCenter, getGroupAtPoint]);

const onNodeDragStop = useCallback((evt, node) => {
  if (!node || node.type === "group") { setDragOverGroupId(null); return; }
  const c = getNodeCenter(node);
  const gid = getGroupAtPoint(c.x, c.y);
  if (gid) {
    setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, groupId: gid } } : n));
  }
  setDragOverGroupId(null);
}, [getNodeCenter, getGroupAtPoint]);


  // Buscar e focar no primeiro resultado quando o usuário apertar Enter na busca
  const focusFirstMatch = useCallback(() => {
    const term = (filter || "").trim().toLowerCase();
    if (!term) return;
    const match = nodes.find((n) =>
      (n.data?.name || "").toLowerCase().includes(term) ||
      (n.data?.type || "").toLowerCase().includes(term) ||
      (n.data?.tags || []).some((t) => (t || "").toLowerCase().includes(term))
    );
    if (match) {
      setSelectedNodeId(match.id);
      try {
        rfInstance?.setCenter(match.position.x + 130, match.position.y + 60, { zoom: 1.1, duration: 400 });
      } catch {}
    }
  }, [filter, nodes, rfInstance]);

  // Atalhos de teclado — válidos apenas na página "tree"
  useEffect(() => {
    const onKey = (e) => {
      if (page !== "tree") return;
      const k = (e.key || "").toLowerCase();
      const tag = ((e.target && e.target.tagName) || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || (e.target && e.target.isContentEditable);

      if (k === "delete" || k === "backspace") {
        if (isTyping) return;
        if (selectedNodeId) {
          e.preventDefault();
          deleteSelectedNode();
          return;
        }
        if (selectedEdgeIds.length) {
          e.preventDefault();
          deleteSelectedEdges();
          return;
        }
      }

      if (k === "m") setShowMiniMap((v) => !v);
      if (k === "_" ) addSkill();
      if (k === "{") autoLayout();
      if (k === "}") fit();

      if ((e.ctrlKey || e.metaKey) && k === "s") {
        e.preventDefault();
        exportJSON();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNodeId, selectedEdgeIds, page]);

  // ---------- PROPS MEMOIZADAS E NODES MAPEADOS ----------
  const defaultEdgeOptions = useMemo(
    () => ({ type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }),
    []
  );

  const mappedNodes = useMemo(() => {
    const term = (filter || "").trim().toLowerCase();
    const collapsed = new Set(nodes.filter((n) => n.type === "group" && n.data?.collapsed).map((n) => n.id));
    const childCount = new Map();
    nodes.forEach((n) => {
      const gid = n.data?.groupId;
      if (gid) childCount.set(gid, (childCount.get(gid) || 0) + 1);
    });
    return nodes
      .filter((n) => {
        if (n.type !== "group" && n.data?.groupId && collapsed.has(n.data.groupId)) return false;
        return true;
      })
      .map((n) => {
        const matches =
          !term ||
          n.data?.name?.toLowerCase().includes(term) ||
          (n.data?.tags || []).some((t) => (t || "").toLowerCase().includes(term)) ||
          (n.data?.type || "").toLowerCase().includes(term);

        const nextDim = term ? !matches : false;
        const prev = n.data || {};
        const extra = n.type === "group" ? { childCount: childCount.get(n.id) || 0, __hover: n.id === dragOverGroupId } : {};

        if (prev.__theme === theme && !!prev.__dim === !!nextDim && prev.childCount === extra.childCount) return n;

        return { ...n, data: { ...prev, ...extra, __theme: theme, __dim: nextDim } };
      });
  }, [nodes, theme, filter, dragOverGroupId]);

  const mappedEdges = useMemo(() => {
    const collapsed = new Set(nodes.filter((n) => n.type === "group" && n.data?.collapsed).map((n) => n.id));
    const hiddenNodeIds = new Set(
      nodes
        .filter((n) => n.type !== "group" && n.data?.groupId && collapsed.has(n.data.groupId))
        .map((n) => n.id)
    );
    return edges.filter((e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target));
  }, [nodes, edges]);

return (
    <div className={cx("w-full h-screen flex flex-col", isDark ? "bg-zinc-900 text-zinc-100" : "bg-slate-50 text-slate-900")}>
      {/* Barra superior global */}
      <div className="relative z-30 p-3 flex items-center gap-2">
        {/* Abas */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage("tree")}
            className={cx(
              "px-3 py-1.5 rounded-lg border shadow",
              page === "tree"
                ? "bg-indigo-600 text-white border-indigo-600"
                : isDark
                  ? "bg-zinc-900/90 border-zinc-700 hover:bg-zinc-800"
                  : "bg-white/90 border-slate-200 hover:bg-slate-50"
            )}
          >
            🌳 {t("tree")}
          </button>
          <button
            onClick={() => setPage("sheet")}
            className={cx(
              "px-3 py-1.5 rounded-lg border shadow",
              page === "sheet"
                ? "bg-indigo-600 text-white border-indigo-600"
                : isDark
                  ? "bg-zinc-900/90 border-zinc-700 hover:bg-zinc-800"
                  : "bg-white/90 border-slate-200 hover:bg-slate-50"
            )}
          >
            📝 {t("sheet")}
          </button>

          <button
            onClick={() => setPage("inventory")}
            className={cx(
              "px-3 py-1.5 rounded-lg border shadow",
              page === "inventory"
                ? "bg-indigo-600 text-white border-indigo-600"
                : isDark
                  ? "bg-zinc-900/90 border-zinc-700 hover:bg-zinc-800"
                  : "bg-white/90 border-slate-200 hover:bg-slate-50"
            )}
          >
            📦 {t("inventory")}
          </button>
        </div>

        {/* Botões contextuais da Árvore */}
        {page === "tree" && (
          <div className="flex items-center gap-2 ml-2">
            <button
              ref={topToggleBtnRef}
              onClick={() => setShowTopPanel((v) => !v)}
              className={cx(
                "px-3 py-1.5 rounded-lg border shadow",
                isDark ? "bg-zinc-900/90 border-zinc-700 hover:bg-zinc-800" : "bg-white/90 border-slate-200 hover:bg-slate-50"
              )}
              title={showTopPanel ? "Fechar menu" : "Abrir menu"}
              aria-expanded={showTopPanel}
              aria-pressed={showTopPanel}
            >
              ☰ {t("menu")}
            </button>

            <button
              ref={rightToggleBtnRef}
              onClick={() => setShowRightPanel((v) => !v)}
              className={cx(
                "px-3 py-1.5 rounded-lg border shadow",
                isDark ? "bg-zinc-900/90 border-zinc-700 hover:bg-zinc-800" : "bg-white/90 border-slate-200 hover:bg-slate-50"
              )}
              title={showRightPanel ? "Fechar painel" : "Abrir painel"}
              aria-expanded={showRightPanel}
              aria-pressed={showRightPanel}
            >
              🧰 {t("panel")}
            </button>
          </div>
        )}


        {/* Tema */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={cx(
            "ml-auto px-3 py-1.5 rounded-lg border",
            isDark ? "bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700"
                    : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
          )}
        >
          {isDark ? "🌙 Escuro" : "☀️ Claro"}
        </button>
        <select
            value={getLang()}
            onChange={(e) => setLang(e.target.value)}
            className="px-2 py-1.5 rounded-lg border"
            title={t("language")}
          >
            <option value="pt">PT-BR</option>
            <option value="en">EN</option>
          </select>
      </div>

      {/* Menu suspenso da Árvore */}
      {page === "tree" && showTopPanel && (
        <div
          ref={topPanelRef}
          className={cx(
            "absolute z-20 top-[58px] left-3 flex flex-wrap gap-2 backdrop-blur border rounded-xl p-2 shadow",
            isDark ? "bg-zinc-900/90 border-zinc-700" : "bg-white/90 border-slate-200"
          )}
        >
          <button onClick={() => addSkill()} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            {t("addNode")}
          </button>

          <div className="relative group">
            <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white">{t("examplePack")}</button>
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
                {t("feat")}
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
                {t("extraAttack")}
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
            {t("autoLayout")}
          </button>
          <button onClick={validate} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
            {t("validate")}
          </button>
          <button onClick={fit} className="px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900">
            {t("fit")}
          </button>

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
            {t("exportJSON")}
          </button>
          <button onClick={exportMarkdown} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800">
            {t("exportMD")}
          </button>
          <label className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer">
            {t("importJSON")}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])}
            />
          </label>
          <button onClick={clearAll} className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700">
            {t("clear")}
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
            {t("duplicateNode")}
          </button>
          <button
            onClick={groupSelection}
            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            disabled={(selectedNodeIds?.length ?? 0) === 0}
          >
            Agrupar seleção
          </button>
          <button
            onClick={ungroupSelection}
            className="px-3 py-1.5 rounded-lg bg-violet-700 text-white hover:bg-violet-800 disabled:opacity-50"
            disabled={(selectedNodeIds?.length ?? 0) === 0}
          >
            Remover do grupo
          </button>
          <button
            onClick={deleteSelectedEdges}
            disabled={!selectedEdgeIds.length}
            className="px-3 py-1.5 rounded-lg bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
          >
            {t("deleteEdges")}
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
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusFirstMatch(); } }}
              placeholder={t("searchPlaceholder")}
              className={cx(
                "px-3 py-1.5 rounded-lg border flex-1",
                isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100 placeholder-zinc-500" : "bg-white border-slate-200"
              )}
            />
            <span className="text-xs opacity-75">
              {nodes.length} {t("nodes")} • {edges.length} {t("connections")}
            </span>
          </div>
        </div>
      )}

      {/* Conteúdo da página */}
      <div className="flex-1 relative">
        {page === "tree" ? (
          <>
            <ReactFlow
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              isValidConnection={isValidConnection}
              onlyRenderVisibleElements
              zoomOnScroll
              selectionOnDrag
              deleteKeyCode={null}
              nodes={mappedNodes}
              edges={mappedEdges}
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
              onNodeDoubleClick={(e, node) => { if (node?.type === "group") toggleGroupCollapse(node.id); }}
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

            {/* Painel direito da Árvore */}
            <aside
              ref={rightPanelRef}
              style={{ willChange: "transform" }}
              className={cx(
                "absolute top-0 right-0 bottom-0 w-[380px] h-full border-l p-4 space-y-4 overflow-auto transform transition-transform duration-300 ease-out shadow-lg",
                isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200",
                showRightPanel ? "translate-x-0" : "translate-x-full"
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">ViewMode</h2>
                <button
                  onClick={() => setShowRightPanel(false)}
                  className={cx(
                    "px-2 py-1 rounded-md text-sm border",
                    isDark ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800" : "bg-white border-slate-200 hover:bg-slate-50"
                  )}
                  title="Fechar painel"
                >
                  ✕
                </button>
              </div>

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
                selectedNode.type === "group" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Editar Grupo</h3>
                      <button
                        onClick={() => toggleGroupCollapse(selectedNode.id)}
                        className="px-2 py-1 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                      >
                        {selectedNode.data?.collapsed ? "Abrir (expandir)" : "Fechar (recolher)"}
                      </button>
                    </div>
                    <label className="text-sm">
                      Nome do grupo
                      <input
                        className={cx(
                          "mt-1 w-full border rounded-md px-2 py-1.5",
                          isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                        )}
                        value={selectedNode.data?.name || ""}
                        onChange={(e) =>
                          setNodes((nds) =>
                            nds.map((n) =>
                              n.id === selectedNode.id ? { ...n, data: { ...n.data, name: e.target.value } } : n
                            )
                          )
                        }
                        placeholder="Ex.: Kit do Ladino"
                      />
                    </label>
                    <label className="text-sm">
                      Cor
                      <input
                        type="color"
                        className={cx("mt-1 w-full h-10 border rounded-md", isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-slate-300")}
                        value={selectedNode.data?.color || "#6366f1"}
                        onChange={(e) =>
                          setNodes((nds) =>
                            nds.map((n) =>
                              n.id === selectedNode.id ? { ...n, data: { ...n.data, color: e.target.value } } : n
                            )
                          )
                        }
                      />
                    </label>
                    <div className={cx("text-sm", isDark ? "text-zinc-300" : "text-gray-700")}>
                      Nós no grupo: <b>{nodes.filter((n)=>n.type!=="group" && n.data?.groupId===selectedNode.id).length}</b>
                    </div>
                  </div>
                ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{t("editNode")}</h3>
                    <button
                      onClick={deleteSelectedNode}
                      className="px-2 py-1 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                    >
                      {t("delete")}
                    </button>
                  </div>

                  <label className="text-sm">
                    {t("name")}
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
                      {t("type")}
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
                      {t("class")}
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
                      {t("shortText")}
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
                      {t("minLevel")}
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
                    {t("description")}
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
                      <span className="text-sm font-medium">{t("abilityReqs")}</span>
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
                      {t("actionEconomy")}
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
                      {t("uses")}
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
                        <option value="all">{t("all")}</option>
                        <option value="any">{t("any")}</option>
                      </select>
                    </label>
                  </div>

<div className="grid grid-cols-1 gap-2">
  <label className="text-sm">
    Grupo
    <select
      className={cx(
        "mt-1 w-full border rounded-md px-2 py-1.5",
        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
      )}
      value={selectedNode.data.groupId || ""}
      onChange={(e) => patchSelected({ groupId: e.target.value || undefined })}
    >
      <option value="">— Sem grupo —</option>
      {nodes.filter((n) => n.type === "group").map((g) => (
        <option key={g.id} value={g.id}>{g.data?.name || g.id}</option>
      ))}
    </select>
  </label>
</div>

                  <label className="text-sm">
                    {t("tags")}
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
              )
              )}

              <div className="pt-4 border-t space-y-2 text-sm">
                <details>
                  <summary className="cursor-pointer font-medium">Ajuda rápida</summary>
                  <ul className={cx("mt-2 list-disc pl-5 space-y-1", isDark ? "text-zinc-300" : "text-gray-700")}>
                    {t("helpBullets")}
                  </ul>
                </details>

                {lastValidation && (
                  <div className={cx("border rounded-lg p-3", isDark ? "border-zinc-800" : "border-slate-200")}>
                    <div className="font-medium mb-1">{t("validationReport")}</div>
                    {lastValidation.cycle ? (
                      <div className="text-red-500">{t("cycle")}: {lastValidation.cycle.join(" → ")}</div>
                    ) : (
                      <div className="text-emerald-500">{t("noCycles")}.</div>
                    )}
                    <div className={cx(isDark ? "text-zinc-300" : "text-gray-700")}>
                      {t("roots")}: <span className="font-mono">{(lastValidation.roots || []).join(", ") || "—"}</span>
                    </div>
                    <div className={cx(isDark ? "text-zinc-300" : "text-gray-700")}>{t("layers")}: {lastValidation.layersCount}</div>
                  </div>
                )}
              </div>
            </aside>
          </>
        ) : page === "inventory" ? (
          <InventoryManager isDark={isDark} onExportToTree={addItemsToTree} />
        ) : (
          <CharacterSheet isDark={isDark} />
        )}
      </div>
    </div>
  );
}
