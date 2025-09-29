import React, { useEffect, useMemo, useState, useRef } from "react";
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

function InventoryManager({ isDark, onExportToTree }) {
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
  const [tagDraft, setTagDraft] = useState("");

  const commitDraftToTags = (draft) => {
    const tokens = parseTags(draft ?? tagDraft);
    if (!tokens.length) return;
    setForm(f => {
      const prev = Array.isArray(f.tags) ? f.tags : parseTags(f.tags);
      const merged = Array.from(new Set([...prev, ...tokens]));
      return { ...f, tags: merged };
    });
    setTagDraft("");
  };

  // UI: ammo dropdown per-row
  const [ammoMenuOpenId, setAmmoMenuOpenId] = useState(null);
  const ammoMenuRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (ammoMenuOpenId && ammoMenuRef.current && !ammoMenuRef.current.contains(e.target)) {
        setAmmoMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ammoMenuOpenId]);

  const onDragStartItem = (e, id) => {
    try { e.dataTransfer.setData("text/hability-item", id); } catch {}
  };


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
  const cancelEdit = () => { setForm(emptyForm); setShowEditor(false); };

  
const onSubmit = (e) => {
    e?.preventDefault?.();
    const id = form.id || uid();

    // Normalize ammo for weapons:
    let ammoData = undefined;
    if (form.category === "weapon") {
      if (form?.ammo && Array.isArray(form.ammo.slots) && form.ammo.slots.length) {
        const cleanSlots = form.ammo.slots
          .filter((s) => s && (s.type || s.current || s.max || s.note !== undefined))
          .map((s) => ({
            type: (s.type || "Comum"),
            current: Math.max(0, Number(s.current || 0)),
            max: Math.max(0, Number(s.max || 0)),
            note: s.note || "",
          }));
        const active = Math.min(Math.max(0, Number(form.ammo.active || 0)), Math.max(0, cleanSlots.length - 1));
        if (cleanSlots.length) ammoData = { active, slots: cleanSlots };
      } else if (Number(form.ammoMax || 0) > 0) {
        ammoData = { active: 0, slots: [{ type: "Comum", current: Number(form.ammoCurrent || 0), max: Number(form.ammoMax || 0), note: "" }] };
      }
    }

    const activeSlot = ammoData?.slots?.[ammoData.active] || null;

    const base = {
      ...form,
      id,
      ammo: ammoData,
      ammoCurrent: Number(activeSlot ? activeSlot.current : (form.ammoCurrent || 0)),
      ammoMax: Number(activeSlot ? activeSlot.max : (form.ammoMax || 0)),
      valueGp: currencyToGp(form.valueNum, form.valueUnit),
      tags: Array.isArray(form.tags) ? form.tags : parseTags(form.tags),
      qty: Math.max(0, Number(form.qty || 0)),
      weight: Number(form.weight || 0),
      ac: Number(form.ac || 0),
      strReq: Number(form.strReq || 0),
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
    // Prepare ammo for editor: prefer slots; if legacy fields present, convert to one slot.
    let ammoBlock = it.ammo && Array.isArray(it.ammo.slots)
      ? it.ammo
      : (Number(it.ammoMax || 0) > 0
          ? { active: 0, slots: [{ type: "Comum", current: Number(it.ammoCurrent || 0), max: Number(it.ammoMax || 0), note: "" }] }
          : { active: 0, slots: [] });
    setForm({
      ...emptyForm,
      ...it,
      ammo: ammoBlock,
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


  // --- Ammo helpers (legacy + slots) ---
  const ensureAmmo = (item) => {
    // Returns {active, slots[]} or null. If legacy fields exist, convert on the fly.
    if (item?.ammo && Array.isArray(item.ammo.slots) && item.ammo.slots.length) return item.ammo;
    if (Number(item?.ammoMax || 0) > 0) {
      return {
        active: 0,
        slots: [{ type: "Comum", current: Number(item.ammoCurrent || 0), max: Number(item.ammoMax || 0), note: "" }],
      };
    }
    return null;
  };

  const setAmmo = (id, updater) => {
    setItems((arr) =>
      arr.map((x) => {
        if (x.id !== id) return x;
        const ammo = ensureAmmo(x);
        if (!ammo) return x;
        const nextAmmo = updater({ ...ammo, slots: ammo.slots.map(s => ({...s})) });
        // keep legacy fields in sync with active slot for backward compatibility
        const act = nextAmmo.slots[nextAmmo.active] || { current: 0, max: 0 };
        return { ...x, ammo: nextAmmo, ammoCurrent: act.current, ammoMax: act.max };
      })
    );
  };

  const setActiveAmmoSlot = (id, idx) => {
    setAmmo(id, (ammo) => ({ ...ammo, active: Math.max(0, Math.min(idx, ammo.slots.length - 1)) }));
  };

  const useAmmo = (id, delta) => {
    // consumes on active slot (or legacy)
    setItems((arr) =>
      arr.map((x) => {
        if (x.id !== id) return x;
        const ammo = ensureAmmo(x);
        if (!ammo) {
          // legacy: just clamp fields if exist
          return { ...x, ammoCurrent: Math.max(0, Math.min((x.ammoMax || 0), (x.ammoCurrent || 0) + delta)) };
        }
        const next = { ...ammo, slots: ammo.slots.map((s, i) => i === ammo.active
          ? { ...s, current: Math.max(0, Math.min(s.max || 0, (Number(s.current || 0) + delta))) }
          : s) };
        const act = next.slots[next.active] || { current: 0, max: 0 };
        return { ...x, ammo: next, ammoCurrent: act.current, ammoMax: act.max };
      })
    );
  };

  const changeAmmoAt = (id, idx, delta) => {
    setAmmo(id, (ammo) => {
      const slots = ammo.slots.map((s, i) => i === idx
        ? { ...s, current: Math.max(0, Math.min(s.max || 0, (Number(s.current || 0) + delta))) }
        : s
      );
      return { ...ammo, slots };
    });
  };

  const nextAmmo = (id) => {
    setAmmo(id, (ammo) => ({ ...ammo, active: (ammo.active + 1) % Math.max(1, ammo.slots.length) }));
  };

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

  

  
  const exportToTree = () => {
    // If App provided a callback, use it for live merge without refresh
    if (typeof onExportToTree === "function") {
      const picked = (selectedIds.length ? items.filter(i => selectedIds.includes(i.id)) : items);
      onExportToTree(picked);
      alert(`Enviado para a Árvore: ${picked.length} nó(s).`);
      return;
    }

    try {
      // Load existing tree from storage
      let tree = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEYS[0]);
        if (raw) tree = JSON.parse(raw);
      } catch {}
      let nodes = Array.isArray(tree?.nodes) ? [...tree.nodes] : [];
      let edges = Array.isArray(tree?.edges) ? [...tree.edges] : [];

      // Ensure a root if tree is empty, to keep the app consistent
      if (nodes.length === 0) {
        nodes.push({
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
      }

      // Compute base position to the right of current content
      const maxX = nodes.reduce((m, n) => Math.max(m, Number(n?.position?.x || 0)), 0);
      const xGap = 320, yGap = 180, perCol = 4;
      const baseX = maxX + xGap;
      const baseY = 0;

      // Helper to map items -> nodes
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
      const picked = (selectedIds.length ? items.filter(i => selectedIds.includes(i.id)) : items);
      const newNodes = picked.map((it, i) => ({
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

      if (newNodes.length === 0) {
        alert("Nenhum nó novo para adicionar — itens já existem na árvore.");
        return;
      }

      const merged = { nodes: [...nodes, ...newNodes], edges };
      try {
        localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(merged));
      } catch {}

      alert(`Enviado para a Árvore: ${newNodes.length} nós adicionados.`);
    } catch (e) {
      console.error(e);
      alert("Falha ao exportar para a árvore.");
    }
  };

  const fileToDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });


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
    "grid grid-cols-[24px_1fr_120px_110px_120px_150px_140px_120px] gap-2 items-center py-2 px-2 rounded-lg border relative",
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
        </select>        <div className="flex items-center gap-1">
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
          <button onClick={exportToTree} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">{t("sendToTree")}</button>
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
                {t("tagsComma")}

                <label className="text-sm">
  Tags
                <div
                  className={cx(
                    "mt-1 w-full border rounded-md px-2 py-1.5 flex flex-wrap gap-2 items-center",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                  )}
                >
                  {(Array.isArray(form.tags) ? form.tags : parseTags(form.tags)).map((tg, idx) => (
                    <span
                      key={`${tg}-${idx}`}
                      className={cx(
                        "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full",
                        isDark ? "bg-zinc-800" : "bg-slate-100"
                      )}
                    >
                      {tg}
                      <button
                        type="button"
                        aria-label={`Remover ${tg}`}
                        className="leading-none"
                        onClick={() =>
                          setForm(f => {
                            const arr = Array.isArray(f.tags) ? f.tags : parseTags(f.tags);
                            return { ...f, tags: arr.filter((x, i) => !(i === idx && x === tg)) };
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <input
                    className={cx(
                      "flex-1 min-w-[8ch] outline-none",
                      isDark ? "bg-zinc-900 text-zinc-100" : "bg-white text-slate-900"
                    )}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      const k = e.key;
                      const isSep = k === "," || k === ";" || k === " " || k === "Enter" || k === "Tab";
                      if (isSep) {
                        e.preventDefault();         // não escreve o caractere; vira “confirmação”
                        commitDraftToTags();
                      } else if (k === "Backspace" && tagDraft === "") {
                        // Apaga a última tag quando o draft está vazio (UX padrão de tag inputs)
                        setForm(f => {
                          const arr = Array.isArray(f.tags) ? f.tags : parseTags(f.tags);
                          if (!arr.length) return f;
                          return { ...f, tags: arr.slice(0, -1) };
                        });
                      }
                    }}
                    onBlur={() => commitDraftToTags()}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (/[,\s;]/.test(text)) {
                        e.preventDefault();
                        commitDraftToTags(text);
                      }
                    }}
                    placeholder="Digite e use , ; ou espaço"
                  />
                </div>
              </label>
              </label>

              <label className="text-sm">
                
                <label className="text-sm">
                  Imagem (URL ou data URI)
                  <input
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.imageUrl || ""}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://... ou data:image/png;base64,..."
                  />
                </label>
                
                <label className="text-sm"><p>Adicionar Imagem do Item</p></label>
                  <div className="flex gap-2 items-center">
                    <input
                      className="mt-1 w-full border rounded-md px-2 py-1.5"
                      value={form.imageUrl || ""}
                      onChange={(e) => setForm(f => ({ ...f, imageUrl: e.target.value }))} 
                      placeholder="https://... ou data:image/png;base64,..."
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const dataUrl = await fileToDataURL(f);   // gera o data URI
                        setForm(prev => ({ ...prev, imageUrl: dataUrl }));
                      }}
                      title="Enviar arquivo e gerar data URI"
                    />
                  </div>

                
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
  <>
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
          placeholder="ex.: 150/600 ft"
        />
      </label>
      <label className="text-sm">
        {t("ammoCurrent")}
        <input
          type="number" min={0}
          className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
          value={form.ammoCurrent}
          onChange={(e) => setForm((f) => ({ ...f, ammoCurrent: Number(e.target.value) }))}
        />
      </label>
      <label className="text-sm">
        {t("ammoMax")}
        <input
          type="number" min={0}
          className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
          value={form.ammoMax}
          onChange={(e) => setForm((f) => ({ ...f, ammoMax: Number(e.target.value) }))}
        />
      </label>
    </div>

    {/* Ammo Slots Editor */}
    <div className={cx("rounded-lg p-3 grid gap-3",
      isDark ? "border border-zinc-800" : "border border-slate-200")}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{t("ammoSlots")}</div>
        <button
          type="button"
          className={cx("px-2 py-1 text-xs rounded-md border",
            isDark ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800" : "bg-white border-slate-300 hover:bg-slate-50")}
          onClick={() => setForm((f) => {
            const next = { ...(f.ammo || { active: 0, slots: [] }) };
            next.slots = [...(next.slots || []), { type: "Comum", current: 0, max: 0, note: "" }];
            if (typeof next.active !== "number") next.active = 0;
            return { ...f, ammo: next };
          })}
        >
          {t("addSlot")}
        </button>
      </div>

      {Array.isArray(form?.ammo?.slots) && form.ammo.slots.length > 0 ? (
        <div className="grid gap-2">
          {form.ammo.slots.map((s, i) => (
            <div key={i} className="grid md:grid-cols-12 gap-2 items-end">
              <label className="text-[12px] md:col-span-1 flex items-center gap-2">
                <input
                  type="radio"
                  name="activeAmmoEditor"
                  checked={Number(form?.ammo?.active || 0) === i}
                  onChange={() => setForm((f) => ({ ...f, ammo: { ...(f.ammo || { active: 0, slots: [] }), active: i } }))}
                />
                <span className="opacity-70">{t("active")}</span>
              </label>
              <label className="text-sm md:col-span-3">
                {t("type")}
                <input
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={s.type || ""}
                  onChange={(e) => setForm((f) => {
                    const next = { ...(f.ammo || { active: 0, slots: [] }) };
                    next.slots = next.slots.map((ss, idx) => idx === i ? { ...ss, type: e.target.value } : ss);
                    return { ...f, ammo: next };
                  })}
                />
              </label>
              <label className="text-sm md:col-span-2">
                {t("current")}
                <input
                  type="number" min={0}
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={Number(s.current || 0)}
                  onChange={(e) => setForm((f) => {
                    const next = { ...(f.ammo || { active: 0, slots: [] }) };
                    next.slots = next.slots.map((ss, idx) => idx === i ? { ...ss, current: Math.max(0, Number(e.target.value || 0)) } : ss);
                    return { ...f, ammo: next };
                  })}
                />
              </label>
              <label className="text-sm md:col-span-2">
                {t("max")}
                <input
                  type="number" min={0}
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={Number(s.max || 0)}
                  onChange={(e) => setForm((f) => {
                    const next = { ...(f.ammo || { active: 0, slots: [] }) };
                    next.slots = next.slots.map((ss, idx) => idx === i ? { ...ss, max: Math.max(0, Number(e.target.value || 0)) } : ss);
                    return { ...f, ammo: next };
                  })}
                />
              </label>
              <div className="md:col-span-4 text-sm">
  <label className="text-sm">{t("slotNote")}</label>
  <div className="mt-1 flex items-center gap-2">
    <input
      className={cx("flex-1 border rounded-md px-2 py-1.5",
        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
      value={s.note || ""}
      onChange={(e) => setForm((f) => {
        const next = { ...(f.ammo || { active: 0, slots: [] }) };
        next.slots = next.slots.map((ss, idx) => idx === i ? { ...ss, note: e.target.value } : ss);
        return { ...f, ammo: next };
      })}
    />
    <button
      type="button"
      className={cx("shrink-0 px-3 py-1.5 text-xs rounded-md border",
        isDark ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-red-400 hover:text-red-300" : "bg-white border-slate-300 hover:bg-slate-50 text-red-600")}
      onClick={() => setForm((f) => {
        const next = { ...(f.ammo || { active: 0, slots: [] }) };
        const before = next.slots || [];
        const newSlots = before.filter((_, idx) => idx !== i);
        const newActive = Math.min(Math.max(0, (next.active || 0) - (i <= (next.active || 0) ? 1 : 0)), Math.max(0, newSlots.length - 1));
        return { ...f, ammo: { active: newActive, slots: newSlots } };
      })}
      title={t("remove")}
    >
      {t("remove")}
    </button>
  </div>
</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs opacity-70">{t("noSlotsYet")}</div>
      )}
    </div>
  </>
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
            const ammoData = ensureAmmo(x);
            if (ammoData) {
              const s = ammoData.slots[ammoData.active] || {};
              const extra = Math.max(0, ammoData.slots.length - 1);
              props.push(`${(s.type || "Comum")} ${Number(s.current || 0)}/${Number(s.max || 0)}${extra ? " • +" + extra : ""}`);
            } else if (x.ammoMax) {
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

              <div
                className="flex items-center gap-2"
                draggable
                onDragStart={(e) => onDragStartItem(e, x.id)}
                title="Arraste para equipar"
              >
                {x.imageUrl ? (
                  <img src={x.imageUrl} alt="" className="w-6 h-6 object-cover rounded" />
                ) : null}
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

                {x.category === "weapon" && ensureAmmo(x) && (
                  <>
                    <button
                      className="px-2 py-1 text-xs rounded-md border bg-white/5"
                      onClick={() => setAmmoMenuOpenId(ammoMenuOpenId === x.id ? null : x.id)}
                      title="Munições"
                    >
                      {(ensureAmmo(x).slots[ensureAmmo(x).active]?.type || "Comum")} {ensureAmmo(x).slots[ensureAmmo(x).active]?.current || 0}/{ensureAmmo(x).slots[ensureAmmo(x).active]?.max || 0} ▾
                    </button>

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
                    {ensureAmmo(x).slots.length > 1 && (
                      <button
                        className="px-2 py-1 text-xs rounded-md border"
                        onClick={() => nextAmmo(x.id)}
                        title="Próxima munição"
                      >
                        Próx. munição
                      </button>
                    )}

                    {ammoMenuOpenId === x.id && (
                      <div ref={ammoMenuRef} className={cx("absolute z-20 mt-1 right-4 w-72 max-h-64 overflow-auto rounded-xl border shadow",
                        isDark ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-slate-200 bg-white text-gray-800")}>
                        <div className="p-2 text-xs opacity-70">Munições</div>
                        <div className="divide-y divide-black/5">
                          {ensureAmmo(x).slots.map((s, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 p-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`ammo-${x.id}`}
                                  checked={ensureAmmo(x).active === i}
                                  onChange={() => setActiveAmmoSlot(x.id, i)}
                                />
                                <span className="text-sm">{s.type || "Comum"}</span>
                              </label>
                              <div className="text-xs opacity-75">{Number(s.current || 0)}/{Number(s.max || 0)}</div>
                              <div className="flex items-center gap-1">
                                <button
                                  className="px-2 py-0.5 text-xs rounded-md border"
                                  onClick={() => changeAmmoAt(x.id, i, -1)}
                                  title="-1"
                                >-1</button>
                                <button
                                  className="px-2 py-0.5 text-xs rounded-md border"
                                  onClick={() => changeAmmoAt(x.id, i, +1)}
                                  title="+1"
                                >+1</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
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