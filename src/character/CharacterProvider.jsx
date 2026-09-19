import { useState, useSyncExternalStore } from 'react';
import { CharacterContext } from './context.js';
import { createCharacterStore } from './store.js';

export default function CharacterProvider({ children, storage }) {
  const [store] = useState(() => createCharacterStore(storage || {
    getItem: key => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  }));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const profile = snapshot.document.profiles[snapshot.document.activeSystem];
  return <CharacterContext.Provider value={{ ...snapshot, profile, store,
    systemId: snapshot.document.activeSystem,
    setSystem: systemId => store.update(current => ({ ...current, activeSystem: systemId })),
    setSheet: updater => store.updateSection('sheet', updater, snapshot.document.activeSystem),
    setItems: updater => store.updateSection('items', updater, snapshot.document.activeSystem),
    setWallet: updater => store.updateSection('wallet', updater, snapshot.document.activeSystem),
    setProgression: updater => store.updateSection('progression', updater, snapshot.document.activeSystem),
  }}>{children}</CharacterContext.Provider>;
}
