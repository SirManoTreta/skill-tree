import { t } from '../utils/i18n';
import AppTabs from "./AppTabs";
import { cx } from "../utils/misc";

export default function AppHeader({
  page,
  setPage,
  isDark,
  theme,
  setTheme,
  lang,
  setLang,
  children,
}) {
  return (
    <div className="relative z-30 p-3 flex items-center gap-2 flex-wrap">
      <div className="min-w-0 mr-2 flex-1 sm:flex-none">
        <div className="text-sm font-semibold">Hability Sheet</div>
        <div className={cx("hidden sm:block text-xs", isDark ? "text-zinc-400" : "text-slate-500")}>
          {t("appSubtitle")}
        </div>
      </div>

      <AppTabs page={page} setPage={setPage} isDark={isDark} />

      {children}

      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className={cx(
          "ml-auto px-3 py-1.5 rounded-lg border",
          isDark
            ? "bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700"
            : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
        )}
      >
        {theme === "dark" ? "🌙 " + t("dark") : "☀️ " + t("light")}
      </button>

      <select aria-label={t("language")}
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className={cx(
          "px-2 py-1.5 rounded-lg border",
          isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200"
        )}
      >
        <option value="pt">PT-BR</option>
        <option value="en">EN</option>
      </select>
    </div>
  );
}
