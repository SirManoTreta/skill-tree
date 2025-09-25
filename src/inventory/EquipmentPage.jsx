// src/inventory/EquipmentPage.jsx
import React, { useEffect, useState } from "react";
import EquipmentGrid from "./EquipmentGrid";
import { INVENTORY_KEY } from "../constants/storage";
import { cx } from "../utils/misc";
import { t, getLang, setLang } from "../utils/i18n";

export default function EquipmentPage({ isDark }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(INVENTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { localStorage.setItem(INVENTORY_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  return (
    <div className="w-full h-full overflow-auto p-3">
      <div className="mb-2 flex items-center justify-end">
        <select
          value={getLang()}
          onChange={(e) => setLang(e.target.value)}
          className={cx("px-3 py-1.5 rounded-lg border",
            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200")}
          title={t("language")}
        >
          <option value="pt">PT-BR</option>
          <option value="en">EN</option>
        </select>
      </div>

      <EquipmentGrid items={items} setItems={setItems} isDark={isDark} />
    </div>
  );
}
