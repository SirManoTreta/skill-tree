import { cx, getLabel } from "../utils/misc";
import React from "react";
import { Handle, Position } from "reactflow";
import { NODE_TYPES, CLASSES_5E } from "../constants/dnd"; // se o JSX usa esses dados


const SkillNode = React.memo(function SkillNode({ data, selected }) {
  const { name, color, type, dndClass, levelReq, prereqMode, shortText } = data || {};
  const isDark = data?.__theme === "dark";
  const badge = cx(
    "px-2 py-0.5 rounded-full border",
    isDark ? "bg-zinc-800 border-zinc-700 text-zinc-100" : "bg-slate-100 border-slate-200"
  );

  return (
    <div
      className={cx(
        "rounded-2xl shadow-lg border text-sm w-[260px] overflow-hidden",
        data?.__dim ? "opacity-40" : "",
        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-200 text-slate-900",
        selected ? "ring-2 ring-offset-2 ring-indigo-500" : ""
      )}
    >
      <div
        className="px-3 py-2 text-white flex items-center justify-between"
        style={{ background: color || "#ff0000ff" }}
      >
        <div className="font-semibold truncate pr-2">{name || "Nova Habilidade"}</div>
        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">Nv {levelReq || 1}</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className={badge}>{getLabel(NODE_TYPES, type || "Feat")}</span>
          {dndClass ? <span className={badge}>{getLabel(CLASSES_5E, dndClass)}</span> : null}
          <span className={badge}>{prereqMode === "any" ? "Pré-req: qualquer um" : "Pré-req: todos"}</span>
        </div>
        {shortText ? (
          <p className={cx("text-xs line-clamp-3", isDark ? "text-zinc-300" : "text-gray-600")}>{shortText}</p>
        ) : (
          <p className={cx("text-xs italic", isDark ? "text-zinc-500" : "text-gray-400")}>Sem resumo</p>
        )}
      </div>

      {/* Aumentar área de clique dos handles */}
      <Handle type="target" position={Position.Left} id="in-left" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="target" position={Position.Right} id="in-right" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="target" position={Position.Top} id="in-top" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="target" position={Position.Bottom} id="in-bottom" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Left} id="out-left" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Right} id="out-right" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Top} id="out-top" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
      <Handle type="source" position={Position.Bottom} id="out-bottom" className="!bg-indigo-500" style={{ width: 12, height: 12 }} />
    </div>
  );
});

export default SkillNode;