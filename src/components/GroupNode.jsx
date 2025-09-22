import React from "react";
import { Handle, Position } from "reactflow";

const dotCount = (n) => Math.max(1, Math.min(12, n || 1));

export default function GroupNode({ data, selected }) {
  const isDark = data?.__theme === "dark";
  const childCount = dotCount(data?.childCount);
  const color = data?.color || "#6366f1";

  return (
    <div
      className={[
        "relative rounded-full border grid place-items-center",
        "w-[128px] h-[128px] shadow-lg",
        isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-900",
        selected ? "ring-2 ring-offset-2 ring-indigo-500" : "",
      ].join(" ")}
      title={data?.collapsed ? "Duplo clique: abrir grupo" : "Duplo clique: recolher grupo"}
    >
      {/* círculo colorido de fundo */}
      <div className="absolute inset-1 rounded-full opacity-20" style={{ background: color }} aria-hidden />

      {/* órbitas animadas (apenas quando colapsado) */}
      {data?.collapsed && (
        <div className="absolute inset-0" aria-hidden>
          {[...Array(childCount)].map((_, i) => (
            <div
              key={i}
              className="absolute inset-0 animate-[spin_6s_linear_infinite]"
              style={{ animationDelay: `-${i * 0.35}s` }}
            >
              {/* pontinho que gira */}
              <div
                className={[
                  "absolute left-1/2 -translate-x-1/2",
                  "w-3 h-3 rounded-full",
                  isDark ? "bg-zinc-200" : "bg-slate-700",
                ].join(" ")}
                style={{ top: 4 + (i % 2) * 6 }}
              />
            </div>
          ))}
        </div>
      )}

      {/* rótulo do grupo */}
      <div
        className={[
          "px-2 py-1.5 rounded-full text-[11px] font-medium",
          isDark ? "bg-zinc-800 border border-zinc-700" : "bg-white/90 border border-slate-200",
          "max-w-[128px] truncate"
        ].join(" ")}
        style={{ color }}
      >
        {data?.name || "Grupo"}
      </div>

      {/* handles: entradas (target) e saídas (source) nas 4 direções */}
      <Handle type="target" position={Position.Left}   id="in-left"   className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="target" position={Position.Right}  id="in-right"  className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="target" position={Position.Top}    id="in-top"    className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="target" position={Position.Bottom} id="in-bottom" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />

      <Handle type="source" position={Position.Left}   id="out-left"   className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Right}  id="out-right"  className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Top}    id="out-top"    className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Bottom} id="out-bottom" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
    </div>
  );
}
