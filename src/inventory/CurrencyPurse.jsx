// src/inventory/CurrencyPurse.jsx
import React, { useEffect, useMemo, useState } from "react";
import { WALLET_KEY } from "../constants/storage";
import { cx } from "../utils/misc";
import { t } from "../utils/i18n";

export default function CurrencyPurse({ isDark, compact = false, className = "" }) {
  const [wallet, setWallet] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(WALLET_KEY)) || { pp: 0, gp: 0, sp: 0, cp: 0 };
    } catch {
      return { pp: 0, gp: 0, sp: 0, cp: 0 };
    }
  });

  useEffect(() => {
    try { localStorage.setItem(WALLET_KEY, JSON.stringify(wallet)); } catch {}
  }, [wallet]);

  const totalGp = useMemo(() =>
    Number(wallet.pp || 0) * 10 +
    Number(wallet.gp || 0) +
    Number(wallet.sp || 0) / 10 +
    Number(wallet.cp || 0) / 100
  , [wallet]);

  const box = cx(
    "rounded-xl border p-2",
    isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-gray-800",
    className
  );
  const inputCls = cx(
    "w-24 px-2 py-1.5 border rounded-md",
    isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-slate-300"
  );

  const Row = ({ id, label, suffix }) => (
    <label className="flex items-center gap-2">
      <span className="w-16 text-xs opacity-70">{label}</span>
      <input
        type="number" min="0" step="1" inputMode="numeric"
        className={inputCls}
        value={wallet[id] ?? 0}
        onChange={(e) => setWallet((w) => ({ ...w, [id]: Math.max(0, Number(e.target.value || 0)) }))}
      />
      <span className="text-xs opacity-60">{suffix}</span>
    </label>
  );

  return (
    <div className={box} role="group" aria-label={t("coins") || "Moedas"}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">{t("coins") || "Moedas"}</div>
        <div className="text-xs opacity-70">
          {(t("totalValue") || "Valor total")}: <strong>{totalGp.toFixed(2)} gp</strong>
        </div>
      </div>

      <div className={cx("grid gap-2", compact ? "grid-cols-2" : "grid-cols-4")}>
        <Row id="pp" label={t("platinum") || "Platina"} suffix="pp" />
        <Row id="gp" label={t("gold") || "Ouro"} suffix="gp" />
        <Row id="sp" label={t("silver") || "Prata"} suffix="sp" />
        <Row id="cp" label={t("copper") || "Cobre"} suffix="cp" />
      </div>
    </div>
  );
}
