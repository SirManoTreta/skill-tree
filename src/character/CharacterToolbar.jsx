import { useEffect, useState } from 'react';
import { useCharacter } from './context.js';
import { SHEET_SYSTEMS } from '../sheet/systems.js';
import { readImportFile } from './schema.js';
import { cx, download } from '../utils/misc.js';
import { t } from '../utils/i18n.js';
import OfflineStatus from '../app/OfflineStatus';

export default function CharacterToolbar({ isDark }) {
  const { document, systemId, setSystem, error, store, canUndoImport } = useCharacter();
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!error) return;
    const beforeUnload = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [error]);
  async function restore(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try { store.importData(await readImportFile(file)); setMessage(t('importSuccess')); }
    catch (cause) { setMessage(`${t('importFailed')} ${cause.message}`); }
  }
  const control = cx('rounded-lg border px-3 py-2 text-sm', isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-300');
  return <div className={cx('mx-3 mb-3 rounded-xl border p-3', isDark ? 'border-zinc-800 bg-zinc-950' : 'border-slate-200 bg-white')}>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">
        <span className="block mb-1">{t('sheetType')}</span>
        <select className={control} value={systemId} onChange={event => { setSystem(event.target.value); setMessage(''); }}>
          {Object.values(SHEET_SYSTEMS).map(system => <option key={system.id} value={system.id}>{system.label}</option>)}
        </select>
      </label>
      <p className="hidden md:block text-xs opacity-70 max-w-xs self-center">{t('independentSheets')}</p>
      <button className={cx(control, 'sm:ml-auto')} onClick={() => download('hability-backup.json', JSON.stringify(document, null, 2), 'application/json')}>{t('exportAll')}</button>
      <label className={cx(control, 'cursor-pointer focus-within:ring-2 ring-indigo-500')}>
        {t('restoreBackup')}
        <input aria-label={t('restoreBackup')} className="sr-only" type="file" accept="application/json,.json" onChange={restore} />
      </label>
      {canUndoImport && <button className={control} onClick={() => { store.undoImport(); setMessage(''); }}>{t('undoImport')}</button>}
      <span className="text-xs opacity-70" role="status">{error ? t('notSaved') : t('savedLocally')}</span>
      <OfflineStatus />
    </div>
    {error && <div className="mt-3 rounded-lg border border-amber-500 p-3 text-sm" role="alert">
      {t(error === 'load' ? 'storageLoadError' : 'storageSaveError')}
      {error === 'save' && <button className="ml-3 underline" onClick={store.retry}>{t('retrySave')}</button>}
    </div>}
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
  </div>;
}
