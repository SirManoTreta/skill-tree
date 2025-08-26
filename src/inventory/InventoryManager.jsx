import React, { useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS, THEME_KEY, PAGE_KEY, INVENTORY_KEY } from "../constants/storage";
import { ITEM_CATEGORIES, ARMOR_TYPES } from "../constants/dnd";
import { cx, uid, parseTags, formatTags, getLabel, download } from "../utils/misc";

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

  // Formulário de novo/edição (dobrável)
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
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(INVENTORY_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const openNew = () => { setForm(emptyForm); setShowEditor(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cancelEdit = () => { setForm(emptyForm); setShowEditor(false); };

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
    setShowEditor(false);
    setForm(emptyForm);
  };

  const editItem = (it) => {
    setForm({
      ...emptyForm,
      ...it,
      valueNum: it.valueNum ?? (it.valueGp ?? 0),
      valueUnit: it.valueUnit || "gp",
      tags: it.tags || [],
    });
    setShowEditor(true);
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
          <button onClick={openNew} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            + Novo Item
          </button>

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

      {/* Editor dobrável */}
      {showEditor && (
        <form onSubmit={onSubmit} className="px-3 pb-2">
          <div className={cx("rounded-2xl border p-3 grid gap-3",
            isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200")}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{form.id ? "Editar Item" : "Novo Item"}</h3>
              <button type="button" onClick={cancelEdit} className={cx("px-2 py-1 rounded-md border text-sm",
                isDark ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800" : "bg-white border-slate-300 hover:bg-slate-50")}>
                Fechar
              </button>
            </div>

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
                  Quantidade de dados
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
                  onClick={() => setForm(emptyForm)}
                  className="px-3 py-1.5 rounded-lg border"
                >
                  Limpar
                </button>
              )}
              <button
                type="button"
                onClick={cancelEdit}
                className="px-3 py-1.5 rounded-lg border"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {form.id ? "Salvar item" : "Adicionar item"}
              </button>
            </div>
          </div>
        </form>
      )}

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

export default InventoryManager;