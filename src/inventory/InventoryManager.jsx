import React, { useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS, THEME_KEY, PAGE_KEY, INVENTORY_KEY } from "../constants/storage";
import { ITEM_CATEGORIES, ARMOR_TYPES } from "../constants/dnd";
import { cx, uid, parseTags, formatTags, getLabel, download } from "../utils/misc";
import { t, getLang, setLang } from "../utils/i18n";

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
    ammo: { active: 0, slots: [] },
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
  

  // Editor helpers for ammo slots
  const addAmmoSlotToForm = () => {
    setForm((f) => {
      const prev = f.ammo && Array.isArray(f.ammo.slots) ? f.ammo.slots : [];
      const next = [...prev, { type: "", current: 0, max: 0, note: "" }];
      return { ...f, ammo: { active: Math.min(f.ammo?.active ?? 0, next.length - 1), slots: next } };
    });
  };

  const updateAmmoSlotInForm = (index, patch) => {
    setForm((f) => {
      const prev = f.ammo && Array.isArray(f.ammo.slots) ? f.ammo.slots : [];
      const slots = prev.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...f, ammo: { active: Math.min(f.ammo?.active ?? 0, slots.length - 1), slots } };
    });
  };

  const removeAmmoSlotFromForm = (index) => {
    setForm((f) => {
      const prev = f.ammo && Array.isArray(f.ammo.slots) ? f.ammo.slots : [];
      const slots = prev.filter((_, i) => i !== index);
      let active = f.ammo?.active ?? 0;
      if (active >= slots.length) active = Math.max(0, slots.length - 1);
      return { ...f, ammo: { active, slots } };
    });
  };

  const setActiveAmmoSlotInForm = (index) => {
    setForm((f) => {
      if (!f.ammo || !Array.isArray(f.ammo.slots) || f.ammo.slots.length === 0) return f;
      const idx = Math.max(0, Math.min(index, f.ammo.slots.length - 1));
      return { ...f, ammo: { ...f.ammo, active: idx } };
    });
  };
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
    // Normalize multi-ammo slots (if present)
    if (form && form.ammo && Array.isArray(form.ammo.slots) && form.ammo.slots.length > 0) {
      const slots = form.ammo.slots.map((s) => ({
        type: s.type || "",
        current: Math.max(0, Number(s.current || 0)),
        max: Math.max(0, Number(s.max || 0)),
        note: s.note || "",
      }));
      const active = Math.max(0, Math.min(Number(form.ammo.active ?? 0), slots.length - 1));
      base.ammo = { active, slots };
    } else if ((Number(form.ammoMax || 0) > 0) || (Number(form.ammoCurrent || 0) > 0)) {
      // Legacy single-ammo -> convert to one slot
      base.ammo = { active: 0, slots: [{ type: "", current: Number(form.ammoCurrent || 0), max: Number(form.ammoMax || 0), note: "" }] };
    }

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
    const copy = { ...it, id: uid(), name: it.name + " (copy)" };
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

  // Multi-ammo slots helpers
  const useAmmoSlot = (id, delta) =>
    setItems((arr) =>
      arr.map((x) => {
        if (x.id !== id) return x;
        const ammo = x.ammo;
        if (!ammo || !Array.isArray(ammo.slots) || ammo.slots.length === 0) return x;
        const a = Math.max(0, Math.min(ammo.active ?? 0, ammo.slots.length - 1));
        const slots = ammo.slots.map((s, i) => {
          if (i !== a) return s;
          const cur = Number(s.current || 0) + Number(delta || 0);
          const mx = Number(s.max || 0);
          const clamped = Math.max(0, mx > 0 ? Math.min(mx, cur) : Math.max(0, cur));
          return { ...s, current: clamped };
        });
        return { ...x, ammo: { ...ammo, active: a, slots } };
      })
    );

  const cycleAmmoSlot = (id, dir = 1) =>
    setItems((arr) =>
      arr.map((x) => {
        if (x.id !== id) return x;
        const ammo = x.ammo;
        if (!ammo || !Array.isArray(ammo.slots) || ammo.slots.length === 0) return x;
        const len = ammo.slots.length;
        const next = ((Number(ammo.active ?? 0) + Number(dir || 1)) % len + len) % len;
        return { ...x, ammo: { ...ammo, active: next } };
      })
    );

  const setActiveAmmoSlot = (id, index) =>
    setItems((arr) =>
      arr.map((x) => {
        if (x.id !== id) return x;
        const ammo = x.ammo;
        if (!ammo || !Array.isArray(ammo.slots) || ammo.slots.length === 0) return x;
        const idx = Math.max(0, Math.min(Number(index || 0), ammo.slots.length - 1));
        return { ...x, ammo: { ...ammo, active: idx } };
      })
    );


  const addTemplate = (tpl) => {
    const tpls = {
      "rapier": {
        name: "Florete",
        category: "weapon",
        qty: 1,
        weight: 2,
        valueNum: 25, valueUnit: "gp",
        damage: "1d8 piercing",
        range: "melee (finesse)",
        tags: ["finesse", "light"],
      },
      "longbow": {
        name: "Longbow + Arrows (20)",
        category: "weapon",
        qty: 1,
        weight: 2,
        valueNum: 50, valueUnit: "gp",
        damage: "1d8 piercing",
        range: "range 150/600",
        ammo: { active: 0, slots: [ { type: "padrão", current: 20, max: 20, note: "flechas comuns" } ] },
        ammoCurrent: 20, ammoMax: 20,
        tags: ["two-handed", "ammunition"],
      },
      "chainmail": {
        name: "Chain Mail",
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
        name: "Thieves’ Tools",
        category: "misc",
        qty: 1,
        weight: 1,
        valueNum: 25, valueUnit: "gp",
        tags: ["tool"],
      },
      "key": {
        name: "Rusty Key",
        category: "keys",
        qty: 1,
        weight: 0,
        keyWhere: "Old crypt door",
        keyUse: "Opens the big padlock",
      },
      "inspiration": {
        name: "Inspiration",
        category: "dice",
        die: "token",
        dieCount: 1,
        label: "Inspiration Marker",
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
          alert("Invalid JSON. Expected { items: [...] }");
        }
      } catch {
        alert("Unable to read JSON.");
      }
    };
    reader.readAsText(file);
  };

  const filtered = useMemo(() => {
    const tSearch = (filterText || "").toLowerCase();
    let out = items.filter((x) => {
      const byCat = filterCat === "all" || x.category === filterCat;
      if (!byCat) return false;
      if (!tSearch) return true;
      const hay = [
        x.name, x.category, (x.tags || []).join(" "), x.notes, x.damage, x.range, x.keyWhere, x.keyUse, x.label
      ].join(" ").toLowerCase();
      return hay.includes(tSearch);
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

  const lang = getLang();

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header de ações */}
      <div className="p-3 flex flex-wrap gap-2 items-center">
        <div className={cx("px-3 py-1.5 rounded-lg border flex items-center gap-2",
          isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200")}>
          <input
            className={cx("outline-none", isDark ? "bg-transparent placeholder-zinc-400" : "bg-transparent placeholder-gray-500")}
            placeholder={t("searchInventory")}
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
          <option value="all">{t("allCategories")}</option>
          {ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <div className="flex items-center gap-1">
          <label className="text-sm opacity-70">{t("sortBy")}</label>
          <select
            className={cx("px-3 py-1.5 rounded-lg border",
              isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200")}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name">{t("name")}</option>
            <option value="category">{t("category")}</option>
            <option value="qty">{t("qty")}</option>
            <option value="weight">{t("weight")}</option>
            <option value="valueGp">{t("totalValue")}</option>
          </select>
          <button
            className={cx("px-3 py-1.5 rounded-lg border",
              isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-slate-200")}
            onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
            title="Toggle direction"
          >
            {sortDir === "asc" ? t("asc") : t("desc")}
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className={cx("px-3 py-1.5 rounded-lg border",
              isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200")}
            title={t("language")}
          >
            <option value="pt">PT-BR</option>
            <option value="en">EN</option>
          </select>

          <button onClick={openNew} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            {t("newItem")}
          </button>

          <div className="relative group">
            <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white">{t("template")}</button>
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

          <button onClick={exportJSON} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800">{t("exportInventory")}</button>
          <label className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer">
            {t("importInventory")}
            <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
          </label>
          <button
            onClick={bulkDelete}
            disabled={!selectedIds.length}
            className={cx("px-3 py-1.5 rounded-lg text-white hover:opacity-90 disabled:opacity-40", "bg-red-600")}
          >
            {t("deleteSelected")} ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Editor dobrável */}
      {showEditor && (
        <form onSubmit={onSubmit} className="px-3 pb-2">
          <div className={cx("rounded-2xl border p-3 grid gap-3",
            isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200")}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{form.id ? t("editItemTitle") : t("newItemTitle")}</h3>
              <button type="button" onClick={cancelEdit} className={cx("px-2 py-1 rounded-md border text-sm",
                isDark ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800" : "bg-white border-slate-300 hover:bg-slate-50")}>
                {t("close")}
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-sm">
                {t("name")}
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
                {t("category")}
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
                {t("tagsComma")}
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
                {t("qty")}
                <input
                  type="number" min={0}
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.qty}
                  onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm">
                {t("weight")} {`(${t("weight").includes("lb") ? "" : "(lb)"}`}
                <input
                  type="number" min={0} step="0.1"
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.weight}
                  onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm">
                {t("value")}
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
                  {t("equipped")}
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={form.attuned} onChange={() => setForm((f) => ({ ...f, attuned: !f.attuned }))}/>
                  {t("attuned")}
                </label>
              </div>
            </div>

            {form.category === "armor" && (
              <div className={cx("rounded-lg p-3 grid md:grid-cols-4 gap-3",
                isDark ? "border border-zinc-800" : "border border-slate-200")}>
                <label className="text-sm">
                  {t("armorType")}
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
                  {t("ac")}
                  <input
                    type="number" min={0}
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.ac}
                    onChange={(e) => setForm((f) => ({ ...f, ac: Number(e.target.value) }))}
                  />
                </label>
                <label className="text-sm">
                  {t("strReq")}
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
                  {t("stealthDisadv")}
                </label>
              </div>
            )}

            {form.category === "weapon" && (
              <div className={cx("rounded-lg p-3 grid md:grid-cols-4 gap-3",
                isDark ? "border border-zinc-800" : "border border-slate-200")}>
                <label className="text-sm md:col-span-2">
                  {t("damage")}
                  <input
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.damage}
                    onChange={(e) => setForm((f) => ({ ...f, damage: e.target.value }))}
                    placeholder="ex.: 1d8 piercing"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  {t("range")}
                  <input
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.range}
                    onChange={(e) => setForm((f) => ({ ...f, range: e.target.value }))}
                    placeholder="ex.: melee, 80/320"
                  />
                </label>
                
                <div className="md:col-span-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{t("ammoSlots")}</div>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                      onClick={addAmmoSlotToForm}
                    >
                      {t("addSlot")}
                    </button>
                  </div>

                  <div className="mt-2 flex flex-col gap-2">
                    {!(form.ammo && Array.isArray(form.ammo.slots) && form.ammo.slots.length > 0) && (
                      <div className={cx("text-xs px-2 py-2 rounded border",
                        isDark ? "border-zinc-800 text-zinc-400" : "border-slate-200 text-gray-600")}>
                        {t("noAmmoSlots")}
                      </div>
                    )}

                    {form.ammo && Array.isArray(form.ammo.slots) && form.ammo.slots.map((s, i) => (
                      <div key={i} className="grid md:grid-cols-[24px_1fr_120px_120px_1fr_32px] grid-cols-1 gap-2 items-center">
                        <div className="flex items-center justify-center">
                          <input
                            type="radio"
                            checked={(form.ammo?.active ?? 0) === i}
                            onChange={() => setActiveAmmoSlotInForm(i)}
                            title={t("setActive")}
                          />
                        </div>
                        <input
                          className={cx("w-full border rounded-md px-2 py-1.5",
                            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                          value={s.type || ""}
                          onChange={(e) => updateAmmoSlotInForm(i, { type: e.target.value })}
                          placeholder={t("ammoType")}
                        />
                        <input
                          type="number" min={0}
                          className={cx("w-full border rounded-md px-2 py-1.5",
                            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                          value={Number(s.current || 0)}
                          onChange={(e) => updateAmmoSlotInForm(i, { current: Number(e.target.value) })}
                          placeholder={t("current")}
                        />
                        <input
                          type="number" min={0}
                          className={cx("w-full border rounded-md px-2 py-1.5",
                            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                          value={Number(s.max || 0)}
                          onChange={(e) => updateAmmoSlotInForm(i, { max: Number(e.target.value) })}
                          placeholder={t("max")}
                        />
                        <input
                          className={cx("w-full border rounded-md px-2 py-1.5",
                            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                          value={s.note || ""}
                          onChange={(e) => updateAmmoSlotInForm(i, { note: e.target.value })}
                          placeholder={t("notes")}
                        />
                        <button
                          type="button"
                          className={cx("h-9 w-9 rounded-md border",
                            isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-200 hover:bg-slate-50")}
                          onClick={() => removeAmmoSlotFromForm(i)}
                          title={t("remove")}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {form.category === "dice" && (
              <div className={cx("rounded-lg p-3 grid md:grid-cols-3 gap-3",
                isDark ? "border border-zinc-800" : "border border-slate-200")}>
                <label className="text-sm">
                  {t("die")}
                  <input
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.die}
                    onChange={(e) => setForm((f) => ({ ...f, die: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  {t("dieCount")}
                  <input
                    type="number" min={0}
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.dieCount}
                    onChange={(e) => setForm((f) => ({ ...f, dieCount: Number(e.target.value) }))}
                  />
                </label>
                <label className="text-sm">
                  {t("label")}
                  <input
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="ex.: Inspiration, Risk Die"
                  />
                </label>
              </div>
            )}

            {form.category === "keys" && (
              <div className={cx("rounded-lg p-3 grid md:grid-cols-2 gap-3",
                isDark ? "border border-zinc-800" : "border border-slate-200")}>
                <label className="text-sm">
                  {t("keyWhere")}
                  <input
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.keyWhere}
                    onChange={(e) => setForm((f) => ({ ...f, keyWhere: e.target.value }))}
                    placeholder="Ex.: Porta da cripta"
                  />
                </label>
                <label className="text-sm">
                  {t("keyUse")}
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
              {t("notes")}
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
                  {t("clearForm")}
                </button>
              )}
              <button
                type="button"
                onClick={cancelEdit}
                className="px-3 py-1.5 rounded-lg border"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {form.id ? t("saveItem") : t("addItem")}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Totais */}
      <div className="px-3 pb-2">
        <div className={cx("rounded-xl border p-2 text-sm flex gap-4",
          isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200")}>
          <div><span className="opacity-70">{t("items")}:</span> <strong>{totals.totalQty}</strong></div>
          <div><span className="opacity-70">{t("totalWeight")}:</span> <strong>{totals.totalWeight.toFixed(2)} lb</strong></div>
          <div><span className="opacity-70">{t("totalValue")}:</span> <strong>{gpToPretty(totals.totalGp)}</strong></div>
        </div>
      </div>

      {/* Lista */}
      <div className="px-3 pb-6 overflow-auto">
        {/* Cabeçalho */}
        <div className={cx("sticky top-0 z-10 py-2 px-2 text-xs uppercase tracking-wide",
          isDark ? "bg-zinc-950" : "bg-slate-50")}>
          <div className={cx("grid grid-cols-[24px_1fr_120px_110px_120px_150px_140px_120px] gap-2 px-2")}>
            <div></div>
            <div>{t("item")}</div>
            <div>{t("category")}</div>
            <div>{t("qty")}</div>
            <div>{t("weight")}</div>
            <div>{t("total")}</div>
            <div>{t("properties")}</div>
            <div>{t("actions")}</div>
          </div>
        </div>

        {filtered.map((x) => {
          const props = [];
          if (x.category === "armor") {
            props.append?.();
          }
          if (x.category === "armor") {
            props.push(`AC ${x.ac || 0}`);
            if (x.armorType) props.push(getLabel(ARMOR_TYPES, x.armorType));
            if (x.strReq) props.push(`STR ${x.strReq}+`);
            if (x.stealthDisadv) props.push("Stealth Disadv.");
          }
          if (x.category === "weapon") {
            if (x.damage) props.push(x.damage);
            if (x.range) props.push(x.range);
            if (x.ammo && Array.isArray(x.ammo.slots) && x.ammo.slots.length > 0) {
              const parts = x.ammo.slots.map((s, i) => {
                const label = (s.type || t("ammoSlot")) + " " + (Number(s.current || 0)) + "/" + (Number(s.max || 0));
                return i === (x.ammo.active ?? 0) ? (label + " ★") : label;
              });
              props.push(parts.join(" | "));
            } else if (x.ammoMax) {
              // Legacy single-ammo display
              props.push(`${t("ammoCurrent").split(" ")[0]} ${x.ammoCurrent || 0}/${x.ammoMax}`);
            }
          }
          if (x.category === "dice") {
            props.push(`${x.label || "Tokens"}: ${x.dieCount} ${x.die}`);
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
                {x.attuned && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-600 text-white">{t("attuned")}</span>}
                {Array.isArray(x.tags) && x.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {x.tags.slice(0, 3).map((tTag, i) => (
                      <span key={i} className={cx("text-[10px] px-2 py-0.5 rounded-full border",
                        isDark ? "border-zinc-700" : "border-slate-200")}>{tTag}</span>
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
                  {x.equipped ? t("unequip") : t("equip")}
                </button>
                <button
                  className={cx("px-2 py-1 text-xs rounded-md border",
                    isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-200 hover:bg-slate-50")}
                  onClick={() => toggle(x.id, "attuned")}
                  title={t("attune")}
                >
                  {x.attuned ? t("unattune") : t("attune")}
                </button>

                {x.category === "weapon" && (
                  <>
                    {x.ammo && Array.isArray(x.ammo.slots) && x.ammo.slots.length > 0 ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1">
                          {x.ammo.slots.map((s, i) => (
                            <button
                              key={i}
                              className={cx(
                                "px-2 py-0.5 text-xs rounded-md border",
                                i === (x.ammo.active ?? 0)
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-200 hover:bg-slate-50"
                              )}
                              onClick={() => setActiveAmmoSlot(x.id, i)}
                              title={(s.type || t("ammoSlot")) + " " + (s.current || 0) + "/" + (s.max || 0)}
                            >
                              {(s.type || t("ammoSlot"))} {Number(s.current || 0)}/{Number(s.max || 0)}
                            </button>
                          ))}
                        </div>
                        <button
                          className="px-2 py-1 text-xs rounded-md bg-slate-700 text-white hover:bg-slate-800"
                          onClick={() => useAmmoSlot(x.id, -1)}
                          title={t("ammoMinus")}
                        >
                          {t("ammoMinus")}
                        </button>
                        <button
                          className="px-2 py-1 text-xs rounded-md bg-slate-700 text-white hover:bg-slate-800"
                          onClick={() => useAmmoSlot(x.id, +1)}
                          title={t("ammoPlus")}
                        >
                          {t("ammoPlus")}
                        </button>
                        <button
                          className={cx("px-2 py-1 text-xs rounded-md border",
                            isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-200 hover:bg-slate-50")}
                          onClick={() => cycleAmmoSlot(x.id, +1)}
                          title={t("nextAmmo")}
                        >
                          {t("nextAmmo")}
                        </button>
                      </>
                    ) : (
                      x.ammoMax > 0 && (
                        <>
                          <button
                            className="px-2 py-1 text-xs rounded-md bg-slate-700 text-white hover:bg-slate-800"
                            onClick={() => useAmmo(x.id, -1)}
                            title={t("ammoMinus")}
                          >
                            {t("ammoMinus")}
                          </button>
                          <button
                            className="px-2 py-1 text-xs rounded-md bg-slate-700 text-white hover:bg-slate-800"
                            onClick={() => useAmmo(x.id, +1)}
                            title={t("ammoPlus")}
                          >
                            {t("ammoPlus")}
                          </button>
                        </>
                      )
                    )}
                  </>
                )}

                {(x.category === "misc" || x.category === "dice") && (
                  <button
                    className="px-2 py-1 text-xs rounded-md bg-amber-600 text-white hover:bg-amber-700"
                    onClick={() => consumeOne(x.id)}
                    title={t("useOne")}
                  >
                    {t("useOne")}
                  </button>
                )}

                <button
                  className="px-2 py-1 text-xs rounded-md bg-violet-600 text-white hover:bg-violet-700"
                  onClick={() => editItem(x)}
                >
                  {t("edit")}
                </button>
                <button
                  className="px-2 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => duplicateItem(x.id)}
                >
                  {t("duplicate")}
                </button>
                <button
                  className="px-2 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700"
                  onClick={() => deleteItem(x.id)}
                >
                  {t("remove")}
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className={cx("text-sm px-2 py-6 text-center rounded-xl border",
            isDark ? "border-zinc-800 text-zinc-400" : "border-slate-200 text-gray-600")}>
            {t("noResults")}
          </div>
        )}
      </div>
    </div>
  );
}

export default InventoryManager;
