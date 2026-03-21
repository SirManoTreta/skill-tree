import React, { Suspense, lazy, useEffect } from "react";
import AppHeader from "./app/AppHeader";
import useLocalStorageState from "./shared/hooks/useLocalStorageState";
import { LANGUAGE_KEY, PAGE_KEY, THEME_KEY } from "./constants/storage";
import { cx } from "./utils/misc";
import { readText } from "./shared/storage/localStorage";
import { LANGUAGE_CHANGE_EVENT, setLang as applyLang } from "./utils/i18n";

const CharacterSheet = lazy(() => import("./sheet/CharacterSheet"));
const ProgressionPage = lazy(() => import("./progression/ProgressionPage"));
const InventoryManager = lazy(() => import("./inventory/InventoryManager"));
const EquipmentPage = lazy(() => import("./inventory/EquipmentPage"));

const VALID_PAGES = new Set(["sheet", "progression", "inventory", "equipment"]);

export default function App() {
  const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;

  const [theme, setTheme] = useLocalStorageState(
    THEME_KEY,
    () => {
      const saved = readText(THEME_KEY, "");
      if (saved === "dark" || saved === "light") return saved;
      return prefersDark() ? "dark" : "light";
    },
    { serializer: String, parser: (value) => value }
  );

  const [page, setPage] = useLocalStorageState(
    PAGE_KEY,
    "sheet",
    {
      serializer: String,
      parser: (value) => {
        const next = value || "sheet";
        if (next === "tree") return "progression";
        return VALID_PAGES.has(next) ? next : "sheet";
      },
    }
  );

  const [lang, setLangState] = useLocalStorageState(
    LANGUAGE_KEY,
    "pt",
    { serializer: String, parser: (value) => value || "pt" }
  );

  const isDark = theme === "dark";

  useEffect(() => {
    const bg = isDark ? "#09090b" : "#f8fafc";
    try {
      document.documentElement.style.backgroundColor = bg;
      document.body.style.backgroundColor = bg;
    } catch {
      // ignore runtime style issues
    }
  }, [isDark]);

  useEffect(() => {
    const syncLanguage = (event) => setLangState(event?.detail || readText(LANGUAGE_KEY, "pt"));
    window.addEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
    return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
  }, [setLangState]);

  return (
    <div className={cx("w-full h-screen flex flex-col", isDark ? "bg-zinc-900 text-zinc-100" : "bg-slate-50 text-slate-900")}>
      <AppHeader
        page={page}
        setPage={setPage}
        isDark={isDark}
        theme={theme}
        setTheme={setTheme}
        lang={lang}
        setLang={(nextLang) => {
          setLangState(nextLang);
          applyLang(nextLang);
        }}
      />

      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className={cx("h-full grid place-items-center text-sm", isDark ? "text-zinc-400" : "text-slate-500")}>
              Carregando…
            </div>
          }
        >
          {page === "sheet" && <CharacterSheet isDark={isDark} />}
          {page === "progression" && <ProgressionPage isDark={isDark} />}
          {page === "inventory" && <InventoryManager isDark={isDark} />}
          {page === "equipment" && <EquipmentPage isDark={isDark} />}
        </Suspense>
      </div>
    </div>
  );
}
