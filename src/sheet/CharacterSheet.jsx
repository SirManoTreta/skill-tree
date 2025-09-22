import React, { useEffect, useMemo, useState } from "react";
import { SHEET_KEY } from "../constants/storage";
import { cx, download } from "../utils/misc";
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

const emptyOrigin = () => ({
  name: "",
  abilities: Object.fromEntries(ABIL_KEYS.map(k => [k, 0])),
  skills: Object.fromEntries(SKILLS.map(s => [s.id, 0])),
});

const defaultSheet = {
  abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
  prof: 2,
  saves: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
  skills: Object.fromEntries(SKILLS.map(s => [s.id, 0])),
  ac: 10,
  speed: "30 ft",
  hp: { max: 10, current: 10, temp: 0 },
  initAlert: false,
  origins: {
    species: emptyOrigin(),
    background: emptyOrigin(),
    class: emptyOrigin(),
  },
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

  const toCount = (v) => (typeof v === "number" ? v : v ? 1 : 0);

  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(SHEET_KEY, JSON.stringify(sheet)); } catch {}
    }, 200);
    return () => clearTimeout(id);
  }, [sheet]);

  // ===== Export/Import/Clear (Ficha) + Exportar Tudo =====
  const exportSheetJSON = async () => {
    const data = JSON.stringify(sheet, null, 2);
    await download(
      `character-sheet-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`,
      data,
      "application/json"
    );
  };

  const importSheetJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setSheet({ ...defaultSheet, ...parsed });
        alert("Ficha importada com sucesso!");
      } catch {
        alert("JSON inválido para a ficha.");
      }
    };
    reader.readAsText(file);
  };

  const clearSheet = () => {
    if (!confirm("Apagar todos os dados da Ficha?")) return;
    try { localStorage.removeItem(SHEET_KEY); } catch {}
    setSheet(defaultSheet);
  };

  // Exportar Tudo: tenta pegar árvore/inventário por chaves conhecidas e também inclui TODO o localStorage como fallback.
  const exportAllJSON = async () => {
    // Best effort: tenta usar chaves conhecidas se existirem
    let bundle = { tree: {}, sheet: null, inventory: { items: [] }, meta: { exportedAt: new Date().toISOString() } };
    try { bundle.sheet = JSON.parse(localStorage.getItem(SHEET_KEY) || "null"); } catch {}
    // Inventário
    try { 
      const invKey = (window.HABILITY_INVENTORY_KEY) || (window.INVENTORY_KEY) || null;
      const guess = invKey ? localStorage.getItem(invKey) : null;
      const byConst = guess ? JSON.parse(guess) : null;
      bundle.inventory.items = Array.isArray(byConst) ? byConst : (JSON.parse(localStorage.getItem("INVENTORY_KEY") || "[]"));
    } catch { /* ignore */ }
    // Árvore (tentativas)
    try {
      const nodes = JSON.parse(localStorage.getItem("TREE_NODES") || "[]");
      const edges = JSON.parse(localStorage.getItem("TREE_EDGES") || "[]");
      bundle.tree = { nodes, edges };
    } catch { /* ignore */ }

    // Fallback: captura TODO localStorage também
    const all = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        try { all[k] = JSON.parse(localStorage.getItem(k)); }
        catch { all[k] = localStorage.getItem(k); }
      }
    } catch {}
    bundle.__allLocalStorage = all;

    await download(
      `hability-all-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`,
      JSON.stringify(bundle, null, 2),
      "application/json"
    );
  };

  // ===== Origens => bônus =====
  const originAblBonus = useMemo(() => {
    const sp = sheet.origins?.species?.abilities || {};
    const bg = sheet.origins?.background?.abilities || {};
    const cl = sheet.origins?.class?.abilities || {};
    return ABIL_KEYS.reduce((acc, k) => {
      acc[k] = Number(sp[k] || 0) + Number(bg[k] || 0) + Number(cl[k] || 0);
      return acc;
    }, {});
  }, [sheet.origins]);

  const ablTotal = useMemo(() => {
    return ABIL_KEYS.reduce((acc, k) => {
      const base = Number(sheet.abilities[k] || 0);
      acc[k] = clamp(base + Number(originAblBonus[k] || 0), 1, 30);
      return acc;
    }, {});
  }, [sheet.abilities, originAblBonus]);

  const abilityMods = useMemo(
    () => Object.fromEntries(ABIL_KEYS.map(k => [k, mod(ablTotal[k])])), [ablTotal]
  );

  const skillLabels = t("skills");
  const abilityShort = t("abilitiesShort");
  const abilityFull  = t("abilitiesFull");

  const changeAbilityTotal = (k, totalShown) =>
    setSheet(s => {
      const base = clamp(Number(totalShown || 0) - Number(originAblBonus[k] || 0), 1, 30);
      return { ...s, abilities: { ...s.abilities, [k]: base } };
    });

  const toggleSave = (k) =>
    setSheet(s => {
      const prev = toCount(s.saves?.[k]);
      return { ...s, saves: { ...s.saves, [k]: prev ? 0 : 1 } };
    });
  const toggleSkill = (id) =>
    setSheet(s => {
      const prev = toCount(s.skills?.[id]);
      return { ...s, skills: { ...s.skills, [id]: prev ? 0 : 1 } };
    });
  const setSaveCount = (k, n) =>
    setSheet(s => ({ ...s, saves: { ...s.saves, [k]: clamp(Number(n || 0), 0, 9) } }));
  const setSkillCount = (id, n) =>
    setSheet(s => ({ ...s, skills: { ...s.skills, [id]: clamp(Number(n || 0), 0, 9) } }));

  const saveTotal = (abl, countRaw) => {
    const count = toCount(countRaw);
    return abilityMods[abl] + count * Number(sheet.prof || 0);
  };

  const originSkillCount = (id) =>
    Number(sheet.origins?.species?.skills?.[id] || 0) +
    Number(sheet.origins?.background?.skills?.[id] || 0) +
    Number(sheet.origins?.class?.skills?.[id] || 0);

  const skillTotal = (id) => {
    const skill = SKILLS.find(x => x.id === id);
    if (!skill) return 0;
    const countBase = toCount(sheet.skills[id]);
    const count = countBase + originSkillCount(id);
    return abilityMods[skill.abl] + count * Number(sheet.prof || 0);
  };

  // ---- HP helpers ----
  const hpMax = Number(sheet.hp?.max || 0);
  const hpCur = Number(sheet.hp?.current || 0);
  const hpTemp = Number(sheet.hp?.temp || 0);

  const setHpMax = (v) =>
    setSheet(s => {
      const max = Math.max(0, Number(v || 0));
      const cur = Math.min(Math.max(0, Number(s.hp?.current || 0)), max);
      const temp = Math.max(0, Number(s.hp?.temp || 0));
      return { ...s, hp: { max, current: cur, temp } };
    });
  const setHpCurrent = (v) =>
    setSheet(s => {
      const max = Math.max(0, Number(s.hp?.max || 0));
      const cur = clamp(Number(v || 0), 0, max);
      const temp = Math.max(0, Number(s.hp?.temp || 0));
      return { ...s, hp: { max, current: cur, temp } };
    });
  const setHpTemp = (v) =>
    setSheet(s => {
      const max = Math.max(0, Number(s.hp?.max || 0));
      const cur = Math.min(Math.max(0, Number(s.hp?.current || 0)), max);
      const temp = Math.max(0, Number(v || 0));
      return { ...s, hp: { max, current: cur, temp } };
    });

  const applyHp = (delta) =>
    setSheet((s) => {
      const max = Math.max(0, Number(s.hp?.max || 0));
      let cur   = Math.min(Math.max(0, Number(s.hp?.current || 0)), max);
      let temp  = Math.max(0, Number(s.hp?.temp || 0));
      const amt = Number(delta || 0);

      if (amt >= 0) {
        cur = Math.min(max, cur + amt);
      } else {
        let dmg = -amt;
        const absorbed = Math.min(temp, dmg);
        temp -= absorbed;
        dmg  -= absorbed;
        if (dmg > 0) cur = Math.max(0, cur - dmg);
      }
      return { ...s, hp: { max, current: cur, temp } };
    });

  const initiativeTotal = abilityMods.DEX + (sheet.initAlert ? Number(sheet.prof || 0) : 0);

  const setOriginName = (key, name) =>
    setSheet(s => ({
      ...s,
      origins: {
        ...(s.origins || {}),
        [key]: { ...(s.origins?.[key] || emptyOrigin()), name }
      }
    }));
  const setOriginAbl = (key, abl, val) =>
    setSheet(s => {
      const cur = s.origins?.[key] || emptyOrigin();
      return {
        ...s,
        origins: {
          ...(s.origins || {}),
          [key]: { ...cur, abilities: { ...(cur.abilities || {}), [abl]: Number(val || 0) } }
        }
      };
    });
  const setOriginSkill = (key, id, n) =>
    setSheet(s => {
      const cur = s.origins?.[key] || emptyOrigin();
      return {
        ...s,
        origins: {
          ...(s.origins || {}),
          [key]: { ...cur, skills: { ...(cur.skills || {}), [id]: clamp(Number(n || 0), 0, 9) } }
        }
      };
    });

  return (
    <div className="w-full h-full overflow-auto p-2 sm:p-3">
      {/* Ações da Ficha */}
      <div className="mb-2 flex flex-wrap gap-2 justify-end">
        <button
          onClick={exportSheetJSON}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {t("exportJSON")}
        </button>

        <label className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer">
          {t("importJSON")}
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importSheetJSON(e.target.files[0])}
          />
        </label>

        <button
          onClick={clearSheet}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
        >
          {t("clear")}
        </button>

        <button
          onClick={exportAllJSON}
          className="px-3 py-1.5 rounded-lg border"
        >
          {t("exportAll") || "Exportar Tudo"}
        </button>
      </div>

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
              value={ablTotal[k]}
              modValue={abilityMods[k]}
              onChange={(v)=>changeAbilityTotal(k, v)}
            />
          ))}
        </div>

        {/* COLUNA DIREITA — TOPO CENTRAL + SEÇÕES */}
        <div className="lg:col-span-9 space-y-2 md:space-y-3">
          {/* QUADRO CENTRAL SUPERIOR */}
          <div className={cx(
            "rounded-2xl border p-3 md:p-4 flex justify-left",
            isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
          )}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 items-start gap-2 md:gap-3 w-full max-w-[1300px]">
              <HPBox
                isDark={isDark}
                className="col-span-2"
                max={hpMax}
                current={hpCur}
                temp={hpTemp}
                onSetMax={setHpMax}
                onSetCurrent={setHpCurrent}
                onSetTemp={setHpTemp}
                onApply={applyHp}
              />

              <KpiBox
                isDark={isDark}
                title={t("armorClass")}
                value={sheet.ac}
                onChange={(v)=>setSheet(s=>({...s, ac: clamp(Number(v||0),0,50)}))}
                type="number"
              />

              {/* Iniciativa + Alerta */}
              <div className="text-sm">
                <KpiBox
                  isDark={isDark}
                  title={t("initiative")}
                  value={fmt(initiativeTotal)}
                  readOnly
                  hint={t("initiativeHint")}
                />
                <label className="mt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!sheet.initAlert}
                    onChange={() => setSheet(s => ({ ...s, initAlert: !s.initAlert }))}
                  />
                  <span className={cx("text-xs", isDark ? "text-zinc-400" : "text-gray-600")}>
                    {t("initiativeAlert")}
                  </span>
                </label>
              </div>

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

          {/* SALVAGUARDAS + PERÍCIAS (+ ORIGENS abaixo de Salvaguardas) */}
          <div className="grid md:grid-cols-2 gap-2 md:gap-3">
            {/* Coluna esquerda: Salvaguardas + Origens */}
            <div className="space-y-2 md:space-y-3">
              {/* Salvaguardas */}
              <div className={cx(
                "rounded-2xl border p-2 md:p-3",
                isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
              )}>
                <div className="mb-2 font-semibold">{t("savingThrowsTitle")}</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {ABIL_KEYS.map(k => (
                    <div key={k} className={cx(
                      "flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5",
                      isDark ? "border-zinc-800 hover:bg-zinc-900" : "border-slate-200 hover:bg-slate-50"
                    )}>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={toCount(sheet.saves[k]) > 0} onChange={() => toggleSave(k)} />
                        <span>{t("savingThrowOf", { abl: abilityFull[k] })} <span className="opacity-60 text-xs">({abilityShort[k]})</span></span>
                      </label>

                      <div className="flex items-center gap-2">
                        <SmallStepper
                          isDark={isDark}
                          value={toCount(sheet.saves[k])}
                          onChange={(n)=>setSaveCount(k, n)}
                          title="Vezes de proficiência"
                        />
                        <span className="font-mono text-sm md:text-base w-10 text-right">
                          {fmt(saveTotal(k, sheet.saves[k]))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={cx("text-xs mt-2", isDark ? "text-zinc-400" : "text-gray-500")}>
                  {t("profNote")}
                </div>
              </div>

              {/* Origens */}
              <OriginsPanel
                isDark={isDark}
                sheet={sheet}
                setOriginName={setOriginName}
                setOriginAbl={setOriginAbl}
                setOriginSkill={setOriginSkill}
                skillLabels={skillLabels}
              />
            </div>

            {/* Coluna direita: Perícias */}
            <div className={cx(
              "rounded-2xl border p-2 md:p-3",
              isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
            )}>
              <div className="mb-2 font-semibold">{t("skillsTitle")}</div>
              <div className="grid grid-cols-1 gap-1.5">
                {SKILLS.map(s => {
                  const countBase = toCount(sheet.skills[s.id]);
                  const bonusFromOrigins = originSkillCount(s.id);
                  const effectiveChecked = countBase > 0 || bonusFromOrigins > 0;
                  const fromOrigins = bonusFromOrigins > 0;

                  return (
                    <div key={s.id} className={cx(
                      "flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5",
                      isDark ? "border-zinc-800 hover:bg-zinc-900" : "border-slate-200 hover:bg-slate-50"
                    )}>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={effectiveChecked}
                            onChange={() => !fromOrigins && toggleSkill(s.id)}
                            disabled={fromOrigins}
                            title={fromOrigins ? t("grantedSkills") : ""}
                          />
                          <span>
                            {skillLabels[s.id]}{" "}
                            <span className="opacity-60 text-xs">({abilityShort[s.abl]})</span>
                          </span>
                        </label>
                        {fromOrigins && (
                          <span className={cx(
                            "text-[10px] px-1.5 py-0.5 rounded-md border",
                            isDark ? "border-zinc-700 text-zinc-300" : "border-slate-300 text-gray-600"
                          )}>
                            +{bonusFromOrigins} {t("grantedSkills")}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <SmallStepper
                          isDark={isDark}
                          value={countBase}
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
        </div>
      </div>
    </div>
  );
}

/** Painel de Origens (Espécie/Antecedente/Classe) */
function OriginsPanel({ isDark, sheet, setOriginName, setOriginAbl, setOriginSkill, skillLabels }) {
  const box = isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200";
  return (
    <div className={cx("rounded-2xl border p-2 md:p-3", box)}>
      <div className="mb-2 font-semibold">{t("originsTitle")}</div>

      <OriginCard
        isDark={isDark}
        label={t("species")}
        skillLabels={skillLabels}
        origin={sheet.origins?.species || emptyOrigin()}
        setName={(v) => setOriginName("species", v)}
        setAbl={(abl, v) => setOriginAbl("species", abl, v)}
        setSkill={(id, n) => setOriginSkill("species", id, n)}
      />

      <div className="my-2 h-px bg-black/10 dark:bg-white/10" />

      <OriginCard
        isDark={isDark}
        label={t("backgroundTitle")}
        skillLabels={skillLabels}
        origin={sheet.origins?.background || emptyOrigin()}
        setName={(v) => setOriginName("background", v)}
        setAbl={(abl, v) => setOriginAbl("background", abl, v)}
        setSkill={(id, n) => setOriginSkill("background", id, n)}
      />

      <div className="my-2 h-px bg-black/10 dark:bg-white/10" />

      <OriginCard
        isDark={isDark}
        label={t("classTitle")}
        skillLabels={skillLabels}
        origin={sheet.origins?.class || emptyOrigin()}
        setName={(v) => setOriginName("class", v)}
        setAbl={(abl, v) => setOriginAbl("class", abl, v)}
        setSkill={(id, n) => setOriginSkill("class", id, n)}
      />
    </div>
  );
}

/** Medalhão de atributo: círculo grande (valor total) + círculo pequeno (mod) + botões +/− (ajustam base) */
function AbilityStat({ isDark, labelFull, labelShort, value, modValue, onChange }) {
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
function KpiBox({
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

/** Box de Vida (PV): display compacto + (Atual/Máx) empilhados + Temp + stepper vertical (+ em cima / − embaixo) */
function HPBox({ isDark, className = "", max, current, temp, onSetMax, onSetCurrent, onSetTemp, onApply }) {
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

  const chip = cx("text-xs px-2 py-1 rounded-md border shrink-0",
                  isDark ? "border-zinc-700" : "border-slate-300");

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

        {/*<span className={chip}>{t("hpAdjust")}</span>*/}
      </div>
    </div>
  );
}

/** Card de Origem (Espécie / Antecedente / Classe) */
function OriginCard({ isDark, label, origin, setName, setAbl, setSkill, skillLabels }) {
  const box = isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-slate-300";
  const titleCls = isDark ? "text-zinc-300" : "text-gray-700";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={cx("text-sm font-medium", titleCls)}>{label}</div>
        <input
          className={cx("flex-1 rounded-md border px-2 py-1.5 text-sm", box)}
          placeholder={t("name")}
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
              <div className="opacity-60">{k}</div>
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
                title="Vezes de proficiência"
              />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
