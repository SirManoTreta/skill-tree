import React, { useMemo, useState } from 'react';
import { cx, download } from '../utils/misc';
import { t } from '../utils/i18n';
import { getSystem, emptyOrigin, createDefaultSheet } from './systems';
import { useCharacter } from '../character/context';
import { readImportFile } from '../character/schema';
import { armorClass } from '../inventory/equipment';
import { getClassLabel } from '../progression/catalog';
import { OriginsPanel, AbilityStat, KpiBox, SmallStepper, HPBox } from './SheetFields';
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const mod = score => Math.floor((Number(score || 0) - 10) / 2);
const fmt = n => n >= 0 ? '+' + n : String(n);

export default function CharacterSheet({ isDark }) {
  const { profile, setSheet, systemId, store } = useCharacter();
  const { sheet } = profile;
  const { abilities: ABIL_KEYS, skills: SKILLS } = getSystem(systemId);
  const [message, setMessage] = useState('');
  const totalLevel = profile.progression.classes.reduce((sum, entry) => sum + entry.level, 0);
  const proficiency = sheet.autoProf && systemId === 'dnd' && totalLevel ? 2 + Math.floor((Math.min(20, totalLevel) - 1) / 4) : sheet.prof;
  const classLine = sheet.autoClass && systemId === 'dnd' ? profile.progression.classes.map(entry => getClassLabel(entry.classId) + ' ' + entry.level).join(' / ') : sheet.identity.classLine;
  const toCount = value => typeof value === 'number' ? value : value ? 1 : 0;
  const exportSheetJSON = () => {
    // A standalone sheet must remain useful without the progression or inventory.
    const snapshot = { ...sheet, prof: proficiency, identity: { ...sheet.identity, classLine },
      ac: sheet.autoAc && systemId === 'dnd' ? armorClass(profile.items, abilityMods.DEX) : sheet.ac,
      autoClass: false, autoProf: false, autoAc: false };
    return download('character-sheet-' + systemId + '.json', JSON.stringify(snapshot, null, 2), 'application/json');
  };
  const importSheetJSON = async file => {
    try { store.importData(await readImportFile(file)); setMessage(t('importSuccess')); }
    catch (error) { setMessage(t('importFailed') + ' ' + error.message); }
  };
  const clearSheet = () => {
    if (window.confirm(t('clearSheetConfirm'))) setSheet(createDefaultSheet(systemId));
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
  }, [sheet.origins, ABIL_KEYS]);

  const ablTotal = useMemo(() => {
    return ABIL_KEYS.reduce((acc, k) => {
      const base = Number(sheet.abilities[k] || 0);
      acc[k] = clamp(base + Number(originAblBonus[k] || 0), 1, 30);
      return acc;
    }, {});
  }, [sheet.abilities, originAblBonus, ABIL_KEYS]);

  const abilityMods = useMemo(
    () => Object.fromEntries(ABIL_KEYS.map(k => [k, mod(ablTotal[k])])), [ablTotal, ABIL_KEYS]
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
    return abilityMods[abl] + count * proficiency;
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
    return abilityMods[skill.abl] + count * proficiency;
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

  const initiativeTotal = abilityMods.DEX + (sheet.initAlert ? proficiency : 0);

  const setOriginName = (key, name) =>
    setSheet(s => ({
      ...s,
      origins: {
        ...(s.origins || {}),
        [key]: { ...(s.origins?.[key] || emptyOrigin(systemId)), name }
      }
    }));
  const setOriginAbl = (key, abl, val) =>
    setSheet(s => {
      const cur = s.origins?.[key] || emptyOrigin(systemId);
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
      const cur = s.origins?.[key] || emptyOrigin(systemId);
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
            className="sr-only" aria-label={t("importJSON")}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) importSheetJSON(file); }}
          />
        </label>

        <button
          onClick={clearSheet}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
        >
          {t("clear")}
        </button>

      </div>

      {message && <p role="status" className="mb-3 text-sm">{message}</p>}
      <div className={cx(
        "mb-3 rounded-2xl border p-3 md:p-4",
        isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
      )}>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 font-medium">{t("characterName")}</div>
              <input
                className={cx("w-full rounded-xl border px-3 py-2", isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                value={sheet.identity?.name || ""}
                onChange={(e) => setSheet((s) => ({ ...s, identity: { ...(s.identity || {}), name: e.target.value } }))}
                placeholder="Ex.: Renn Marik"
              />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">{t("playerName")}</div>
              <input
                className={cx("w-full rounded-xl border px-3 py-2", isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                value={sheet.identity?.player || ""}
                onChange={(e) => setSheet((s) => ({ ...s, identity: { ...(s.identity || {}), player: e.target.value } }))}
                placeholder="Ex.: Samuel"
              />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">{t("campaignName")}</div>
              <input
                className={cx("w-full rounded-xl border px-3 py-2", isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                value={sheet.identity?.campaign || ""}
                onChange={(e) => setSheet((s) => ({ ...s, identity: { ...(s.identity || {}), campaign: e.target.value } }))}
                placeholder="Ex.: Ilha da Morte"
              />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">{t(systemId === "onePiece" ? "combatStyleLevel" : "classLevels")}</div>
              <input
                className={cx("w-full rounded-xl border px-3 py-2", isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                value={classLine || ""} readOnly={sheet.autoClass && systemId === "dnd"}
                onChange={(e) => setSheet((s) => ({ ...s, identity: { ...(s.identity || {}), classLine: e.target.value } }))}
                placeholder={systemId === 'onePiece' ? 'Ex.: Espadachim 3' : 'Ex.: Guerreiro 5 / Bruxo 2'}
              />
            </label>
          </div>

          <label className="text-sm">
            <div className="mb-1 font-medium">{t("biography")}</div>
            <textarea
              rows={5}
              className={cx("w-full rounded-xl border px-3 py-2", isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
              value={sheet.identity?.biography || ""}
              onChange={(e) => setSheet((s) => ({ ...s, identity: { ...(s.identity || {}), biography: e.target.value } }))}
              placeholder="Resumo do personagem, traços, objetivos, marcas narrativas e tudo o que mereça virar card mais tarde."
            />
          </label>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        {systemId === 'dnd' && <>
          <label><input type="checkbox" checked={sheet.autoClass} onChange={e => setSheet(s => ({ ...s, autoClass: e.target.checked }))} /> {t('autoClass')}</label>
          <label><input type="checkbox" checked={sheet.autoProf} onChange={e => setSheet(s => ({ ...s, autoProf: e.target.checked }))} /> {t('autoProf')}</label>
          <label><input type="checkbox" checked={sheet.autoAc} onChange={e => setSheet(s => ({ ...s, autoAc: e.target.checked }))} /> {t('autoAc')}</label>
        </>}
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
                title={t(systemId === "onePiece" ? "resistanceClass" : "armorClass")}
                value={sheet.autoAc && systemId === "dnd" ? armorClass(profile.items, abilityMods.DEX) : sheet.ac}
                readOnly={sheet.autoAc && systemId === "dnd"}
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
                value={proficiency}
                readOnly={sheet.autoProf && systemId === "dnd" && totalLevel > 0}
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
                          title={t("proficiencyTimes")}
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
                          title={t("proficiencyTimes")}
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
