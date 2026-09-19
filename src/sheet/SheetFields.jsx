import React from 'react';
import { cx } from '../utils/misc';
import { t } from '../utils/i18n';
import { getSystem, emptyOrigin } from './systems';
import { useCharacter } from '../character/context';
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const fmt = n => n >= 0 ? '+' + n : String(n);

/** Painel de Origens (Espécie/Antecedente/Classe) */
export function OriginsPanel({ isDark, sheet, setOriginName, setOriginAbl, setOriginSkill, skillLabels }) {
  const box = isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200";
  return (
    <div className={cx("rounded-2xl border p-2 md:p-3", box)}>
      <div className="mb-2 font-semibold">{t("originsTitle")}</div>

      <OriginCard
        isDark={isDark}
        label={t("species")}
        skillLabels={skillLabels}
        origin={sheet.origins?.species || emptyOrigin(sheet.systemId)}
        setName={(v) => setOriginName("species", v)}
        setAbl={(abl, v) => setOriginAbl("species", abl, v)}
        setSkill={(id, n) => setOriginSkill("species", id, n)}
      />

      <div className="my-2 h-px bg-black/10 dark:bg-white/10" />

      <OriginCard
        isDark={isDark}
        label={t("backgroundTitle")}
        skillLabels={skillLabels}
        origin={sheet.origins?.background || emptyOrigin(sheet.systemId)}
        setName={(v) => setOriginName("background", v)}
        setAbl={(abl, v) => setOriginAbl("background", abl, v)}
        setSkill={(id, n) => setOriginSkill("background", id, n)}
      />

      <div className="my-2 h-px bg-black/10 dark:bg-white/10" />

      <OriginCard
        isDark={isDark}
        label={t(sheet.systemId === "onePiece" ? "combatStyle" : "classTitle")}
        skillLabels={skillLabels}
        origin={sheet.origins?.class || emptyOrigin(sheet.systemId)}
        setName={(v) => setOriginName("class", v)}
        setAbl={(abl, v) => setOriginAbl("class", abl, v)}
        setSkill={(id, n) => setOriginSkill("class", id, n)}
      />
    </div>
  );
}

/** Medalhão de atributo: círculo grande (valor total) + círculo pequeno (mod) + botões +/− (ajustam base) */
export function AbilityStat({ isDark, labelFull, labelShort, value, modValue, onChange }) {
  const box = isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200";
  const ring = isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300";

  const bump = (delta) => onChange(Number(value || 0) + delta);

  const roundBtn = (extra) =>
    cx(
      "absolute top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 grid place-items-center",
      "rounded-full border text-sm select-none",
      isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-slate-50",
      extra
    );

  return (
    <div className={cx("rounded-2xl border p-2 md:p-3", box)}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-medium">{labelFull}</div>
        <div className={cx("text-[10px] uppercase tracking-wider", isDark ? "text-zinc-400" : "text-gray-500")}>
          {labelShort}
        </div>
      </div>

      <div className={cx(
        "relative mx-auto grid place-items-center rounded-full border-2",
        "w-24 h-24 md:w-28 md:h-28",
        ring
      )}>
        <div className="-translate-y-1.5 md:-translate-y-2">
          <input
            type="number" min={1} max={30} aria-label={labelFull}
            value={value}
            onChange={(e)=>onChange(e.target.value)}
            className={cx(
              "w-16 md:w-20 text-center font-mono text-xl md:text-2xl leading-none",
              "bg-transparent outline-none focus:outline-none appearance-none",
              "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            )}
          />
        </div>

        <div
          className={cx(
            "absolute left-1/2 -translate-x-1/2",
            "rounded-full border-2 grid place-items-center font-mono text-xs md:text-sm",
            "w-9 h-9 md:w-10 md:h-10",
            ring
          )}
          style={{ bottom: "3px" }}
          title={t("modifier")}
        >
          {fmt(modValue)}
        </div>

        <button
          type="button"
          className={roundBtn("-left-3 sm:-left-3")}
          onClick={(e) => { e.preventDefault(); bump(-1); }}
          title="-1"
        >
          −
        </button>
        <button
          type="button"
          className={roundBtn("-right-3 sm:-right-3")}
          onClick={(e) => { e.preventDefault(); bump(+1); }}
          title="+1"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** KPI genérico */
export function KpiBox({
  isDark, title, value, onChange, hint,
  type = "text", placeholder, readOnly, className = ""
}) {
  return (
    <label className={cx("text-sm h-full min-w-0", className)}>
      <div className="mb-0.5 font-medium">{title}</div>
      {readOnly ? (
        <div className={cx(
          "w-full rounded-2xl border px-3 py-4 md:py-5 text-center font-mono text-xl md:text-2xl",
          isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
        )}>
          {value}
        </div>
      ) : (
        <input
          type={type}
          className={cx(
            "w-full rounded-2xl border px-3 py-4 md:py-5 text-center font-mono text-xl md:text-2xl",
            "appearance-none",
            "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
          )}
          value={value}
          onChange={(e)=>onChange?.(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {hint && (
        <div className={cx("text-[11px] mt-1 leading-snug", isDark ? "text-zinc-400" : "text-gray-500")}>
          {hint}
        </div>
      )}
    </label>
  );
}

/** Stepper pequenininho para contagem de proficiência */
export function SmallStepper({ isDark, value, onChange, title }) {
  const btn = cx(
    "px-2 py-0.5 text-xs rounded-md border",
    isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-200 hover:bg-slate-50"
  );
  const inputCls = cx(
    "w-10 text-center font-mono text-xs rounded-md border px-1 py-0.5",
    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
  );
  return (
    <div className="flex items-center gap-1" title={title}>
      <button className={btn} onClick={() => onChange(Math.max(0, Number(value || 0) - 1))}>−</button>
      <input
        type="number"
        min={0}
        aria-label={title}
        max={9}
        className={inputCls}
        value={Number(value || 0)}
        onChange={(e) => onChange(clamp(Number(e.target.value || 0), 0, 9))}
      />
      <button className={btn} onClick={() => onChange(Math.min(9, Number(value || 0) + 1))}>+</button>
    </div>
  );
}

/** Box de Vida (PV): display compacto + (Atual/Máx) empilhados + Temp + stepper vertical (+ em cima / − embaixo) */
export function HPBox({ isDark, className = "", max, current, temp, onSetMax, onSetCurrent, onSetTemp, onApply }) {
  const [amt, setAmt] = React.useState(1);

  const wrap = cx(
    "rounded-2xl border p-3 md:p-4",
    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300",
    "flex items-center gap-3 md:gap-4 flex-wrap sm:flex-nowrap",
    className
  );

  const soft = isDark ? "text-zinc-400" : "text-gray-500";

  const mini = cx(
    "h-8 w-16 rounded-md border px-2 text-center font-mono text-sm",
    "appearance-none",
    "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
    isDark ? "bg-zinc-950 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
  );

  const stepBtn = cx(
    "w-9 h-7 rounded-md border font-semibold leading-none grid place-items-center select-none",
    isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-slate-50"
  );
  const stepVal = cx(
    "h-8 w-14 border text-center font-mono text-sm rounded-md",
    "appearance-none",
    "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
    isDark ? "bg-zinc-950 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
  );



  return (
    <div className={wrap}>
      {/* Display (compacto) */}
      <div className="text-center min-w-[130px] flex-1">
        <div className="text-sm font-medium">{t("hitPoints")}</div>
        <div className="font-mono text-xl md:text-3xl leading-none mt-1">
          {current} <span className="opacity-60 text-base md:text-lg">/</span> {max}
          {temp > 0 && <span className={cx("ml-1 text-sm md:text-base", soft)}>(+{temp})</span>}
        </div>
      </div>

      {/* Atual / Máximo / Temp (empilhados) */}
      <div className="grid gap-1 shrink-0">
        <label className="text-[11px] text-center">
          <div className={cx("mb-1", soft)}>{t("hpCurrent")}</div>
          <input
            type="number" min={0}
            className={mini}
            value={current}
            onChange={(e)=>onSetCurrent?.(e.target.value)}
          />
        </label>
        <label className="text-[11px] text-center">
          <div className={cx("mb-1", soft)}>{t("hpMax")}</div>
          <input
            type="number" min={0}
            className={mini}
            value={max}
            onChange={(e)=>onSetMax?.(e.target.value)}
          />
        </label>
        <label className="text-[11px] text-center">
          <div className={cx("mb-1", soft)}>{t("tempHp")}</div>
          <input
            type="number" min={0}
            className={mini}
            value={temp}
            onChange={(e)=>onSetTemp?.(e.target.value)}
          />
        </label>
      </div>

      {/* Stepper vertical: + em cima, valor no meio, − embaixo */}
      <div className="flex items-center gap-2 sm:ml-auto shrink-0">
        <div className="grid grid-rows-3 gap-1 place-items-center">
          <button
            type="button"
            className={stepBtn}
            title={t("heal")}
            onClick={() => onApply?.(Math.max(0, Number(amt || 0)))}
          >+</button>

          <input
            type="number" min={0}
            className={stepVal}
            value={amt}
            onChange={(e)=>setAmt(Math.max(0, Number(e.target.value || 0)))}
          />

          <button
            type="button"
            className={stepBtn}
            title={t("damage")}
            onClick={() => onApply?.(-Math.max(0, Number(amt || 0)))}
          >−</button>
        </div>


      </div>
    </div>
  );
}

/** Card de Origem (Espécie / Antecedente / Classe) */
function OriginCard({ isDark, label, origin, setName, setAbl, setSkill, skillLabels }) {
  const { systemId } = useCharacter();
  const { abilities: ABIL_KEYS, skills: SKILLS } = getSystem(systemId);
  const box = isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-slate-300";
  const titleCls = isDark ? "text-zinc-300" : "text-gray-700";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={cx("text-sm font-medium", titleCls)}>{label}</div>
        <input
          className={cx("flex-1 rounded-md border px-2 py-1.5 text-sm", box)}
          placeholder={t("name")}
          aria-label={label}
          value={origin.name || ""}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Bônus de Atributos */}
      <div>
        <div className={cx("text-xs mb-1", titleCls)}>{t("abilityBonuses")}</div>
        <div className="grid grid-cols-6 gap-1.5">
          {ABIL_KEYS.map(k => (
            <label key={k} className="text-[11px] text-center">
              <div className="opacity-60">{t("abilitiesShort")[k]}</div>
              <input
                type="number" min={-5} max={10}
                className={cx("w-full rounded-md border px-1 py-1 text-center font-mono text-xs", box)}
                value={Number(origin.abilities?.[k] || 0)}
                onChange={(e) => setAbl(k, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Perícias concedidas (colapsável) */}
      <details>
        <summary className={cx("cursor-pointer text-xs", titleCls)}>{t("grantedSkills")}</summary>
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          {SKILLS.map(s => (
            <div key={s.id} className={cx(
              "flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5",
              isDark ? "border-zinc-800" : "border-slate-200"
            )}>
              <span className="text-sm">{skillLabels[s.id]}</span>
              <SmallStepper
                isDark={isDark}
                value={Number(origin.skills?.[s.id] || 0)}
                onChange={(n) => setSkill(s.id, n)}
                title={t("proficiencyTimes")}
              />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
