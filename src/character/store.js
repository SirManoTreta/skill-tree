import { CHARACTER_KEY, applyImport, createDocument, normalizeDocument, normalizeProfile } from './schema.js';
import { SHEET_KEY, INVENTORY_KEY, WALLET_KEY, PROGRESSION_KEY, STORAGE_KEYS } from '../constants/storage.js';

export function createCharacterStore(storage) {
  let document = createDocument();
  let error = null;
  let writable = true;
  let previous = null;
  const listeners = new Set();
  try {
    const saved = storage.getItem(CHARACTER_KEY);
    if (saved) document = normalizeDocument(JSON.parse(saved));
    else {
      const read = key => { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : undefined; };
      document.profiles.dnd = normalizeProfile({ sheet: read(SHEET_KEY), items: read(INVENTORY_KEY), wallet: read(WALLET_KEY),
        progression: read(PROGRESSION_KEY), legacyTree: read(STORAGE_KEYS[0]) || read(STORAGE_KEYS[1]) }, 'dnd');
    }
  } catch {
    error = 'load';
    writable = false; // Preserve the original bytes until a valid backup is restored.
  }
  let snapshot = { document, error, canUndoImport: false };
  const publish = () => {
    snapshot = { document, error, canUndoImport: Boolean(previous) };
    listeners.forEach(listener => listener());
  };
  function persist() {
    if (!writable) return;
    try { storage.setItem(CHARACTER_KEY, JSON.stringify(document)); error = null; }
    catch { error = 'save'; }
  }
  function update(updater, preserveUndo = false) {
    if (!preserveUndo) previous = null;
    document = updater(document);
    persist();
    publish();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update,
    updateSection(section, updater, systemId) {
      update(current => {
        const targetSystem = systemId || current.activeSystem;
        const profile = current.profiles[targetSystem];
        const value = typeof updater === 'function' ? updater(profile[section]) : updater;
        return { ...current, profiles: { ...current.profiles, [targetSystem]: { ...profile, [section]: value } } };
      });
    },
    importData(parsed) {
      const next = applyImport(document, parsed); // Validate the whole import before mutation.
      previous = document;
      writable = true;
      update(() => next, true);
    },
    undoImport() {
      if (!previous) return;
      const restored = previous;
      previous = null;
      update(() => restored);
    },
    retry() { persist(); publish(); },
  };
}
