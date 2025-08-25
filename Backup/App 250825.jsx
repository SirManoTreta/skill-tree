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

/**
 * ============================================
 * Skill Tree D&D + Inventory (uma única página)
 * ============================================
 * - Mantém toda a funcionalidade da Árvore.
 * - Adiciona página "Inventário" com categorias:
 *   Armaduras, Armas/Munição, Miscelânia, Chaves, Dados.
 * - Persistência em localStorage, exportar/importar JSON,
 *   busca, filtros, ordenação, ações (equipar/sintonizar/usar/duplicar/apagar).
 */

const STORAGE_KEYS = ["skill-tree-dnd-v1", "skill-tree-data-v1"];
const THEME_KEY = "skill-tree-theme";
const PAGE_KEY = "skill-tree-page";
const INVENTORY_KEY = "skill-tree-inventory-v1";

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
  { value: "Transformation", label: "Transformação" },
  { value: "Other", label: "Outro" },
];

// Mantido como você pediu (sem lista completa)
const CLASSES_5E = [
  { value: "Gunslinger", label: "Pistoleiro" },
  { value: "Barbarian", label: "Bárbaro" },
  { value: "Bard", label: "Bardo" },
  { value: "Cleric", label: "Clérigo" },
  { value: "Druid", label: "Druida" },
  { value: "Fighter", label: "Guerreiro" },
  { value: "Monk", label: "Monge" },
  { value: "Paladin", label: "Paladino" },
  { value: "Ranger", label: "Patrulheiro" },
  { value: "Rogue", label: "Ladino" },
  { value: "Sorcerer", label: "Feiticeiro" },
  { value: "Warlock", label: "Bruxo" },
  { value: "Wizard", label: "Mago" },
  { value: "Artificer", label: "Artífice" },
  { value: "Other", label: "Outra" },
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
const parseTags = (s) => (s || "").split(/[;,]/).map((t) => t.trim()).filter(Boolean);
const formatTags = (arr) => (arr || []).join(", ");

// ====================== NÓ da Árvore ======================
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
      <Handle type="target" position={Position.Left} id="in-left" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="target" position={Position.Right} id="in-right" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="target" position={Position.Top} id="in-top" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="target" position={Position.Bottom} id="in-bottom" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Left} id="out-left" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Right} id="out-right" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Top} id="out-top" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Bottom} id="out-bottom" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
    </div>
  );
});

const nodeTypes = { skill: SkillNode };

// ====================== Inventário =========================
const ITEM_CATEGORIES = [
  { value: "armor", label: "Armaduras" },
  { value: "weapon", label: "Armas / Munição" },
  { value: "misc", label: "Miscelânia" },
  { value: "keys", label: "Chaves" },
  { value: "dice", label: "Dados" },
];

const ARMOR_TYPES = [
  { value: "light", label: "Leve" },
  { value: "medium", label: "Média" },
  { value: "heavy", label: "Pesada" },
  { value: "shield", label: "Escudo" },
];

const currencyToGp = (value, unit) => {
  const v = Number(value || 0);
  switch ((unit || "gp").toLowerCase()) {
    case "pp": return v * 10; // 1 pp = 10 gp
    case "gp": return v;
    case "ep": return v * 0.5; // 1 ep = 0.5 gp
    case "sp": return v * 0.1;
    case "cp": return v * 0.01;
    default: return v;
  }
};
const gpToPretty = (gp) => {
  // Representa preferindo gp, sp, cp
  if (gp >= 1) return `${(+gp).toFixed(2)} gp`;
  if (gp >= 0.1) return `${(gp * 10).toFixed(0)} sp`;
  return `${(gp * 100).toFixed(0)} cp`;
};

function InventoryManager({ isDark }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(INVENTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [filterText, setFilterText] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedIds, setSelectedIds] = useState([]);

  // Formulário de novo/edição
  const emptyForm = useMemo(() => ({
    id: null,
    name: "",
    category: "misc",
    qty: 1,
    weight: 0,
    valueNum: 0,
    valueUnit: "gp",
    equipped: false,
    attuned: false,
    tags: [],
    notes: "",
    // Armadura
    armorType: "light",
    ac: 0,
    stealthDisadv: false,
    strReq: 0,
    // Arma
    damage: "",
    range: "",
    ammoCurrent: 0,
    ammoMax: 0,
    // Dados
    die: "d6",
    dieCount: 0,
    label: "",
    // Chaves
    keyWhere: "",
    keyUse: "",
  }), []);

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    try { localStorage.setItem(INVENTORY_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const resetForm = () => setForm(emptyForm);

  const onSubmit = (e) => {
    e?.preventDefault?.();
    const id = form.id || uid();
    const base = {
      ...form,
      id,
      valueGp: currencyToGp(form.valueNum, form.valueUnit),
      tags: Array.isArray(form.tags) ? form.tags : parseTags(form.tags),
      qty: Math.max(0, Number(form.qty || 0)),
      weight: Number(form.weight || 0),
      ac: Number(form.ac || 0),
      strReq: Number(form.strReq || 0),
      ammoCurrent: Number(form.ammoCurrent || 0),
      ammoMax: Number(form.ammoMax || 0),
      dieCount: Number(form.dieCount || 0),
    };
    setItems((arr) => {
      const exists = arr.some((x) => x.id === id);
      if (exists) return arr.map((x) => (x.id === id ? base : x));
      return [base, ...arr];
    });
    resetForm();
  };

  const editItem = (it) => {
    setForm({
      ...emptyForm,
      ...it,
      valueNum: it.valueNum ?? (it.valueGp ?? 0),
      valueUnit: it.valueUnit || "gp",
      tags: it.tags || [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const duplicateItem = (id) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const copy = { ...it, id: uid(), name: it.name + " (cópia)" };
    setItems((arr) => [copy, ...arr]);
  };

  const deleteItem = (id) => setItems((arr) => arr.filter((x) => x.id !== id));
  const bulkDelete = () => setItems((arr) => arr.filter((x) => !selectedIds.includes(x.id)));

  const toggle = (id, key) =>
    setItems((arr) => arr.map((x) => (x.id === id ? { ...x, [key]: !x[key] } : x)));

  const consumeOne = (id) =>
    setItems((arr) => arr.map((x) => (x.id === id ? { ...x, qty: Math.max(0, (x.qty || 0) - 1) } : x)));

  const useAmmo = (id, delta) =>
    setItems((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              ammoCurrent: Math.max(0, Math.min((x.ammoMax || 0), (x.ammoCurrent || 0) + delta)),
            }
          : x
      )
    );

  const addTemplate = (tpl) => {
    const tpls = {
      "rapier": {
        name: "Florete",
        category: "weapon",
        qty: 1,
        weight: 2,
        valueNum: 25, valueUnit: "gp",
        damage: "1d8 perfurante",
        range: "corpo-a-corpo (finesse)",
        tags: ["finesse", "leve"],
      },
      "longbow": {
        name: "Arco Longo + Flechas (20)",
        category: "weapon",
        qty: 1,
        weight: 2,
        valueNum: 50, valueUnit: "gp",
        damage: "1d8 perfurante",
        range: "distância 150/600",
        ammoCurrent: 20, ammoMax: 20,
        tags: ["duas-mãos", "munição"],
      },
      "chainmail": {
        name: "Cota de Malha",
        category: "armor",
        armorType: "heavy",
        ac: 16,
        strReq: 13,
        stealthDisadv: true,
        qty: 1,
        weight: 55,
        valueNum: 75, valueUnit: "gp",
      },
      "lockpick": {
        name: "Ferramentas de Ladrão",
        category: "misc",
        qty: 1,
        weight: 1,
        valueNum: 25, valueUnit: "gp",
        tags: ["ferramenta"],
      },
      "key": {
        name: "Chave enferrujada",
        category: "keys",
        qty: 1,
        weight: 0,
        keyWhere: "Porta da cripta antiga",
        keyUse: "Abre o cadeado grande",
      },
      "inspiration": {
        name: "Inspiração",
        category: "dice",
        die: "token",
        dieCount: 1,
        label: "Marcador de Inspiração",
        qty: 1,
        weight: 0,
      },
    };
    const base = tpls[tpl];
    if (!base) return;
    setItems((arr) => [{ ...base, id: uid(), valueGp: currencyToGp(base.valueNum || 0, base.valueUnit || "gp") }, ...arr]);
  };

  const exportJSON = async () => {
    const data = JSON.stringify({ items }, null, 2);
    await download(
      `inventory-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
      data,
      "application/json"
    );
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed.items)) {
          const cleaned = parsed.items.map((x) => ({ ...x, id: x.id || uid() }));
          setItems(cleaned);
        } else {
          alert("JSON inválido. Esperado { items: [...] }");
        }
      } catch {
        alert("Não foi possível ler o JSON.");
      }
    };
    reader.readAsText(file);
  };

  const filtered = useMemo(() => {
    const t = (filterText || "").toLowerCase();
    let out = items.filter((x) => {
      const byCat = filterCat === "all" || x.category === filterCat;
      if (!byCat) return false;
      if (!t) return true;
      const hay = [
        x.name,
        x.category,
        (x.tags || []).join(" "),
        x.notes,
        x.damage,
        x.range,
        x.keyWhere,
        x.keyUse,
        x.label
      ].join(" ").toLowerCase();
      return hay.includes(t);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const A = (a[sortBy] ?? (sortBy === "name" ? a.name : 0));
      const B = (b[sortBy] ?? (sortBy === "name" ? b.name : 0));
      if (typeof A === "string" && typeof B === "string") return A.localeCompare(B) * dir;
      return (A - B) * dir;
    });
    return out;
  }, [items, filterText, filterCat, sortBy, sortDir]);

  const totals = useMemo(() => {
    const totalQty = items.reduce((s, x) => s + (Number(x.qty || 0)), 0);
    const totalWeight = items.reduce((s, x) => s + (Number(x.weight || 0) * Number(x.qty || 0)), 0);
    const totalGp = items.reduce((s, x) => s + Number(x.valueGp || 0) * Number(x.qty || 0), 0);
    return { totalQty, totalWeight, totalGp };
  }, [items]);

  const lineCls = cx(
    "grid grid-cols-[24px_1fr_120px_110px_120px_150px_140px_120px] gap-2 items-center py-2 px-2 rounded-lg border",
    isDark ? "border-zinc-800 hover:bg-zinc-900" : "border-slate-200 hover:bg-slate-50"
  );

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header de ações */}
      <div className="p-3 flex flex-wrap gap-2 items-center">
        <div className={cx("px-3 py-1.5 rounded-lg border flex items-center gap-2",
          isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200")}>
          <input
            className={cx("outline-none", isDark ? "bg-transparent placeholder-zinc-400" : "bg-transparent placeholder-gray-500")}
            placeholder="Buscar no inventário..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>

        <select
          className={cx("px-3 py-1.5 rounded-lg border",
            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200")}
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="all">Todas categorias</option>
          {ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <div className="flex items-center gap-1">
          <label className="text-sm opacity-70">Ordenar por</label>
          <select
            className={cx("px-3 py-1.5 rounded-lg border",
              isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200")}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name">Nome</option>
            <option value="category">Categoria</option>
            <option value="qty">Qtd</option>
            <option value="weight">Peso</option>
            <option value="valueGp">Valor (gp)</option>
          </select>
          <button
            className={cx("px-3 py-1.5 rounded-lg border",
              isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-slate-200")}
            onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
            title="Alternar direção"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>

        <div className="ml-auto flex gap-2">
          <div className="relative group">
            <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white">+ Template</button>
            <div className={cx(
              "absolute mt-1 hidden group-hover:block min-w-[240px] border rounded-lg p-2 text-sm z-10",
              isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-slate-200"
            )}>
              <button onClick={() => addTemplate("rapier")} className={cx("block w-full text-left px-2 py-1 rounded", isDark ? "hover:bg-zinc-800" : "hover:bg-slate-50")}>Florete</button>
              <button onClick={() => addTemplate("longbow")} className={cx("block w-full text-left px-2 py-1 rounded", isDark ? "hover:bg-zinc-800" : "hover:bg-slate-50")}>Arco Longo + Flechas</button>
              <button onClick={() => addTemplate("chainmail")} className={cx("block w-full text-left px-2 py-1 rounded", isDark ? "hover:bg-zinc-800" : "hover:bg-slate-50")}>Cota de Malha</button>
              <button onClick={() => addTemplate("lockpick")} className={cx("block w-full text-left px-2 py-1 rounded", isDark ? "hover:bg-zinc-800" : "hover:bg-slate-50")}>Ferramentas de Ladrão</button>
              <button onClick={() => addTemplate("key")} className={cx("block w-full text-left px-2 py-1 rounded", isDark ? "hover:bg-zinc-800" : "hover:bg-slate-50")}>Chave</button>
              <button onClick={() => addTemplate("inspiration")} className={cx("block w-full text-left px-2 py-1 rounded", isDark ? "hover:bg-zinc-800" : "hover:bg-slate-50")}>Inspiração (ficha)</button>
            </div>
          </div>

          <button onClick={exportJSON} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800">Exportar JSON</button>
          <label className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer">
            Importar JSON
            <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
          </label>
          <button
            onClick={bulkDelete}
            disabled={!selectedIds.length}
            className={cx("px-3 py-1.5 rounded-lg text-white hover:opacity-90 disabled:opacity-40", "bg-red-600")}
          >
            Apagar selecionados ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={onSubmit} className="px-3 pb-2">
        <div className={cx("rounded-2xl border p-3 grid gap-3",
          isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200")}>
          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-sm">
              Nome
              <input
                className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                  isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Espada Longa"
              />
            </label>

            <label className="text-sm">
              Categoria
              <select
                className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                  isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>

            <label className="text-sm">
              Tags (vírgulas)
              <input
                className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                  isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                value={Array.isArray(form.tags) ? formatTags(form.tags) : form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: parseTags(e.target.value) }))}
                placeholder="mágico, prata, sagrado"
              />
            </label>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <label className="text-sm">
              Quantidade
              <input
                type="number" min={0}
                className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                  isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm">
              Peso (lb) por unidade
              <input
                type="number" min={0} step="0.1"
                className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                  isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                value={form.weight}
                onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm">
              Valor
              <div className="flex gap-2">
                <input
                  type="number" min={0} step="0.01"
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.valueNum}
                  onChange={(e) => setForm((f) => ({ ...f, valueNum: e.target.value }))}
                />
                <select
                  className={cx("mt-1 w-24 border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.valueUnit}
                  onChange={(e) => setForm((f) => ({ ...f, valueUnit: e.target.value }))}
                >
                  <option>gp</option><option>sp</option><option>cp</option><option>pp</option><option>ep</option>
                </select>
              </div>
            </label>

            <div className="flex gap-2 items-end">
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={form.equipped} onChange={() => setForm((f) => ({ ...f, equipped: !f.equipped }))}/>
                Equipado
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={form.attuned} onChange={() => setForm((f) => ({ ...f, attuned: !f.attuned }))}/>
                Sintonizado
              </label>
            </div>
          </div>

          {/* Campos específicos por categoria */}
          {form.category === "armor" && (
            <div className={cx("rounded-lg p-3 grid md:grid-cols-4 gap-3",
              isDark ? "border border-zinc-800" : "border border-slate-200")}>
              <label className="text-sm">
                Tipo de Armadura
                <select
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.armorType}
                  onChange={(e) => setForm((f) => ({ ...f, armorType: e.target.value }))}
                >
                  {ARMOR_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </label>
              <label className="text-sm">
                CA (AC)
                <input
                  type="number" min={0}
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.ac}
                  onChange={(e) => setForm((f) => ({ ...f, ac: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm">
                Força mín.
                <input
                  type="number" min={0}
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.strReq}
                  onChange={(e) => setForm((f) => ({ ...f, strReq: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={form.stealthDisadv} onChange={() => setForm((f) => ({ ...f, stealthDisadv: !f.stealthDisadv }))}/>
                Desvantagem em Furtividade
              </label>
            </div>
          )}

          {form.category === "weapon" && (
            <div className={cx("rounded-lg p-3 grid md:grid-cols-4 gap-3",
              isDark ? "border border-zinc-800" : "border border-slate-200")}>
              <label className="text-sm md:col-span-2">
                Dano
                <input
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.damage}
                  onChange={(e) => setForm((f) => ({ ...f, damage: e.target.value }))}
                  placeholder="ex.: 1d8 perfurante"
                />
              </label>
              <label className="text-sm md:col-span-2">
                Alcance
                <input
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.range}
                  onChange={(e) => setForm((f) => ({ ...f, range: e.target.value }))}
                  placeholder="ex.: corpo-a-corpo, 80/320"
                />
              </label>
              <label className="text-sm">
                Munição atual
                <input
                  type="number" min={0}
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.ammoCurrent}
                  onChange={(e) => setForm((f) => ({ ...f, ammoCurrent: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm">
                Munição máx.
                <input
                  type="number" min={0}
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.ammoMax}
                  onChange={(e) => setForm((f) => ({ ...f, ammoMax: Number(e.target.value) }))}
                />
              </label>
            </div>
          )}

          {form.category === "dice" && (
            <div className={cx("rounded-lg p-3 grid md:grid-cols-3 gap-3",
              isDark ? "border border-zinc-800" : "border border-slate-200")}>
              <label className="text-sm">
                Tipo (d4, d6, d8, d10, d12, d20, token)
                <input
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.die}
                  onChange={(e) => setForm((f) => ({ ...f, die: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Quantidade de Dados
                <input
                  type="number" min={0}
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.dieCount}
                  onChange={(e) => setForm((f) => ({ ...f, dieCount: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm">
                Rótulo
                <input
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="ex.: Inspiração, Dado de Risco"
                />
              </label>
            </div>
          )}

          {form.category === "keys" && (
            <div className={cx("rounded-lg p-3 grid md:grid-cols-2 gap-3",
              isDark ? "border border-zinc-800" : "border border-slate-200")}>
              <label className="text-sm">
                Onde abre
                <input
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.keyWhere}
                  onChange={(e) => setForm((f) => ({ ...f, keyWhere: e.target.value }))}
                  placeholder="Ex.: Porta da cripta"
                />
              </label>
              <label className="text-sm">
                Finalidade / Observações
                <input
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.keyUse}
                  onChange={(e) => setForm((f) => ({ ...f, keyUse: e.target.value }))}
                  placeholder="Ex.: Abre cadeado grande"
                />
              </label>
            </div>
          )}

          <label className="text-sm">
            Notas
            <textarea
              className={cx("mt-1 w-full border rounded-md px-2 py-1.5 min-h-[70px]",
                isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Anotações, propriedades especiais, origem, etc."
            />
          </label>

          <div className="flex gap-2 justify-end">
            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 rounded-lg border"
              >
                Cancelar edição
              </button>
            )}
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {form.id ? "Salvar item" : "Adicionar item"}
            </button>
          </div>
        </div>
      </form>

      {/* Totais */}
      <div className="px-3 pb-2">
        <div className={cx("rounded-xl border p-2 text-sm flex gap-4",
          isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200")}>
          <div><span className="opacity-70">Itens:</span> <strong>{totals.totalQty}</strong></div>
          <div><span className="opacity-70">Peso total:</span> <strong>{totals.totalWeight.toFixed(2)} lb</strong></div>
          <div><span className="opacity-70">Valor total:</span> <strong>{gpToPretty(totals.totalGp)}</strong></div>
        </div>
      </div>

      {/* Lista */}
      <div className="px-3 pb-6 overflow-auto">
        {/* Cabeçalho */}
        <div className={cx("sticky top-0 z-10 py-2 px-2 text-xs uppercase tracking-wide",
          isDark ? "bg-zinc-950" : "bg-slate-50")}>
          <div className={cx("grid grid-cols-[24px_1fr_120px_110px_120px_150px_140px_120px] gap-2 px-2")}>
            <div></div>
            <div>Item</div>
            <div>Categoria</div>
            <div>Qtd</div>
            <div>Peso (lb)</div>
            <div>Valor (total)</div>
            <div>Propriedades</div>
            <div>Ações</div>
          </div>
        </div>

        {filtered.map((x) => {
          const props = [];
          if (x.category === "armor") {
            props.push(`AC ${x.ac || 0}`);
            if (x.armorType) props.push(getLabel(ARMOR_TYPES, x.armorType));
            if (x.strReq) props.push(`Força ${x.strReq}+`);
            if (x.stealthDisadv) props.push("Desv. Furtividade");
          }
          if (x.category === "weapon") {
            if (x.damage) props.push(x.damage);
            if (x.range) props.push(x.range);
            if (x.ammoMax) props.push(`Munição ${x.ammoCurrent || 0}/${x.ammoMax}`);
          }
          if (x.category === "dice") {
            props.push(`${x.label || "Fichas"}: ${x.dieCount} ${x.die}`);
          }
          if (x.category === "keys") {
            if (x.keyWhere) props.push(`Local: ${x.keyWhere}`);
            if (x.keyUse) props.push(`Uso: ${x.keyUse}`);
          }

          const valueTotal = (Number(x.valueGp || 0) * Number(x.qty || 0));
          const isSelected = selectedIds.includes(x.id);

          return (
            <div key={x.id} className={lineCls}>
              <div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() =>
                    setSelectedIds((ids) =>
                      isSelected ? ids.filter((i) => i !== x.id) : [...ids, x.id]
                    )
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <div className={cx("text-sm font-medium truncate", x.equipped ? "text-emerald-600" : "")}>
                  {x.name}
                </div>
                {x.attuned && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-600 text-white">Sintonizado</span>}
                {Array.isArray(x.tags) && x.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {x.tags.slice(0, 3).map((t, i) => (
                      <span key={i} className={cx("text-[10px] px-2 py-0.5 rounded-full border",
                        isDark ? "border-zinc-700" : "border-slate-200")}>{t}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-sm opacity-80">{getLabel(ITEM_CATEGORIES, x.category)}</div>

              <div className="text-sm">{x.qty}</div>
              <div className="text-sm">{(Number(x.weight || 0) * Number(x.qty || 0)).toFixed(2)}</div>
              <div className="text-sm">{gpToPretty(valueTotal)}</div>

              <div className={cx("text-xs", isDark ? "text-zinc-300" : "text-gray-700")}>
                {props.join(" • ")}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className={cx("px-2 py-1 text-xs rounded-md border",
                    isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-200 hover:bg-slate-50")}
                  onClick={() => toggle(x.id, "equipped")}
                  title="Equipar/Desequipar"
                >
                  {x.equipped ? "Desequipar" : "Equipar"}
                </button>
                <button
                  className={cx("px-2 py-1 text-xs rounded-md border",
                    isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-200 hover:bg-slate-50")}
                  onClick={() => toggle(x.id, "attuned")}
                  title="Sintonizar"
                >
                  {x.attuned ? "Dessintonizar" : "Sintonizar"}
                </button>

                {x.category === "weapon" && x.ammoMax > 0 && (
                  <>
                    <button
                      className="px-2 py-1 text-xs rounded-md bg-slate-700 text-white hover:bg-slate-800"
                      onClick={() => useAmmo(x.id, -1)}
                      title="Gastar 1 munição"
                    >
                      -1 munição
                    </button>
                    <button
                      className="px-2 py-1 text-xs rounded-md bg-slate-700 text-white hover:bg-slate-800"
                      onClick={() => useAmmo(x.id, +1)}
                      title="Recarregar 1"
                    >
                      +1 munição
                    </button>
                  </>
                )}

                {(x.category === "misc" || x.category === "dice") && (
                  <button
                    className="px-2 py-1 text-xs rounded-md bg-amber-600 text-white hover:bg-amber-700"
                    onClick={() => consumeOne(x.id)}
                    title="Consumir 1 unidade"
                  >
                    Usar 1
                  </button>
                )}

                <button
                  className="px-2 py-1 text-xs rounded-md bg-violet-600 text-white hover:bg-violet-700"
                  onClick={() => editItem(x)}
                >
                  Editar
                </button>
                <button
                  className="px-2 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => duplicateItem(x.id)}
                >
                  Duplicar
                </button>
                <button
                  className="px-2 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700"
                  onClick={() => deleteItem(x.id)}
                >
                  Apagar
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className={cx("text-sm px-2 py-6 text-center rounded-xl border",
            isDark ? "border-zinc-800 text-zinc-400" : "border-slate-200 text-gray-600")}>
            Nenhum item encontrado.
          </div>
        )}
      </div>
    </div>
  );
}

// ====================== Árvore (mesmo código de antes) ======================
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
  const [selectedEdgeIds, setSelectedEdgeIds] = useState([]);
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
  }, [selectedNodeId, selectedEdgeIds, page]);

  // ---------- PROPS MEMOIZADAS E NODES MAPEADOS ----------
  const defaultEdgeOptions = useMemo(
    () => ({ type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }),
    []
  );

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

      if (prev.__theme === theme && !!prev.__dim === !!nextDim) return n;

      return { ...n, data: { ...prev, __theme: theme, __dim: nextDim } };
    });
  }, [nodes, theme, filter]);

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
            🌳 Árvore
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
            📦 Inventário
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
              ☰ Menu
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
              🧰 Painel
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
          {isDark ? "☀️ Claro" : "🌙 Escuro"}
        </button>
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
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusFirstMatch(); } }}
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

      {/* Conteúdo da página */}
      <div className="flex-1 relative">
        {page === "tree" ? (
          <>
            <ReactFlow
              isValidConnection={isValidConnection}
              onlyRenderVisibleElements
              zoomOnScroll
              selectionOnDrag
              deleteKeyCode={null}
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
                    <li>Use <strong>Layout automático</strong> para organizar por ordem de desbloqueio.</li>
                    <li>Campos de D&D: Tipo, Classe, Nível, Atributos, Ação e Usos.</li>
                    <li>Exporte em <em>JSON</em> (para reabrir) ou <em>Markdown</em> (para documentação).</li>
                    <li>Dê <em>duplo clique</em> em uma ligação para removê-la.</li>
                    <li>Atalhos: '_' novo nó • '{' auto layout • '}' ajustar visão • Ctrl+S exporta.</li>
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
          </>
        ) : (
          <InventoryManager isDark={isDark} />
        )}
      </div>
    </div>
  );
}
