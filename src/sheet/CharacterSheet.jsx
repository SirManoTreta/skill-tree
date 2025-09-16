import React, { useEffect, useMemo, useState } from "react";
import { SHEET_KEY } from "../constants/storage";
import { cx } from "../utils/misc";
import { t } from "../utils/i18n";

const ABIL_KEYS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

const SKILLS = [
  { id: "acrobatics", abl: "DEX" },
  { id: "animalHandling", abl: "WIS" },
  { id: "arcana", abl: "INT" },
  { id: "athletics", abl: "STR" },
  { id: "deception", abl: "CHA" },
  { id: "history", abl: "INT" },
  { id: "insight", abl: "WIS" },
  { id: "intimidation", abl: "CHA" },
  { id: "investigation", abl: "INT" },
  { id: "medicine", abl: "WIS" },
  { id: "nature", abl: "INT" },
  { id: "perception", abl: "WIS" },
  { id: "performance", abl: "CHA" },
  { id: "persuasion", abl: "CHA" },
  { id: "religion", abl: "INT" },
  { id: "sleightOfHand", abl: "DEX" },
  { id: "stealth", abl: "DEX" },
  { id: "survival", abl: "WIS" },
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const mod = (score) => Math.floor((Number(score || 0) - 10) / 2);
const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);

// agora já iniciamos com contagem (0 = sem proficiência)
const defaultSheet = {
  abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
  prof: 2,
  // salvaguardas e perícias como contadores
  saves: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
  skills: Object.fromEntries(SKILLS.map(s => [s.id, 0])),
  ac: 10,
  speed: "30 ft",
  hp: { max: 10, current: 10 },
  background: "",
};

export default function CharacterSheet({ isDark }) {
  const [sheet, setSheet] = useState(() => {
    try {
      const raw = localStorage.getItem(SHEET_KEY);
      return raw ? { ...defaultSheet, ...JSON.parse(raw) } : defaultSheet;
    } catch {
      return defaultSheet;
    }
  });

    // --- HP helpers ---
    const hpMax = Number(sheet.hp?.max || 0);
    const hpCur = Number(sheet.hp?.current || 0);
    const setHpMax = (v) =>
    setSheet(s => {
        const max = Math.max(0, Number(v || 0));
        const cur = Math.min(Math.max(0, Number(s.hp?.current || 0)), max);
        return { ...s, hp: { max, current: cur } };
    });
    const setHpCurrent = (v) =>
    setSheet(s => {
        const max = Math.max(0, Number(s.hp?.max || 0));
        const cur = clamp(Number(v || 0), 0, max);
        return { ...s, hp: { max, current: cur } };
    });
    const applyHp = (delta) =>
    setSheet(s => {
        const max = Math.max(0, Number(s.hp?.max || 0));
        const cur = clamp(Number(s.hp?.current || 0) + Number(delta || 0), 0, max);
        return { ...s, hp: { max, current: cur } };
    });


  // normaliza booleans antigos -> contagem
  const toCount = (v) => (typeof v === "number" ? v : v ? 1 : 0);

  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(SHEET_KEY, JSON.stringify(sheet)); } catch {}
    }, 200);
    return () => clearTimeout(id);
  }, [sheet]);

  const abilityMods = useMemo(
    () => Object.fromEntries(ABIL_KEYS.map(k => [k, mod(sheet.abilities[k])])),
    [sheet.abilities]
  );

  const skillLabels = t("skills");
  const abilityShort = t("abilitiesShort");
  const abilityFull  = t("abilitiesFull");

  const changeAbility = (k, v) =>
    setSheet(s => ({ ...s, abilities: { ...s.abilities, [k]: clamp(Number(v || 0), 1, 30) } }));

  // salvaguardas: alterna 0↔1 pelo checkbox
  const toggleSave = (k) =>
    setSheet(s => {
      const prev = toCount(s.saves?.[k]);
      return { ...s, saves: { ...s.saves, [k]: prev ? 0 : 1 } };
    });

  // perícias: alterna 0↔1 pelo checkbox
  const toggleSkill = (id) =>
    setSheet(s => {
      const prev = toCount(s.skills?.[id]);
      return { ...s, skills: { ...s.skills, [id]: prev ? 0 : 1 } };
    });

  // stepper helpers
  const setSaveCount = (k, n) =>
    setSheet(s => ({ ...s, saves: { ...s.saves, [k]: clamp(Number(n || 0), 0, 9) } }));
  const setSkillCount = (id, n) =>
    setSheet(s => ({ ...s, skills: { ...s.skills, [id]: clamp(Number(n || 0), 0, 9) } }));

  const saveTotal = (abl, countRaw) => {
    const count = toCount(countRaw);
    return abilityMods[abl] + count * Number(sheet.prof || 0);
  };

  const skillTotal = (id) => {
    const skill = SKILLS.find(x => x.id === id);
    if (!skill) return 0;
    const count = toCount(sheet.skills[id]);
    return abilityMods[skill.abl] + count * Number(sheet.prof || 0);
  };

  return (
    <div className="w-full h-full overflow-auto p-2 sm:p-3">
      <div className="grid gap-2 md:gap-3 lg:grid-cols-12">
        {/* COLUNA ESQUERDA — ATRIBUTOS */}
        <div className="lg:col-span-3 space-y-2 md:space-y-3">
          <div className="font-semibold mb-1">{t("abilitiesTitle")}</div>
          {ABIL_KEYS.map((k) => (
            <AbilityStat
              key={k}
              isDark={isDark}
              labelFull={abilityFull[k]}
              labelShort={abilityShort[k]}
              value={sheet.abilities[k]}
              modValue={abilityMods[k]}
              onChange={(v)=>changeAbility(k, v)}
            />
          ))}
        </div>

        {/* COLUNA DIREITA — TOPO CENTRAL + SEÇÕES */}
        <div className="lg:col-span-9 space-y-2 md:space-y-3">
          {/* QUADRO CENTRAL SUPERIOR */}
          <div className={cx(
            "rounded-2xl border p-3 md:p-4 flex justify-center",
            isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
          )}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 w-full max-w-[680px]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 w-full max-w-[820px]">
              <HPBox
                isDark={isDark}
                className="md:col-span-2"
                max={hpMax}
                current={hpCur}
                onSetMax={setHpMax}
                onSetCurrent={setHpCurrent}
                onApply={applyHp}
              /></div>
              <KpiBox
                isDark={isDark}
                title={t("armorClass")}
                value={sheet.ac}
                onChange={(v)=>setSheet(s=>({...s, ac: clamp(Number(v||0),0,50)}))}
                type="number"
              />
              <KpiBox
                isDark={isDark}
                title={t("initiative")}
                value={fmt(abilityMods.DEX)}
                readOnly
                hint={t("initiativeHint")}
              />
              <KpiBox
                isDark={isDark}
                title={t("speed")}
                value={sheet.speed}
                onChange={(v)=>setSheet(s=>({...s, speed: v}))}
                placeholder="30 ft"
              />
              <KpiBox
                isDark={isDark}
                title={t("proficiencyBonus")}
                value={sheet.prof}
                onChange={(v)=>setSheet(s=>({...s, prof: clamp(Number(v||0),1,10)}))}
                type="number"
              />
            </div>
          </div>

          {/* SALVAGUARDAS + PERÍCIAS */}
          <div className="grid md:grid-cols-2 gap-2 md:gap-3">
            {/* Salvaguardas */}
            <div className={cx(
              "rounded-2xl border p-2 md:p-3",
              isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
            )}>
              <div className="mb-2 font-semibold">{t("savingThrowsTitle")}</div>
              <div className="grid grid-cols-1 gap-1.5">
                {ABIL_KEYS.map(k => {
                  const count = toCount(sheet.saves[k]);
                  return (
                    <div key={k} className={cx(
                      "flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5",
                      isDark ? "border-zinc-800 hover:bg-zinc-900" : "border-slate-200 hover:bg-slate-50"
                    )}>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={count > 0} onChange={() => toggleSave(k)} />
                        <span>{t("savingThrowOf", { abl: abilityFull[k] })} <span className="opacity-60 text-xs">({abilityShort[k]})</span></span>
                      </label>

                      <div className="flex items-center gap-2">
                        <SmallStepper
                          isDark={isDark}
                          value={count}
                          onChange={(n)=>setSaveCount(k, n)}
                          title="Vezes de proficiência"
                        />
                        <span className="font-mono text-sm md:text-base w-10 text-right">
                          {fmt(saveTotal(k, count))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={cx("text-xs mt-2", isDark ? "text-zinc-400" : "text-gray-500")}>
                {t("profNote")}
              </div>
            </div>

            {/* Perícias */}
            <div className={cx(
              "rounded-2xl border p-2 md:p-3",
              isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
            )}>
              <div className="mb-2 font-semibold">{t("skillsTitle")}</div>
              <div className="grid grid-cols-1 gap-1.5">
                {SKILLS.map(s => {
                  const count = toCount(sheet.skills[s.id]);
                  return (
                    <div key={s.id} className={cx(
                      "flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5",
                      isDark ? "border-zinc-800 hover:bg-zinc-900" : "border-slate-200 hover:bg-slate-50"
                    )}>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={count > 0} onChange={() => toggleSkill(s.id)} />
                        <span>{skillLabels[s.id]} <span className="opacity-60 text-xs">({abilityShort[s.abl]})</span></span>
                      </label>

                      <div className="flex items-center gap-2">
                        <SmallStepper
                          isDark={isDark}
                          value={count}
                          onChange={(n)=>setSkillCount(s.id, n)}
                          title="Vezes de proficiência"
                        />
                        <span className="font-mono text-sm md:text-base w-10 text-right">
                          {fmt(skillTotal(s.id))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={cx("text-xs mt-2", isDark ? "text-zinc-400" : "text-gray-500")}>
                {t("profNote")}
              </div>
            </div>
          </div>

          {/* Background */}
          <div className={cx(
            "rounded-2xl border p-2 md:p-3",
            isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
          )}>
            <div className="mb-2 font-semibold">{t("background")}</div>
            <textarea
              className={cx("w-full min-h-[100px] border rounded-md px-2 py-1.5",
                isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
              value={sheet.background}
              onChange={(e) => setSheet(s => ({ ...s, background: e.target.value }))}
              placeholder={t("backgroundPlaceholder")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Medalhão de atributo (compacto): círculo grande (valor) + círculo pequeno (mod). */
/** Medalhão de atributo: círculo grande (valor) + círculo pequeno (mod) + botões +/− */
function AbilityStat({ isDark, labelFull, labelShort, value, modValue, onChange }) {
  const box = isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200";
  const ring = isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300";

  // passo simples: delega o clamp para changeAbility (já existente no pai)
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
        {/* valor (um pouco mais alto pra não colidir com o mod) */}
        <div className="-translate-y-1.5 md:-translate-y-2">
          <input
            type="number" min={1} max={30}
            value={value}
            onChange={(e)=>onChange(e.target.value)}
            className={cx(
              "w-16 md:w-20 text-center font-mono text-xl md:text-2xl leading-none",
              "bg-transparent outline-none focus:outline-none appearance-none",
              "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            )}
          />
        </div>

        {/* modificador */}
        <div
          className={cx(
            "absolute left-1/2 -translate-x-1/2",
            "rounded-full border-2 grid place-items-center font-mono text-xs md:text-sm",
            "w-9 h-9 md:w-10 md:h-10",
            ring
          )}
          style={{ bottom: "3px" }}
          title="Modificador"
        >
          {modValue >= 0 ? `+${modValue}` : `${modValue}`}
        </div>

        {/* botões − / + (apenas aqui nos atributos) */}
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


/** KPI box */
function KpiBox({ isDark, title, value, onChange, hint, type = "text", placeholder, readOnly }) {
  return (
    <label className="text-sm">
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
function SmallStepper({ isDark, value, onChange, title }) {
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
        max={9}
        className={inputCls}
        value={Number(value || 0)}
        onChange={(e) => onChange(clamp(Number(e.target.value || 0), 0, 9))}
      />
      <button className={btn} onClick={() => onChange(Math.min(9, Number(value || 0) + 1))}>+</button>
    </div>
  );
}

/** Box de Vida (PV): display Atual/Máx + edição + dano/cura */
function HPBox({ isDark, className = "", max, current, onSetMax, onSetCurrent, onApply }) {
  const [amt, setAmt] = React.useState(1);
  const wrap = cx(
    "rounded-2xl border p-3 md:p-4",
    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300",
    className
  );
  const chip = cx(
    "px-2 py-0.5 rounded-md border text-xs",
    isDark ? "border-zinc-700" : "border-slate-300"
  );
  const input = cx(
    "w-full rounded-lg border px-2 py-1.5 text-center",
    isDark ? "bg-zinc-950 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
  );
  const btn = cx(
    "px-3 py-1.5 text-sm rounded-md border",
    isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-slate-50"
  );

  return (
    <div className={wrap}>
      <div className="mb-1 font-medium">{t("hitPoints")}</div>

      {/* Display grande */}
      <div className="text-center font-mono text-2xl md:text-3xl leading-none mb-2">
        {current} <span className={cx("opacity-60 text-lg")}>/</span> {max}
      </div>

      {/* Edição rápida de Atual e Máx */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="text-xs">
          <div className="mb-1 opacity-70">{t("hpCurrent")}</div>
          <input type="number" className={input} min={0} value={current}
                 onChange={(e)=>onSetCurrent?.(e.target.value)} />
        </label>
        <label className="text-xs">
          <div className="mb-1 opacity-70">{t("hpMax")}</div>
          <input type="number" className={input} min={0} value={max}
                 onChange={(e)=>onSetMax?.(e.target.value)} />
        </label>
      </div>

      {/* Dano/Cura */}
      <div className="flex items-center justify-center gap-2">
        <button type="button" className={btn} title={t("damage")}
                onClick={() => onApply?.(-Math.max(0, Number(amt || 0)))}>−</button>
        <input type="number" min={0} className={cx(input, "w-20")} value={amt}
               onChange={(e)=>setAmt(Math.max(0, Number(e.target.value || 0)))} />
        <button type="button" className={btn} title={t("heal")}
                onClick={() => onApply?.( Math.max(0, Number(amt || 0)))}>+</button>
        <span className={chip}>{t("hpAdjust")}</span>
      </div>
    </div>
  );
}
