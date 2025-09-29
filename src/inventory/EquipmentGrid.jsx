// src/inventory/EquipmentGrid.jsx
import React from "react";
import { cx, getLabel } from "../utils/misc";
import { ITEM_CATEGORIES, ARMOR_TYPES } from "../constants/dnd";

/** Pequenos ícones SVG como placeholders */
function Icon({ kind = "misc", className = "" }) {
  const base = "w-12 h-12 opacity-50";
  const cls = cx(base, className);
  switch (kind) {
    case "weapon":
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path d="M3 21l6-6M7 17l10-10 3 3-10 10H7z" stroke="currentColor" fill="none" strokeWidth="2" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path d="M12 3l8 3v6c0 4.97-3.58 9.14-8 10-4.42-.86-8-5.03-8-10V6l8-3z" fill="currentColor" />
        </svg>
      );
    case "armor":
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path d="M8 4l4-2 4 2v4l3 4v8H5v-8l3-4V4z" fill="currentColor" />
        </svg>
      );
    case "ring":
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <circle cx="12" cy="14" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M9 5l3-3 3 3" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      );
    case "amulet":
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path d="M12 3v5M8 8l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="12" cy="16" r="4" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
        </svg>
      );
  }
}

/** Regras simples de compatibilidade item → slot */
function canDropInSlot(item, slotId) {
  if (!item) return false;
  const tagMatch = (rx) => Array.isArray(item.tags) && item.tags.some(t => rx.test(String(t)));
  const is = (cat) => (item.category || "") === cat;

  switch (slotId) {
    case "weaponMain":    return tagMatch(/weapon|arma/i);//is("weapon");
    case "offhand":       return tagMatch(/shield|escudo|arma/i);//is("weapon") || (is("armor") && item.armorType === "shield");
    case "armorChest":    return tagMatch(/armadura|armor|roupa/i);//is("armor") && item.armorType !== "shield";
    case "helmet":        return tagMatch(/helm|helmet|capacete|chapéu|chapeu/i);
    case "gloves":        return tagMatch(/glove|gauntlet|luva|manopla|braçadeira/i);
    case "boots":         return tagMatch(/boot|bota|sapato/i);
    case "belt":          return tagMatch(/belt|cinto/i);
    case "amulet":        return tagMatch(/amulet|amuleto/i) || (is("misc") && tagMatch(/amulet|amuleto/i));
    case "ring1":
    case "ring2":         return tagMatch(/ring|anel|aliança/i) || (is("misc") && tagMatch(/ring|anel/i));
    default:              return false;
  }
}

/** Ícone padrão por slot */
function placeholderFor(slotId) {
  switch (slotId) {
    case "weaponMain": return "weapon";
    case "offhand":    return "shield";
    case "armorChest": return "armor";
    case "ring1":
    case "ring2":      return "ring";
    case "amulet":     return "amulet";
    default:           return "misc";
  }
}

/** Ícone padrão por item */
function placeholderForItem(it) {
  if (!it) return "misc";
  if (it.category === "weapon") return "weapon";
  if (it.category === "armor")  return it.armorType === "shield" ? "shield" : "armor";
  // tags ajudam a distinguir anel/amuleta em 'misc'
  const has = (rx) => Array.isArray(it.tags) && it.tags.some(t => rx.test(String(t)));
  if (has(/ring|anel/i)) return "ring";
  if (has(/amulet|amuleto/i)) return "amulet";
  return "misc";
}

/** Mapeia slot → item equipado */
function useOccupants(items) {
  const map = {};
  (items || []).forEach(it => {
    if (it.slot) map[it.slot] = it;
  });
  return map;
}

/** Pretty para GP (espelho do InventoryManager) */
const gpToPretty = (gp) => {
  if (gp >= 1) return `${(+gp).toFixed(2)} gp`;
  if (gp >= 0.1) return `${(gp * 10).toFixed(0)} sp`;
  return `${(gp * 100).toFixed(0)} cp`;
};

/** Ammo helper (compatível com legacy) */
function ensureAmmo(item) {
  if (item?.ammo && Array.isArray(item.ammo.slots) && item.ammo.slots.length) return item.ammo;
  if (Number(item?.ammoMax || 0) > 0) {
    return { active: 0, slots: [{ type: "Comum", current: Number(item.ammoCurrent || 0), max: Number(item.ammoMax || 0), note: "" }] };
  }
  return null;
}

/** Texto resumido do item p/ tooltip */
function summarize(it) {
  const props = [];
  if (it.category === "armor") {
    props.push(`AC ${it.ac || 0}`);
    if (it.armorType) props.push(getLabel(ARMOR_TYPES, it.armorType));
    if (it.strReq) props.push(`STR ${it.strReq}+`);
    if (it.stealthDisadv) props.push("Stealth Disadv.");
  }
  if (it.category === "weapon") {
    if (it.damage) props.push(it.damage);
    if (it.range) props.push(it.range);
    const ammo = ensureAmmo(it);
    if (ammo) {
      const s = ammo.slots[ammo.active] || {};
      const extra = Math.max(0, ammo.slots.length - 1);
      props.push(`${(s.type || "Comum")} ${Number(s.current || 0)}/${Number(s.max || 0)}${extra ? " • +" + extra : ""}`);
    } else if (it.ammoMax) {
      props.push(`Ammo ${it.ammoCurrent || 0}/${it.ammoMax}`);
    }
  }
  if (it.category === "dice") {
    props.push(`${it.label || "Tokens"}: ${it.dieCount} ${it.die}`);
  }
  if (it.category === "keys") {
    if (it.keyWhere) props.push(`Local: ${it.keyWhere}`);
    if (it.keyUse) props.push(`Uso: ${it.keyUse}`);
  }
  if (it.notes) props.push(String(it.notes));
  return props.join(" • ");
}

/** Grid de equipamento estilo “Diablo” + mochila de não-equipados com tooltip */
export default function EquipmentGrid({ items, setItems, isDark }) {
  const occ = useOccupants(items);

  const slots = [
    // linha 1
    { id: "helmet",     label: "Cabeça" },
    { id: "amulet",     label: "Amuleto" },
    { id: "ring1",      label: "Anel 1" },
    { id: "ring2",      label: "Anel 2" },
    // linha 2
    { id: "weaponMain", label: "Arma" },
    { id: "armorChest", label: "Peitoral" },
    { id: "offhand",    label: "Mão Sec." },
    { id: "belt",       label: "Cinto" },
    // linha 3
    { id: "gloves",     label: "Luvas" },
    { id: "boots",      label: "Botas" },
  ];

  const wrap = cx(
    "rounded-2xl border p-3 mb-3",
    isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
  );

  const slotBox = cx(
    "relative w-24 h-24 rounded-lg border grid place-items-center select-none",
    isDark ? "border-zinc-700 bg-zinc-900" : "border-slate-300 bg-white"
  );

  const invBox = cx(
    "relative w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-lg border grid place-items-center select-none",
    isDark ? "border-zinc-700 bg-zinc-900" : "border-slate-300 bg-white"
  );

  const dropOver = (e) => e.preventDefault();

  const unequipSlot = (slotId) => {
    setItems(arr => arr.map(x => x.slot === slotId ? { ...x, slot: null, equipped: false } : x));
  };

  const onDropSlot = (e, slotId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/hability-item");
    if (!id) return;

    setItems(arr => {
      const item = arr.find(x => x.id === id);
      if (!item) return arr;

      if (!canDropInSlot(item, slotId)) {
        alert("Esse item não pode ser equipado nesse slot.");
        return arr;
      }

      // Libera quem estiver no slot de destino
      let next = arr.map(x => (x.slot === slotId ? { ...x, slot: null, equipped: false } : x));
      // Tira o item do slot anterior e equipa no novo
      next = next.map(x => (x.id === id ? { ...x, slot: slotId, equipped: true } : x));
      return next;
    });
  };

  /** Permite arrastar o item já equipado (para trocar de slot rapidamente) */
  const dragFromSlot = (e, it) => {
    e.dataTransfer.setData("text/hability-item", it.id);
  };
  /** Arrastar da mochila */
  const dragFromBackpack = (e, it) => {
    e.dataTransfer.setData("text/hability-item", it.id);
  };

  const backpack = (items || []).filter(it => !it.slot);

  return (
    <div className={wrap} style={{ overflow: "visible" }}>
      <div className="mb-2 font-semibold">Equipamentos</div>

      {/* Slots equipáveis */}
      <div className="grid gap-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4">
        {slots.map(s => {
          const it = occ[s.id];
          const hasImg = it?.imageUrl;
          return (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <div
                className={slotBox}
                onDragOver={dropOver}
                onDrop={(e) => onDropSlot(e, s.id)}
                title={s.label}
              >
                {it ? (
                  <>
                    <img
                      src={hasImg ? it.imageUrl : undefined}
                      alt={it.name}
                      draggable
                      onDragStart={(e) => dragFromSlot(e, it)}
                      className={cx("max-w-[84px] max-h-[84px] object-contain", hasImg ? "" : "hidden")}
                    />
                    {!hasImg && <Icon kind={placeholderFor(s.id)} />}
                    <button
                      type="button"
                      onClick={() => unequipSlot(s.id)}
                      title="Desequipar"
                      className={cx(
                        "absolute -top-2 -right-2 w-6 h-6 rounded-full grid place-items-center text-xs",
                        isDark ? "bg-zinc-800 border border-zinc-700 hover:bg-zinc-700" : "bg-white border border-slate-300 hover:bg-slate-100"
                      )}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <Icon kind={placeholderFor(s.id)} />
                )}
              </div>
              <div className={cx("text-xs", isDark ? "text-zinc-400" : "text-gray-600")}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Grid de não-equipados (mochila) */}
      <div className="mt-4">
        <div className="mb-2 font-semibold">Mochila (não equipados)</div>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2" style={{ overflow: "visible" }}>
          {backpack.length === 0 && (
            <div className={cx("col-span-full text-xs text-center py-6 rounded-md border",
              isDark ? "border-zinc-800 text-zinc-400" : "border-slate-200 text-gray-600")}>
              Sem itens soltos. Adicione itens na lista abaixo e arraste para equipar.
            </div>
          )}

          {backpack.map(it => {
            const hasImg = !!it.imageUrl;
            const totalWeight = (Number(it.weight || 0) * Number(it.qty || 0)).toFixed(2);
            const totalValue = gpToPretty(Number(it.valueGp || 0) * Number(it.qty || 0));
            const cat = getLabel(ITEM_CATEGORIES, it.category);

            return (
              <div key={it.id} className="relative group" style={{ overflow: "visible" }}>
                <div
                  className={invBox}
                  draggable
                  onDragStart={(e) => dragFromBackpack(e, it)}
                  title="Arraste para um slot compatível"
                >
                  {hasImg ? (
                    <img src={it.imageUrl} alt={it.name} className="max-w-[70%] max-h-[70%] object-contain" />
                  ) : (
                    <Icon kind={placeholderForItem(it)} />
                  )}
                  {/* badge de quantidade */}
                  {Number(it.qty || 0) > 1 && (
                    <div className={cx(
                      "absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded-md border",
                      isDark ? "bg-zinc-800/90 border-zinc-700 text-zinc-100" : "bg-white/90 border-slate-300 text-gray-800"
                    )}>
                      ×{it.qty}
                    </div>
                  )}
                </div>

                {/* Tooltip (balão) */}
                <div
                  className={cx(
                    "hidden group-hover:block absolute z-20 w-64 p-2 rounded-lg border shadow-lg",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200 text-gray-800"
                  )}
                  style={{ top: -8, left: "50%", transform: "translate(-50%, -100%)" }}
                >
                  <div className="text-sm font-semibold truncate">{it.name}</div>
                  <div className={cx("text-[11px] opacity-70")}>
                    {cat} • {it.qty}x • {totalWeight} lb • {totalValue}
                  </div>
                  <div className={cx("text-xs mt-1", isDark ? "text-zinc-300" : "text-gray-700")}>
                    {summarize(it) || "Sem propriedades adicionais."}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={cx("text-xs mt-3", isDark ? "text-zinc-400" : "text-gray-600")}>
          Dica: você pode arrastar da mochila para os slots acima. Adicione <strong>tags</strong>
          {" "}aos itens (ex.: <code>anel</code>, <code>amulet</code>, <code>capacete</code>, <code>luva</code>, <code>bota</code>, <code>cinto</code>)
          para liberar mais tipos de slot.
        </div>
      </div>
    </div>
  );
}
