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
      URL.revokeObjectURL(href);
      a.remove();
    }, 1000);
  } catch (error) {
    alert(`Não foi possível exportar: ${error.message}`);
  }
};

export const uid = () => crypto.randomUUID();
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
