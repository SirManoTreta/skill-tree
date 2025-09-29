export const download = async (filename, text, mime = "text/plain") => {
  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(href); } catch {}
      try { document.body.removeChild(a); } catch {}
    }, 0);
  } catch {}
  try {
    const dataUrl = `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
    window.open(dataUrl, "_blank");
  } catch {}
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      alert("Conteúdo exportado. Se o download não iniciou, o texto foi copiado para a área de transferência.");
    }
  } catch {}
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const cx = (...c) => c.filter(Boolean).join(" ");
export const getLabel = (list, value) => list.find((x) => x.value === value)?.label ?? value;
export const parseTags = (s) => Array.from(new Set(
  String(s || "")
    .split(/[,;|\s]+/)
    .map(t => t.trim())
    .filter(Boolean)
));

export const formatTags = (arr) =>
  (Array.isArray(arr) ? arr : parseTags(arr)).join(", ");