import { cx, parseTags } from '../utils/misc';
import { t } from '../utils/i18n';
import { ITEM_CATEGORIES, ARMOR_TYPES } from '../constants/dnd';
import { MAX_IMAGE_BYTES, validateImageUrl } from '../character/schema';

export default function ItemEditor({ isDark, form, setForm, onSubmit, cancelEdit, emptyForm, tagDraft, setTagDraft, commitDraftToTags, setMessage }) {
  return (
        <form onSubmit={onSubmit} className="px-3 pb-2">
          <div className={cx("rounded-2xl border p-3 grid gap-3",
            isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200")}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{form.id ? t("editItemTitle") : t("newItemTitle")}</h3>
              <button type="button" onClick={cancelEdit} className={cx("px-2 py-1 rounded-md border text-sm",
                isDark ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800" : "bg-white border-slate-300 hover:bg-slate-50")}>
                {t("close")}
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-sm">
                {t("name")}
                <input
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex.: Espada Longa"
                />
              </label>

              <div className="text-sm">
                <label>
                {t("category")}
                <select
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t("categoryLabels." + c.value)}</option>)}
                </select>
                </label>
                {t("tagsComma")}

                <label className="text-sm">
                  Tags
                  <div
                    className={cx(
                      "mt-1 w-full border rounded-md px-2 py-1.5 flex flex-wrap gap-2 items-center",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300"
                    )}
                  >
                    {(Array.isArray(form.tags) ? form.tags : parseTags(form.tags)).map((tg, idx) => (
                      <span
                        key={`${tg}-${idx}`}
                        className={cx(
                          "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full",
                          isDark ? "bg-zinc-800" : "bg-slate-100"
                        )}
                      >
                        {tg}
                        <button
                          type="button"
                          aria-label={`Remover ${tg}`}
                          className="leading-none"
                          onClick={() =>
                            setForm(f => {
                              const arr = Array.isArray(f.tags) ? f.tags : parseTags(f.tags);
                              return { ...f, tags: arr.filter((x, i) => !(i === idx && x === tg)) };
                            })
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}

                    <input
                      className={cx(
                        "flex-1 min-w-[8ch] outline-none",
                        isDark ? "bg-zinc-900 text-zinc-100" : "bg-white text-slate-900"
                      )}
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        const k = e.key;
                        const isSep = k === "," || k === ";" || k === " " || k === "Enter" || k === "Tab";
                        if (isSep) {
                          if (k !== "Tab") e.preventDefault();
                          commitDraftToTags();
                        } else if (k === "Backspace" && tagDraft === "") {
                          // Apaga a última tag quando o draft está vazio (UX padrão de tag inputs)
                          setForm(f => {
                            const arr = Array.isArray(f.tags) ? f.tags : parseTags(f.tags);
                            if (!arr.length) return f;
                            return { ...f, tags: arr.slice(0, -1) };
                          });
                        }
                      }}
                      onBlur={() => commitDraftToTags()}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text");
                        if (/[,\s;]/.test(text)) {
                          e.preventDefault();
                          commitDraftToTags(text);
                        }
                      }}
                      placeholder="Digite e use , ; ou espaço"
                    />
                  </div>
                </label>
              </div>

              <label className="text-sm">
                {t('imageLabel')}
                <input className={cx('mt-1 w-full rounded-md border p-2', isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-300')}
                  value={form.imageUrl || ''} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" />
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={async event => {
                  const file = event.target.files?.[0]; event.target.value = '';
                  if (!file) return;
                  if (file.size > MAX_IMAGE_BYTES) { setMessage(t('imageTooLarge')); return; }
                  try {
                    const imageUrl = await new Promise((resolve, reject) => {
                      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
                    });
                    validateImageUrl(imageUrl);
                    setForm(current => ({ ...current, imageUrl }));
                  } catch { setMessage(t('imageTooLarge')); }
                }} />
                <span className="block text-xs opacity-70 mt-1">{t('imageHint')}</span>
              </label>
            </div>

            <div className="grid md:grid-cols-4 gap-3">
              <label className="text-sm">
                {t("qty")}
                <input
                  type="number" min={0}
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.qty}
                  onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm">
                {t("weight")} {`(${t("weight").includes("lb") ? "" : "(lb)"}`}
                <input
                  type="number" min={0} step="0.1"
                  className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                  value={form.weight}
                  onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm">
                {t("value")}
                <div className="flex gap-2">
                  <input
                    type="number" min={0} step="0.01"
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.valueNum}
                    onChange={(e) => setForm((f) => ({ ...f, valueNum: e.target.value }))}
                  />
                  <select
                    className={cx("mt-1 w-24 border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.valueUnit}
                    onChange={(e) => setForm((f) => ({ ...f, valueUnit: e.target.value }))}
                  >
                    <option>gp</option><option>sp</option><option>cp</option><option>pp</option><option>ep</option>
                  </select>
                </div>
              </label>

              <div className="flex gap-2 items-end">
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={form.equipped} onChange={() => setForm((f) => ({ ...f, equipped: !f.equipped }))} />
                  {t("equipped")}
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={form.attuned} onChange={() => setForm((f) => ({ ...f, attuned: !f.attuned }))} />
                  {t("attuned")}
                </label>
              </div>
            </div>

            {form.category === "armor" && (
              <div className={cx("rounded-lg p-3 grid md:grid-cols-4 gap-3",
                isDark ? "border border-zinc-800" : "border border-slate-200")}>
                <label className="text-sm">
                  {t("armorType")}
                  <select
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.armorType}
                    onChange={(e) => setForm((f) => ({ ...f, armorType: e.target.value }))}
                  >
                    {ARMOR_TYPES.map(a => <option key={a.value} value={a.value}>{t("armorLabels." + a.value)}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  {t("ac")}
                  <input
                    type="number" min={0}
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.ac}
                    onChange={(e) => setForm((f) => ({ ...f, ac: Number(e.target.value) }))}
                  />
                </label>
                <label className="text-sm">
                  {t("strReq")}
                  <input
                    type="number" min={0}
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.strReq}
                    onChange={(e) => setForm((f) => ({ ...f, strReq: Number(e.target.value) }))}
                  />
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={form.stealthDisadv} onChange={() => setForm((f) => ({ ...f, stealthDisadv: !f.stealthDisadv }))} />
                  {t("stealthDisadv")}
                </label>
              </div>
            )}


            {form.category === "weapon" && (
              <>
                <div className={cx("rounded-lg p-3 grid md:grid-cols-4 gap-3",
                  isDark ? "border border-zinc-800" : "border border-slate-200")}>
                  <label className="text-sm md:col-span-2">
                    {t("damage")}
                    <input
                      className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                      value={form.damage}
                      onChange={(e) => setForm((f) => ({ ...f, damage: e.target.value }))}
                      placeholder="ex.: 1d8 piercing"
                    />
                  </label>
                  <label className="text-sm md:col-span-2">
                    {t("range")}
                    <input
                      className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                      value={form.range}
                      onChange={(e) => setForm((f) => ({ ...f, range: e.target.value }))}
                      placeholder="ex.: 150/600 ft"
                    />
                  </label>
                  <label className="text-sm">
                    {t("ammoCurrent")}
                    <input
                      type="number" min={0}
                      className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                      value={form.ammoCurrent}
                      onChange={(e) => setForm((f) => ({ ...f, ammoCurrent: Number(e.target.value) }))}
                    />
                  </label>
                  <label className="text-sm">
                    {t("ammoMax")}
                    <input
                      type="number" min={0}
                      className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                      value={form.ammoMax}
                      onChange={(e) => setForm((f) => ({ ...f, ammoMax: Number(e.target.value) }))}
                    />
                  </label>
                </div>

                {/* Ammo Slots Editor */}
                <div className={cx("rounded-lg p-3 grid gap-3",
                  isDark ? "border border-zinc-800" : "border border-slate-200")}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{t("ammoSlots")}</div>
                    <button
                      type="button"
                      className={cx("px-2 py-1 text-xs rounded-md border",
                        isDark ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800" : "bg-white border-slate-300 hover:bg-slate-50")}
                      onClick={() => setForm((f) => {
                        const next = { ...(f.ammo || { active: 0, slots: [] }) };
                        next.slots = [...(next.slots || []), { type: "Comum", current: 0, max: 0, note: "" }];
                        if (typeof next.active !== "number") next.active = 0;
                        return { ...f, ammo: next };
                      })}
                    >
                      {t("addSlot")}
                    </button>
                  </div>

                  {Array.isArray(form?.ammo?.slots) && form.ammo.slots.length > 0 ? (
                    <div className="grid gap-2">
                      {form.ammo.slots.map((s, i) => (
                        <div key={i} className="grid md:grid-cols-12 gap-2 items-end">
                          <label className="text-[12px] md:col-span-1 flex items-center gap-2">
                            <input
                              type="radio"
                              name="activeAmmoEditor"
                              checked={Number(form?.ammo?.active || 0) === i}
                              onChange={() => setForm((f) => ({ ...f, ammo: { ...(f.ammo || { active: 0, slots: [] }), active: i } }))}
                            />
                            <span className="opacity-70">{t("active")}</span>
                          </label>
                          <label className="text-sm md:col-span-3">
                            {t("type")}
                            <input
                              className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                                isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                              value={s.type || ""}
                              onChange={(e) => setForm((f) => {
                                const next = { ...(f.ammo || { active: 0, slots: [] }) };
                                next.slots = next.slots.map((ss, idx) => idx === i ? { ...ss, type: e.target.value } : ss);
                                return { ...f, ammo: next };
                              })}
                            />
                          </label>
                          <label className="text-sm md:col-span-2">
                            {t("current")}
                            <input
                              type="number" min={0}
                              className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                                isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                              value={Number(s.current || 0)}
                              onChange={(e) => setForm((f) => {
                                const next = { ...(f.ammo || { active: 0, slots: [] }) };
                                next.slots = next.slots.map((ss, idx) => idx === i ? { ...ss, current: Math.max(0, Number(e.target.value || 0)) } : ss);
                                return { ...f, ammo: next };
                              })}
                            />
                          </label>
                          <label className="text-sm md:col-span-2">
                            {t("max")}
                            <input
                              type="number" min={0}
                              className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                                isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                              value={Number(s.max || 0)}
                              onChange={(e) => setForm((f) => {
                                const next = { ...(f.ammo || { active: 0, slots: [] }) };
                                next.slots = next.slots.map((ss, idx) => idx === i ? { ...ss, max: Math.max(0, Number(e.target.value || 0)) } : ss);
                                return { ...f, ammo: next };
                              })}
                            />
                          </label>
                          <div className="md:col-span-4 text-sm">
                            <label className="text-sm">{t("slotNote")}</label>
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                className={cx("flex-1 border rounded-md px-2 py-1.5",
                                  isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                                value={s.note || ""}
                                onChange={(e) => setForm((f) => {
                                  const next = { ...(f.ammo || { active: 0, slots: [] }) };
                                  next.slots = next.slots.map((ss, idx) => idx === i ? { ...ss, note: e.target.value } : ss);
                                  return { ...f, ammo: next };
                                })}
                              />
                              <button
                                type="button"
                                className={cx("shrink-0 px-3 py-1.5 text-xs rounded-md border",
                                  isDark ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-red-400 hover:text-red-300" : "bg-white border-slate-300 hover:bg-slate-50 text-red-600")}
                                onClick={() => setForm((f) => {
                                  const next = { ...(f.ammo || { active: 0, slots: [] }) };
                                  const before = next.slots || [];
                                  const newSlots = before.filter((_, idx) => idx !== i);
                                  const newActive = Math.min(Math.max(0, (next.active || 0) - (i <= (next.active || 0) ? 1 : 0)), Math.max(0, newSlots.length - 1));
                                  return { ...f, ammo: { active: newActive, slots: newSlots } };
                                })}
                                title={t("remove")}
                              >
                                {t("remove")}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs opacity-70">{t("noSlotsYet")}</div>
                  )}
                </div>
              </>
            )}


            {form.category === "dice" && (
              <div className={cx("rounded-lg p-3 grid md:grid-cols-3 gap-3",
                isDark ? "border border-zinc-800" : "border border-slate-200")}>
                <label className="text-sm">
                  {t("die")}
                  <input
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.die}
                    onChange={(e) => setForm((f) => ({ ...f, die: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  {t("dieCount")}
                  <input
                    type="number" min={0}
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.dieCount}
                    onChange={(e) => setForm((f) => ({ ...f, dieCount: Number(e.target.value) }))}
                  />
                </label>
                <label className="text-sm">
                  {t("label")}
                  <input
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="ex.: Inspiration, Risk Die"
                  />
                </label>
              </div>
            )}

            {form.category === "keys" && (
              <div className={cx("rounded-lg p-3 grid md:grid-cols-2 gap-3",
                isDark ? "border border-zinc-800" : "border border-slate-200")}>
                <label className="text-sm">
                  {t("keyWhere")}
                  <input
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.keyWhere}
                    onChange={(e) => setForm((f) => ({ ...f, keyWhere: e.target.value }))}
                    placeholder="Ex.: Porta da cripta"
                  />
                </label>
                <label className="text-sm">
                  {t("keyUse")}
                  <input
                    className={cx("mt-1 w-full border rounded-md px-2 py-1.5",
                      isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                    value={form.keyUse}
                    onChange={(e) => setForm((f) => ({ ...f, keyUse: e.target.value }))}
                    placeholder="Ex.: Abre cadeado grande"
                  />
                </label>
              </div>
            )}

            <label className="text-sm">
              {t("notes")}
              <textarea
                className={cx("mt-1 w-full border rounded-md px-2 py-1.5 min-h-[70px]",
                  isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-slate-300")}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Anotações, propriedades especiais, origem, etc."
              />
            </label>

            <div className="flex gap-2 justify-end">
              {form.id && (
                <button
                  type="button"
                  onClick={() => setForm(emptyForm)}
                  className="px-3 py-1.5 rounded-lg border"
                >
                  {t("clearForm")}
                </button>
              )}
              <button
                type="button"
                onClick={cancelEdit}
                className="px-3 py-1.5 rounded-lg border"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {form.id ? t("saveItem") : t("addItem")}
              </button>
            </div>
          </div>
        </form>
  );
}
