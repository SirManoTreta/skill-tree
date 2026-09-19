import React, { useEffect, useMemo, useState, useRef } from "react";
import { useCharacter } from "../character/context";
import { normalizeItems, readImportFile, validateImageUrl } from "../character/schema";
import { canDropInSlot, equipItem, EQUIPMENT_SLOTS } from "./equipment";
import ItemEditor from "./ItemEditor";
import { ITEM_CATEGORIES, ARMOR_TYPES } from "../constants/dnd";
import { cx, uid, parseTags, getLabel, download } from "../utils/misc";
import { t, getLang, setLang } from "../utils/i18n";
import CurrencyPurse from "./CurrencyPurse";


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
  const { profile: { items }, setItems } = useCharacter();
  const [message, setMessage] = useState("");

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
    try { e.dataTransfer.setData("text/hability-item", id); } catch { /* Drag transfer is unavailable in some browsers. */ }
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



  const openNew = () => { setForm(emptyForm); setTagDraft(""); setMessage(""); setShowEditor(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cancelEdit = () => { setForm(emptyForm); setShowEditor(false); };


  const onSubmit = (e) => {
    e?.preventDefault?.();
    try { validateImageUrl(form.imageUrl || ""); } catch (error) { setMessage(error.message); return; }
    const id = form.id || uid();

    // Normalize ammo for weapons:
    let ammoData = undefined;
    if (form.category === "weapon") {
      if (form?.ammo && Array.isArray(form.ammo.slots) && form.ammo.slots.length) {
        const cleanSlots = form.ammo.slots
          .filter((s) => s && (s.type || s.current || s.max || s.note !== undefined))
          .map((s) => ({
            type: (s.type || "Comum"),
            current: Math.min(Math.max(0, Number(s.max || 0)), Math.max(0, Number(s.current || 0))),
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
      tags: Array.from(new Set([...(Array.isArray(form.tags) ? form.tags : parseTags(form.tags)), ...parseTags(tagDraft)])),
      qty: Math.max(0, Number(form.qty || 0)),
      weight: Number(form.weight || 0),
      ac: Number(form.ac || 0),
      strReq: Number(form.strReq || 0),
      dieCount: Number(form.dieCount || 0),
    };

    setItems((arr) => {
      const exists = arr.some((x) => x.id === id);
      const slot = base.equipped ? (canDropInSlot(base, base.slot) ? base.slot : EQUIPMENT_SLOTS.find(slotId => canDropInSlot(base, slotId))) : null;
      const nextItem = { ...base, slot: null, equipped: false };
      const next = exists ? arr.map(x => x.id === id ? nextItem : x) : [nextItem, ...arr];
      return slot ? equipItem(next, id, slot) : next;
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
    setTagDraft("");
    setShowEditor(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  const duplicateItem = (id) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const copy = { ...it, id: uid(), name: it.name + " (copy)", slot: null, equipped: false };
    setItems((arr) => [copy, ...arr]);
  };

  const deleteItem = (id) => setItems((arr) => arr.filter((x) => x.id !== id));
  const bulkDelete = () => setItems((arr) => arr.filter((x) => !selectedIds.includes(x.id)));

  const toggle = (id, key) => {
    if (key !== 'equipped') { setItems(arr => arr.map(item => item.id === id ? { ...item, [key]: !item[key] } : item)); return; }
    const item = items.find(entry => entry.id === id);
    const compatible = EQUIPMENT_SLOTS.filter(slot => canDropInSlot(item, slot));
    const slot = item?.equipped ? null : compatible.find(slot => !items.some(entry => entry.slot === slot)) || compatible[0];
    if (!item?.equipped && !slot) { setMessage(t('noEquipmentSlot')); return; }
    setItems(arr => equipItem(arr, id, slot));
  };

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
        const nextAmmo = updater({ ...ammo, slots: ammo.slots.map(s => ({ ...s })) });
        // keep legacy fields in sync with active slot for backward compatibility
        const act = nextAmmo.slots[nextAmmo.active] || { current: 0, max: 0 };
        return { ...x, ammo: nextAmmo, ammoCurrent: act.current, ammoMax: act.max };
      })
    );
  };

  const setActiveAmmoSlot = (id, idx) => {
    setAmmo(id, (ammo) => ({ ...ammo, active: Math.max(0, Math.min(idx, ammo.slots.length - 1)) }));
  };

  const adjustAmmo = (id, delta) => {
    // consumes on active slot (or legacy)
    setItems((arr) =>
      arr.map((x) => {
        if (x.id !== id) return x;
        const ammo = ensureAmmo(x);
        if (!ammo) {
          // legacy: just clamp fields if exist
          return { ...x, ammoCurrent: Math.max(0, Math.min((x.ammoMax || 0), (x.ammoCurrent || 0) + delta)) };
        }
        const next = {
          ...ammo, slots: ammo.slots.map((s, i) => i === ammo.active
            ? { ...s, current: Math.max(0, Math.min(s.max || 0, (Number(s.current || 0) + delta))) }
            : s)
        };
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

  const importJSON = async (file) => {
    try {
      const parsed = await readImportFile(file);
      if (!Array.isArray(parsed.items)) throw new Error('Expected { items: [...] }');
      setItems(normalizeItems(parsed.items));
      setMessage(t('importSuccess'));
    } catch (error) { setMessage(t('importFailed') + ' ' + error.message); }
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
    "grid grid-cols-[24px_1fr_120px_110px_120px_150px_140px_120px] gap-2 items-center py-2 px-2 rounded-lg border relative",
    isDark ? "border-zinc-800 hover:bg-zinc-900" : "border-slate-200 hover:bg-slate-50"
  );

  const lang = getLang();

  return (
    <div className="w-full h-full overflow-auto">
      {message && <p role="status" className="mx-3 my-2 text-sm">{message}</p>}
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
          {ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t("categoryLabels." + c.value)}</option>)}
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
              "absolute mt-1 hidden group-hover:block group-focus-within:block min-w-[240px] border rounded-lg p-2 text-sm z-10",
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
            <input type="file" accept="application/json" aria-label={t("importInventory")} className="sr-only" onChange={(e) => { const file=e.target.files?.[0]; e.target.value=""; if(file) importJSON(file); }} />
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
        <ItemEditor isDark={isDark} form={form} setForm={setForm} onSubmit={onSubmit} cancelEdit={cancelEdit} emptyForm={emptyForm} tagDraft={tagDraft} setTagDraft={setTagDraft} commitDraftToTags={commitDraftToTags} setMessage={setMessage} />
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

      {/* Moedas */}
      <div className="px-3 pb-4">
        <CurrencyPurse isDark={isDark} />
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
                      onClick={() => adjustAmmo(x.id, -1)}
                      title={t("ammoMinus")}
                    >
                      {t("ammoMinus")}
                    </button>
                    <button
                      className="px-2 py-1 text-xs rounded-md bg-slate-700 text-white hover:bg-slate-800"
                      onClick={() => adjustAmmo(x.id, +1)}
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