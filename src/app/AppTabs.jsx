import { cx } from "../utils/misc";
import { t } from "../utils/i18n";

const TABS = [
  { id: "sheet", icon: "📝", label: () => t("sheet") },
  { id: "progression", icon: "🃏", label: () => t("progression") },
  { id: "inventory", icon: "📦", label: () => t("inventory") },
  { id: "equipment", icon: "🛡️", label: () => t("equipment") },
];

export default function AppTabs({ page, setPage, isDark }) {
  return (
    <div className="order-3 sm:order-none w-full sm:w-auto flex items-center gap-2 overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setPage(tab.id)}
          className={cx(
            "shrink-0 px-3 py-1.5 rounded-lg border shadow",
            page === tab.id
              ? "bg-indigo-600 text-white border-indigo-600"
              : isDark
                ? "bg-zinc-900/90 border-zinc-700 hover:bg-zinc-800"
                : "bg-white/90 border-slate-200 hover:bg-slate-50"
          )}
        >
          {tab.icon} {tab.label()}
        </button>
      ))}
    </div>
  );
}
