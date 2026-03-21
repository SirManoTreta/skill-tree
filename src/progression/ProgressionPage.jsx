import React, { useMemo, useState } from "react";
import { PROGRESSION_KEY } from "../constants/storage";
import { cx, download, uid } from "../utils/misc";
import useLocalStorageState from "../shared/hooks/useLocalStorageState";
import { CLASS_OPTIONS, getClassCards, getClassLabel } from "./catalog";
import { getLang } from "../utils/i18n";

const text = {
  pt: {
    title: "Progressão por Cards",
    subtitle: "A ficha continua no centro, mas a evolução do personagem agora aparece como cards de classe, multiclasse e biografia.",
    noClassTitle: "Comece escolhendo a classe inicial",
    noClassBody: "Depois disso, cada nível novo libera os cards correspondentes. Quando quiser, você também pode abrir uma multiclasse.",
    createCharacter: "Criar progressão",
    totalLevel: "Nível total",
    classes: "Classes",
    levelUp: "Subir nível",
    addMulticlass: "Adicionar multiclasse",
    subclass: "Subclasse",
    export: "Exportar progressão",
    import: "Importar progressão",
    clear: "Limpar progressão",
    filters: "Filtros",
    all: "Todos",
    custom: "Biografia / custom",
    cards: "Cards desbloqueados",
    grantedAt: "Nível",
    biographyCards: "Cards de biografia e campanha",
    openForm: "Novo card customizado",
    closeForm: "Fechar formulário",
    sourceLabel: "Origem do card",
    sourcePlaceholder: "Ex.: Biografia, Benção, Recompensa, Maldição",
    cardTitle: "Título",
    description: "Descrição",
    kind: "Tipo",
    save: "Salvar card",
    remove: "Remover",
    emptyCards: "Ainda não há cards desbloqueados para este filtro.",
    lastUnlocks: "Últimos ganhos",
    noHistory: "Nenhum ganho registrado ainda.",
    customKinds: {
      biography: "Biografia",
      reward: "Recompensa",
      curse: "Maldição",
      feature: "Recurso",
      note: "Anotação",
    },
    tagKinds: {
      passive: "Passiva",
      resource: "Recurso",
      choice: "Escolha",
      action: "Ação",
      bonus: "Ação bônus",
      reaction: "Reação",
      rest: "Descanso",
      custom: "Custom",
    },
  },
  en: {
    title: "Card-based progression",
    subtitle: "The sheet stays at the center, but character growth now shows up as class, multiclass, and biography cards.",
    noClassTitle: "Start by choosing the first class",
    noClassBody: "After that, each new level unlocks the matching cards. Whenever you want, you can also open a multiclass.",
    createCharacter: "Create progression",
    totalLevel: "Total level",
    classes: "Classes",
    levelUp: "Level up",
    addMulticlass: "Add multiclass",
    subclass: "Subclass",
    export: "Export progression",
    import: "Import progression",
    clear: "Clear progression",
    filters: "Filters",
    all: "All",
    custom: "Biography / custom",
    cards: "Unlocked cards",
    grantedAt: "Level",
    biographyCards: "Biography and campaign cards",
    openForm: "New custom card",
    closeForm: "Close form",
    sourceLabel: "Card source",
    sourcePlaceholder: "Ex.: Biography, Blessing, Reward, Curse",
    cardTitle: "Title",
    description: "Description",
    kind: "Type",
    save: "Save card",
    remove: "Remove",
    emptyCards: "There are no unlocked cards for this filter yet.",
    lastUnlocks: "Recent gains",
    noHistory: "No gains recorded yet.",
    customKinds: {
      biography: "Biography",
      reward: "Reward",
      curse: "Curse",
      feature: "Feature",
      note: "Note",
    },
    tagKinds: {
      passive: "Passive",
      resource: "Resource",
      choice: "Choice",
      action: "Action",
      bonus: "Bonus action",
      reaction: "Reaction",
      rest: "Rest",
      custom: "Custom",
    },
  },
};

const createDefaultProgression = () => ({
  version: 1,
  classes: [],
  history: [],
  customCards: [],
});

const makeClassEntry = (classId) => ({
  id: uid(),
  classId,
  level: 1,
  subclass: "",
});

const createHistoryEntry = (classId, level, cards) => ({
  id: uid(),
  classId,
  classLabel: getClassLabel(classId),
  level,
  cardIds: cards.map((card) => card.id),
  cardTitles: cards.map((card) => card.title),
  createdAt: new Date().toISOString(),
});

const getCardsGrantedOnLevel = (classId, level) => getClassCards(classId).filter((card) => Number(card.level) === Number(level));

export default function ProgressionPage({ isDark }) {
  const lang = getLang() === "en" ? "en" : "pt";
  const copy = text[lang];
  const [progression, setProgression] = useLocalStorageState(PROGRESSION_KEY, createDefaultProgression);
  const [initialClass, setInitialClass] = useState(CLASS_OPTIONS[0].value);
  const [multiclassDraft, setMulticlassDraft] = useState(CLASS_OPTIONS[1].value);
  const [filter, setFilter] = useState("all");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({ title: "", sourceLabel: "", description: "", kind: "biography" });

  const classes = progression.classes || [];
  const totalLevel = classes.reduce((sum, entry) => sum + Number(entry.level || 0), 0);

  const unlockedCards = useMemo(() => {
    const builtIn = classes.flatMap((entry) =>
      getClassCards(entry.classId)
        .filter((card) => Number(card.level) <= Number(entry.level || 0))
        .map((card) => ({
          ...card,
          sourceType: "class",
          sourceId: entry.classId,
          sourceLabel: getClassLabel(entry.classId),
          classEntryId: entry.id,
          subclass: entry.subclass || "",
        }))
    );

    const custom = (progression.customCards || []).map((card) => ({
      ...card,
      sourceType: "custom",
      sourceId: "custom",
    }));

    return [...builtIn, ...custom];
  }, [classes, progression.customCards]);

  const visibleCards = useMemo(() => {
    if (filter === "all") return unlockedCards;
    if (filter === "custom") return unlockedCards.filter((card) => card.sourceType === "custom");
    return unlockedCards.filter((card) => card.sourceId === filter);
  }, [filter, unlockedCards]);

  const beginProgression = () => {
    const cards = getCardsGrantedOnLevel(initialClass, 1);
    setProgression({
      version: 1,
      classes: [makeClassEntry(initialClass)],
      customCards: [],
      history: [createHistoryEntry(initialClass, 1, cards)],
    });
    setFilter("all");
  };

  const levelUpClass = (entryId) => {
    setProgression((current) => {
      const classesList = (current.classes || []).map((entry) => {
        if (entry.id !== entryId) return entry;
        return { ...entry, level: Number(entry.level || 0) + 1 };
      });

      const leveled = classesList.find((entry) => entry.id === entryId);
      const gainedCards = getCardsGrantedOnLevel(leveled.classId, leveled.level);

      return {
        ...current,
        classes: classesList,
        history: [createHistoryEntry(leveled.classId, leveled.level, gainedCards), ...(current.history || [])],
      };
    });
  };

  const addMulticlass = () => {
    setProgression((current) => {
      if ((current.classes || []).some((entry) => entry.classId === multiclassDraft)) return current;
      const nextEntry = makeClassEntry(multiclassDraft);
      const gainedCards = getCardsGrantedOnLevel(multiclassDraft, 1);
      return {
        ...current,
        classes: [...(current.classes || []), nextEntry],
        history: [createHistoryEntry(multiclassDraft, 1, gainedCards), ...(current.history || [])],
      };
    });
  };

  const updateSubclass = (entryId, value) => {
    setProgression((current) => ({
      ...current,
      classes: (current.classes || []).map((entry) => (entry.id === entryId ? { ...entry, subclass: value } : entry)),
    }));
  };

  const saveCustomCard = (event) => {
    event.preventDefault();
    if (!customForm.title.trim()) return;
    setProgression((current) => ({
      ...current,
      customCards: [
        {
          id: uid(),
          title: customForm.title.trim(),
          sourceLabel: customForm.sourceLabel.trim() || copy.custom,
          summary: customForm.description.trim(),
          details: customForm.description.trim(),
          kind: customForm.kind,
          level: totalLevel || 1,
          tags: [copy.customKinds[customForm.kind] || customForm.kind],
        },
        ...(current.customCards || []),
      ],
    }));
    setCustomForm({ title: "", sourceLabel: "", description: "", kind: "biography" });
    setShowCustomForm(false);
  };

  const removeCustomCard = (cardId) => {
    setProgression((current) => ({
      ...current,
      customCards: (current.customCards || []).filter((card) => card.id !== cardId),
    }));
  };

  const exportProgression = async () => {
    await download(
      `hability-progression-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
      JSON.stringify(progression, null, 2),
      "application/json"
    );
  };

  const importProgression = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setProgression({
          version: 1,
          classes: Array.isArray(parsed?.classes) ? parsed.classes : [],
          history: Array.isArray(parsed?.history) ? parsed.history : [],
          customCards: Array.isArray(parsed?.customCards) ? parsed.customCards : [],
        });
      } catch {
        alert(lang === "en" ? "Invalid progression JSON." : "JSON de progressão inválido.");
      }
    };
    reader.readAsText(file);
  };

  const clearProgression = () => {
    const confirmed = window.confirm(lang === "en" ? "Clear all progression data?" : "Apagar todos os dados da progressão?");
    if (!confirmed) return;
    setProgression(createDefaultProgression());
    setFilter("all");
  };

  const panelClass = cx(
    "rounded-2xl border",
    isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
  );

  return (
    <div className="w-full h-full overflow-auto p-2 sm:p-3">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <section className={cx(panelClass, "p-4 md:p-5") }>
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-semibold">{copy.title}</h1>
              <p className={cx("text-sm mt-1 max-w-3xl", isDark ? "text-zinc-400" : "text-slate-600")}>{copy.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={exportProgression} className="px-3 py-1.5 rounded-lg border">{copy.export}</button>
              <label className="px-3 py-1.5 rounded-lg border cursor-pointer">
                {copy.import}
                <input className="hidden" type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importProgression(e.target.files[0])} />
              </label>
              <button onClick={clearProgression} className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700">{copy.clear}</button>
            </div>
          </div>

          {classes.length === 0 ? (
            <div className={cx("mt-4 rounded-2xl border p-4", isDark ? "border-zinc-800 bg-zinc-900/60" : "border-slate-200 bg-slate-50") }>
              <div className="font-medium">{copy.noClassTitle}</div>
              <p className={cx("text-sm mt-1", isDark ? "text-zinc-400" : "text-slate-600")}>{copy.noClassBody}</p>
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <select value={initialClass} onChange={(e) => setInitialClass(e.target.value)} className={cx("px-3 py-2 rounded-lg border min-w-[220px]", isDark ? "bg-zinc-950 border-zinc-700 text-zinc-100" : "bg-white border-slate-300") }>
                  {CLASS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button onClick={beginProgression} className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">{copy.createCharacter}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-[0.7fr_1.3fr]">
                <div className={cx("rounded-2xl border p-4", isDark ? "border-zinc-800 bg-zinc-900/60" : "border-slate-200 bg-slate-50") }>
                  <div className={cx("text-xs uppercase tracking-wide", isDark ? "text-zinc-400" : "text-slate-500")}>{copy.totalLevel}</div>
                  <div className="text-4xl font-semibold mt-1">{totalLevel}</div>
                </div>

                <div className={cx("rounded-2xl border p-4", isDark ? "border-zinc-800 bg-zinc-900/60" : "border-slate-200 bg-slate-50") }>
                  <div className={cx("text-xs uppercase tracking-wide mb-3", isDark ? "text-zinc-400" : "text-slate-500")}>{copy.classes}</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {classes.map((entry) => (
                      <div key={entry.id} className={cx("rounded-xl border p-3", isDark ? "border-zinc-700 bg-zinc-950" : "border-slate-200 bg-white") }>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">{getClassLabel(entry.classId)}</div>
                            <div className={cx("text-sm", isDark ? "text-zinc-400" : "text-slate-600")}>Nível {entry.level}</div>
                          </div>
                          <button onClick={() => levelUpClass(entry.id)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">{copy.levelUp}</button>
                        </div>
                        <label className="block mt-3 text-sm">
                          <div className={cx("mb-1", isDark ? "text-zinc-300" : "text-slate-700")}>{copy.subclass}</div>
                          <input
                            value={entry.subclass || ""}
                            onChange={(e) => updateSubclass(entry.id, e.target.value)}
                            className={cx("w-full px-3 py-2 rounded-lg border", isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300") }
                            placeholder={lang === "en" ? "Ex.: Battle Master" : "Ex.: Mestre de Batalha"}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 items-center">
                    <select value={multiclassDraft} onChange={(e) => setMulticlassDraft(e.target.value)} className={cx("px-3 py-2 rounded-lg border min-w-[220px]", isDark ? "bg-zinc-950 border-zinc-700 text-zinc-100" : "bg-white border-slate-300") }>
                      {CLASS_OPTIONS.filter((option) => !classes.some((entry) => entry.classId === option.value)).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={addMulticlass}
                      disabled={CLASS_OPTIONS.every((option) => classes.some((entry) => entry.classId === option.value))}
                      className="px-3 py-2 rounded-lg border disabled:opacity-50"
                    >
                      {copy.addMulticlass}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className={cx("text-xs uppercase tracking-wide mb-2", isDark ? "text-zinc-400" : "text-slate-500")}>{copy.filters}</div>
                <div className="flex flex-wrap gap-2">
                  <FilterChip isDark={isDark} active={filter === "all"} onClick={() => setFilter("all")}>{copy.all}</FilterChip>
                  {classes.map((entry) => (
                    <FilterChip key={entry.id} isDark={isDark} active={filter === entry.classId} onClick={() => setFilter(entry.classId)}>
                      {getClassLabel(entry.classId)}
                    </FilterChip>
                  ))}
                  <FilterChip isDark={isDark} active={filter === "custom"} onClick={() => setFilter("custom")}>{copy.custom}</FilterChip>
                </div>
              </div>
            </>
          )}
        </section>

        <section className={cx(panelClass, "p-4 md:p-5") }>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">{copy.lastUnlocks}</h2>
              <p className={cx("text-sm mt-1", isDark ? "text-zinc-400" : "text-slate-600")}>{copy.biographyCards}</p>
            </div>
            <button onClick={() => setShowCustomForm((value) => !value)} className="px-3 py-1.5 rounded-lg border">
              {showCustomForm ? copy.closeForm : copy.openForm}
            </button>
          </div>

          {showCustomForm && (
            <form onSubmit={saveCustomCard} className={cx("mt-4 rounded-2xl border p-3 space-y-3", isDark ? "border-zinc-800 bg-zinc-900/60" : "border-slate-200 bg-slate-50") }>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1">{copy.cardTitle}</div>
                  <input value={customForm.title} onChange={(e) => setCustomForm((form) => ({ ...form, title: e.target.value }))} className={cx("w-full px-3 py-2 rounded-lg border", isDark ? "bg-zinc-950 border-zinc-700 text-zinc-100" : "bg-white border-slate-300") } />
                </label>
                <label className="text-sm">
                  <div className="mb-1">{copy.sourceLabel}</div>
                  <input value={customForm.sourceLabel} placeholder={copy.sourcePlaceholder} onChange={(e) => setCustomForm((form) => ({ ...form, sourceLabel: e.target.value }))} className={cx("w-full px-3 py-2 rounded-lg border", isDark ? "bg-zinc-950 border-zinc-700 text-zinc-100" : "bg-white border-slate-300") } />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-[0.7fr_1.3fr]">
                <label className="text-sm">
                  <div className="mb-1">{copy.kind}</div>
                  <select value={customForm.kind} onChange={(e) => setCustomForm((form) => ({ ...form, kind: e.target.value }))} className={cx("w-full px-3 py-2 rounded-lg border", isDark ? "bg-zinc-950 border-zinc-700 text-zinc-100" : "bg-white border-slate-300") }>
                    {Object.entries(copy.customKinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <div className="mb-1">{copy.description}</div>
                  <textarea value={customForm.description} onChange={(e) => setCustomForm((form) => ({ ...form, description: e.target.value }))} rows={4} className={cx("w-full px-3 py-2 rounded-lg border", isDark ? "bg-zinc-950 border-zinc-700 text-zinc-100" : "bg-white border-slate-300") } />
                </label>
              </div>
              <button className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">{copy.save}</button>
            </form>
          )}

          <div className="mt-4 space-y-2 max-h-[240px] overflow-auto pr-1">
            {(progression.history || []).length === 0 ? (
              <div className={cx("text-sm", isDark ? "text-zinc-400" : "text-slate-600")}>{copy.noHistory}</div>
            ) : (
              progression.history.slice(0, 8).map((entry) => (
                <div key={entry.id} className={cx("rounded-xl border p-3", isDark ? "border-zinc-800 bg-zinc-900/60" : "border-slate-200 bg-slate-50") }>
                  <div className="font-medium">{entry.classLabel} — {copy.grantedAt} {entry.level}</div>
                  <div className={cx("text-sm mt-1", isDark ? "text-zinc-400" : "text-slate-600")}>{entry.cardTitles.length ? entry.cardTitles.join(" • ") : (lang === "en" ? "No new cards recorded on this level." : "Nenhum card novo registrado nesse nível.")}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className={cx(panelClass, "mt-3 p-4 md:p-5") }>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="font-semibold">{copy.cards}</h2>
          <div className={cx("text-sm", isDark ? "text-zinc-400" : "text-slate-600")}>{visibleCards.length}</div>
        </div>

        {visibleCards.length === 0 ? (
          <div className={cx("text-sm", isDark ? "text-zinc-400" : "text-slate-600")}>{copy.emptyCards}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleCards.map((card) => (
              <CardTile
                key={`${card.sourceType}-${card.sourceId}-${card.id}`}
                card={card}
                isDark={isDark}
                copy={copy}
                onRemove={card.sourceType === "custom" ? () => removeCustomCard(card.id) : null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterChip({ isDark, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "px-3 py-1.5 rounded-lg border text-sm",
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : isDark
            ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
            : "bg-white border-slate-200 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function CardTile({ card, isDark, copy, onRemove }) {
  const kindLabel = copy.tagKinds[card.kind] || card.kind || copy.tagKinds.custom;
  return (
    <article className={cx("rounded-2xl border p-4", isDark ? "border-zinc-800 bg-zinc-900/60" : "border-slate-200 bg-slate-50") }>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={cx("text-xs uppercase tracking-wide", isDark ? "text-zinc-400" : "text-slate-500")}>{card.sourceLabel}</div>
          <h3 className="font-semibold mt-1">{card.title}</h3>
        </div>
        <div className={cx("text-xs px-2 py-1 rounded-full border shrink-0", isDark ? "border-zinc-700 text-zinc-300" : "border-slate-300 text-slate-600") }>
          {copy.grantedAt} {card.level}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <span className={cx("text-xs px-2 py-1 rounded-full border", isDark ? "border-zinc-700 text-zinc-300" : "border-slate-300 text-slate-600") }>{kindLabel}</span>
        {(card.tags || []).slice(0, 3).map((tag) => (
          <span key={tag} className={cx("text-xs px-2 py-1 rounded-full border", isDark ? "border-zinc-700 text-zinc-300" : "border-slate-300 text-slate-600") }>{tag}</span>
        ))}
      </div>

      {(card.summary || card.details) && (
        <div className={cx("text-sm mt-3 space-y-2", isDark ? "text-zinc-300" : "text-slate-700") }>
          {card.summary && <p>{card.summary}</p>}
          {card.details && card.details !== card.summary && <p className={cx(isDark ? "text-zinc-400" : "text-slate-600")}>{card.details}</p>}
        </div>
      )}

      {onRemove && (
        <button onClick={onRemove} className="mt-4 px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700">
          {copy.remove}
        </button>
      )}
    </article>
  );
}
