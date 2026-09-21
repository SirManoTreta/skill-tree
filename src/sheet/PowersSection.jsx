import { useId, useRef, useState } from 'react';
import { useCharacter } from '../character/context';
import { cx, uid } from '../utils/misc';
import { t } from '../utils/i18n';
import './PowersSection.css';

const kinds = ['ability', 'technique', 'spell'];
const details = ['cost', 'range', 'damage', 'duration', 'requirement'];

export default function PowersSection({ isDark }) {
  const { profile, setSheet } = useCharacter();
  const powers = profile.sheet.powers;
  const titleId = useId();
  const addButton = useRef(null);
  const [focusedId, setFocusedId] = useState(null);

  const addPower = () => {
    const entry = { id: uid(), name: '', kind: 'ability', cost: '', range: '', damage: '',
      duration: '', requirement: '', description: '', grade: '', auxiliary: false, saveValue: '' };
    setFocusedId(entry.id);
    setSheet(sheet => ({ ...sheet, powers: [...sheet.powers, entry] }));
  };
  const updatePower = (id, changes) => setSheet(sheet => ({ ...sheet,
    powers: sheet.powers.map(entry => entry.id === id ? { ...entry, ...changes } : entry) }));
  const removePower = entry => {
    if (!window.confirm(t('powers.removeConfirm', { name: entry.name || t(`powers.${entry.kind}`) }))) return;
    setSheet(sheet => ({ ...sheet, powers: sheet.powers.filter(power => power.id !== entry.id) }));
    addButton.current?.focus();
  };

  return (
    <section aria-labelledby={titleId} className={cx('sheet-powers mt-4 rounded-2xl border p-3 md:p-4',
      isDark ? 'sheet-powers-dark bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200')}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={titleId} className="font-semibold">{t('powers.title')}</h2>
          <p className="mt-1 text-sm sheet-power-muted">{t('powers.hint')}</p>
        </div>
        <button ref={addButton} type="button" onClick={addPower}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
          <span aria-hidden="true">+ </span>{t('powers.add')}
        </button>
      </div>

      {powers.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm sheet-power-muted">
          {t('powers.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {powers.map((entry, index) => (
            <article key={entry.id} aria-label={t('powers.card', { number: index + 1 })} className="sheet-power-card">
              <div className="min-w-0">
                <label className="mb-3 block">
                  <span className="sr-only">{t('powers.name')}</span>
                  <input className="sheet-power-input sheet-power-name" value={entry.name}
                    autoFocus={focusedId === entry.id} placeholder={t('powers.namePlaceholder')}
                    onChange={event => updatePower(entry.id, { name: event.target.value })} />
                </label>
                <div className="space-y-1">
                  {details.map(field => (
                    <label key={field} className="flex min-w-0 items-baseline gap-2 text-sm">
                      <span className="shrink-0 font-semibold">{t(`powers.${field}`)}:</span>
                      <input className="sheet-power-input" value={entry[field]}
                        onChange={event => updatePower(entry.id, { [field]: event.target.value })} />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <label className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold">{t('type')}:</span>
                  <select className="sheet-power-input sheet-power-kind" value={entry.kind}
                    onChange={event => updatePower(entry.id, { kind: event.target.value })}>
                    {kinds.map(kind => <option key={kind} value={kind}>{t(`powers.${kind}`)}</option>)}
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1 text-sm">
                  <span className="sheet-power-muted">{t('description')}</span>
                  <textarea className="sheet-power-description flex-1" rows={5} value={entry.description}
                    placeholder={t('powers.descriptionPlaceholder')}
                    onChange={event => updatePower(entry.id, { description: event.target.value })} />
                </label>
              </div>

              <div className="sheet-power-aside">
                <label className="flex min-w-0 items-baseline gap-2 text-sm">
                  <span className="font-semibold">{t('powers.grade')}:</span>
                  <input className="sheet-power-input text-center" value={entry.grade}
                    onChange={event => updatePower(entry.id, { grade: event.target.value })} />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" className="size-4 accent-emerald-600" checked={entry.auxiliary}
                    onChange={event => updatePower(entry.id, { auxiliary: event.target.checked })} />
                  {t('powers.auxiliary')}
                </label>
                <label className="sheet-power-seal" title={t('powers.saveValue')}>
                  <span className="sr-only">{t('powers.saveValue')}</span>
                  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true">
                    <polygon points="22,3 42,3 61,22 61,42 42,61 22,61 3,42 3,22" strokeWidth="1.5" />
                    <polygon points="23,7 41,7 57,23 57,41 41,57 23,57 7,41 7,23" />
                  </svg>
                  <input type="number" inputMode="numeric" value={entry.saveValue ?? ''}
                    onChange={event => {
                      const value = event.target.value === '' ? '' : event.target.valueAsNumber;
                      if (value === '' || Number.isFinite(value)) updatePower(entry.id, { saveValue: value });
                    }} />
                </label>
                <button type="button" onClick={() => removePower(entry)}
                  aria-label={t('powers.removeLabel', { name: entry.name || t('powers.card', { number: index + 1 }) })}
                  className="sheet-power-remove rounded-md px-2 py-1.5 text-sm underline underline-offset-4">
                  {t('powers.remove')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
