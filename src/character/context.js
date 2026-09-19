import { createContext, useContext } from 'react';

export const CharacterContext = createContext(null);
export function useCharacter() {
  const context = useContext(CharacterContext);
  if (!context) throw new Error('CharacterProvider is required.');
  return context;
}
