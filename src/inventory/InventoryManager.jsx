import React, { useEffect, useMemo, useState } from "react";
import { INVENTORY_KEY } from "../constants/storage";
import { cx, download } from "../utils/misc";
import { t } from "../utils/i18n";

export default function InventoryManager({ isDark }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(INVENTORY_KEY) || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(INVENTORY_KEY, JSON.stringify(items)); } catch {}
    }, 200);
    return () => clearTimeout(id);
  }, [items]);

  // Exportar Tudo a partir do Inventário (dump de todo o localStorage + tentativas por chaves)
  const exportAllJSON = async () => {
    const bundle = { meta: { exportedAt: new Date().toISOString() }, __allLocalStorage: {} };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        try { bundle.__allLocalStorage[k] = JSON.parse(localStorage.getItem(k)); }
        catch { bundle.__allLocalStorage[k] = localStorage.getItem(k); }
      }
    } catch {}
    await download(
      `hability-all-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`,
      JSON.stringify(bundle, null, 2),
      "application/json"
    );
  };

  return (
    <div className="w-full h-full overflow-auto p-2 sm:p-3">
      {/* Ações rápidas */}
      <div className="mb-2 flex flex-wrap gap-2 justify-end">
        <button
          onClick={exportAllJSON}
          className="px-3 py-1.5 rounded-lg border"
        >
          {t("exportAll") || "Exportar Tudo"}
        </button>
      </div>

      {/* ... o resto do seu gerenciador de inventário aqui ... */}
      <div className={cx(
        "rounded-2xl border p-3",
        isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
      )}>
        <div className="text-sm opacity-70">Coloque aqui seu conteúdo de inventário existente.</div>
      </div>
    </div>
  );
}
