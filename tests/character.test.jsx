import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import CharacterProvider from '../src/character/CharacterProvider';
import CurrencyPurse from '../src/inventory/CurrencyPurse';
import ProgressionPage from '../src/progression/ProgressionPage';
import { createCharacterStore } from '../src/character/store';
import { applyImport, CHARACTER_KEY, createDocument, normalizeItems, normalizeProgression, sheetTotals, validateImageUrl } from '../src/character/schema';
import { createDefaultSheet, SHEET_SYSTEMS } from '../src/sheet/systems';
import { canDropInSlot, equipItem, armorClass } from '../src/inventory/equipment';
import { SHEET_KEY, INVENTORY_KEY, WALLET_KEY, PROGRESSION_KEY } from '../src/constants/storage';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const renderApp = () => render(<CharacterProvider><App /></CharacterProvider>);

describe('character persistence and backups', () => {
  it('migrates the legacy sheet, inventory, wallet and progression without deleting originals', () => {
    const sheet = createDefaultSheet();
    sheet.identity.name = 'Legado';
    localStorage.setItem(SHEET_KEY, JSON.stringify(sheet));
    localStorage.setItem(INVENTORY_KEY, JSON.stringify([{ id: 'sword', name: 'Espada', category: 'weapon', tags: 'arma' }]));
    localStorage.setItem(WALLET_KEY, JSON.stringify({ gp: 123 }));
    localStorage.setItem(PROGRESSION_KEY, JSON.stringify({ classes: [{ classId: 'fighter', level: 5 }] }));
    const store = createCharacterStore(localStorage);
    const profile = store.getSnapshot().document.profiles.dnd;
    expect(profile.sheet.identity.name).toBe('Legado');
    expect(profile.items[0].tags).toEqual(['arma']);
    expect(profile.wallet.gp).toBe(123);
    expect(profile.progression.classes[0].level).toBe(5);
    store.updateSection('wallet', wallet => ({ ...wallet, cp: 1 }));
    expect(localStorage.getItem(SHEET_KEY)).toBe(JSON.stringify(sheet));
    expect(JSON.parse(localStorage.getItem(CHARACTER_KEY)).profiles.dnd.wallet.gp).toBe(123);
  });

  it('round-trips all profiles including slots and custom cards', () => {
    const doc = createDocument();
    doc.profiles.onePiece.sheet.abilities.WIL = 18;
    doc.profiles.onePiece.wallet.gp = 350;
    doc.profiles.dnd.items = [{ id: 'sword', name: 'Espada', category: 'weapon', qty: 1, slot: 'weaponMain', equipped: true }];
    doc.profiles.onePiece.progression.customCards = [{ id: 'haki', title: 'Haki', level: 3 }];
    const restored = applyImport(createDocument(), JSON.parse(JSON.stringify(doc)));
    expect(restored.profiles.onePiece.sheet.abilities.WIL).toBe(18);
    expect(restored.profiles.onePiece.progression.customCards[0].title).toBe('Haki');
    expect(restored.profiles.dnd.items[0].slot).toBe('weaponMain');
    expect(restored.profiles.onePiece.wallet.gp).toBe(350);
  });

  it('restores a v2 general backup into D&D even while One Piece is active', () => {
    const doc = createDocument(); doc.activeSystem = 'onePiece';
    const sheet = createDefaultSheet(); delete sheet.systemId; sheet.identity.name = 'Backup';
    const restored = applyImport(doc, { meta: { version: 2 }, sheet, inventory: { items: [] }, wallet: { gp: 40 }, __allLocalStorage: { unrelated: 'never restore' } });
    expect(restored.activeSystem).toBe('dnd');
    expect(restored.profiles.dnd.sheet.identity.name).toBe('Backup');
    expect(restored.profiles.dnd.wallet.gp).toBe(40);
    expect(localStorage.getItem('unrelated')).toBeNull();
  });

  it('rejects malformed imports before modifying state and supports undo', () => {
    const store = createCharacterStore(localStorage);
    const before = store.getSnapshot().document;
    expect(() => store.importData({ abilities: null })).toThrow();
    expect(() => store.importData({ ...createDefaultSheet(), skills: null })).toThrow();
    expect(store.getSnapshot().document).toBe(before);
    const sheet = createDefaultSheet(); sheet.identity.name = 'Imported';
    store.importData(sheet);
    expect(store.getSnapshot().document.profiles.dnd.sheet.identity.name).toBe('Imported');
    store.undoImport();
    expect(store.getSnapshot().document.profiles.dnd.sheet.identity.name).toBe('');
  });

  it('keeps unsaved changes in memory and reports quota errors', () => {
    const storage = { getItem: () => null, setItem: vi.fn(() => { throw new Error('QuotaExceededError'); }) };
    const store = createCharacterStore(storage);
    store.updateSection('wallet', wallet => ({ ...wallet, gp: 42 }));
    expect(store.getSnapshot().error).toBe('save');
    expect(store.getSnapshot().document.profiles.dnd.wallet.gp).toBe(42);
    storage.setItem.mockImplementation(() => {});
    store.retry();
    expect(store.getSnapshot().error).toBeNull();
  });

  it('keeps an import in its original profile when the selected type changes during reading', () => {
    const store = createCharacterStore(localStorage);
    store.update(current => ({ ...current, activeSystem: 'onePiece' }));
    store.updateSection('items', [{ id: 'imported', name: 'Espada' }], 'dnd');
    expect(store.getSnapshot().document.profiles.dnd.items[0].name).toBe('Espada');
    expect(store.getSnapshot().document.profiles.onePiece.items).toEqual([]);
  });

  it('does not overwrite corrupted stored data with defaults', () => {
    localStorage.setItem(CHARACTER_KEY, '{broken');
    const store = createCharacterStore(localStorage);
    store.updateSection('wallet', { gp: 5 });
    expect(store.getSnapshot().error).toBe('load');
    expect(localStorage.getItem(CHARACTER_KEY)).toBe('{broken');
  });

  it('validates nested progression and inventory data', () => {
    expect(() => normalizeProgression({ classes: [null] })).toThrow();
    expect(() => normalizeProgression({ history: [{ cardTitles: {} }] })).toThrow();
    expect(() => normalizeItems([{ id: 'a' }, { id: 'a' }])).toThrow();
    expect(() => validateImageUrl('javascript:alert(1)')).toThrow();
    expect(() => validateImageUrl('data:image/png;base64,' + 'a'.repeat(750000))).toThrow();
  });
});

describe('equipment', () => {
  it('accepts built-in templates by category and does not confuse armor with a weapon', () => {
    expect(normalizeItems([{ id: 'ring', tags: 'anel', slot: 'ring1', equipped: true }])[0].slot).toBe('ring1');
    expect(canDropInSlot({ category: 'weapon', tags: ['finesse', 'light'] }, 'weaponMain')).toBe(true);
    expect(canDropInSlot({ category: 'weapon', tags: ['two-handed', 'ammunition'] }, 'weaponMain')).toBe(true);
    expect(canDropInSlot({ category: 'armor', armorType: 'heavy' }, 'armorChest')).toBe(true);
    expect(canDropInSlot({ category: 'armor', tags: ['armadura'] }, 'weaponMain')).toBe(false);
    expect(canDropInSlot({ category: 'armor', armorType: 'shield' }, 'armorChest')).toBe(false);
  });
  it('keeps a single occupant and calculates armor with an optional shield', () => {
    const items = [{ id: 'a', category: 'weapon', slot: 'weaponMain', equipped: true }, { id: 'b', category: 'weapon' }];
    const equipped = equipItem(items, 'b', 'weaponMain');
    expect(equipped[0].equipped).toBe(false);
    expect(equipped[1].slot).toBe('weaponMain');
    expect(armorClass([{ category: 'armor', armorType: 'heavy', ac: 16, slot: 'armorChest', equipped: true }, { armorType: 'shield', ac: 2, slot: 'offhand', equipped: true }], 4)).toBe(18);
  });
});

describe('sheet interactions', () => {
  it('preserves an edit when immediately switching tabs', async () => {
    renderApp();
    const name = await screen.findByRole('textbox', { name: 'Personagem' });
    fireEvent.change(name, { target: { value: 'Persistente' } });
    fireEvent.click(screen.getByRole('button', { name: '📦 Inventário' }));
    fireEvent.click(screen.getByRole('button', { name: '📝 Ficha' }));
    expect((await screen.findByRole('textbox', { name: 'Personagem' })).value).toBe('Persistente');
    expect(JSON.parse(localStorage.getItem(CHARACTER_KEY)).profiles.dnd.sheet.identity.name).toBe('Persistente');
  });

  it('switches attributes and skills to the PDF model, retaining each sheet after reload', async () => {
    const mounted = renderApp();
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Inteligência', exact: true }), { target: { value: '17' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de ficha' }), { target: { value: 'onePiece' } });
    expect(screen.queryByRole('spinbutton', { name: 'Inteligência', exact: true })).toBeNull();
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Vontade', exact: true }), { target: { value: '18' } });
    expect(screen.getByRole('spinbutton', { name: 'Presença', exact: true })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Haki (VON)' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'História (SAB)' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Intuição (VON)' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Arcanismo/ })).toBeNull();
    mounted.unmount(); renderApp();
    expect((await screen.findByRole('spinbutton', { name: 'Vontade', exact: true })).value).toBe('18');
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de ficha' }), { target: { value: 'dnd' } });
    expect((await screen.findByRole('spinbutton', { name: 'Inteligência', exact: true })).value).toBe('17');
    expect(SHEET_SYSTEMS.onePiece.skills).toHaveLength(19);
    const sheet = createDefaultSheet('onePiece'); sheet.abilities.WIL = 18;
    expect(sheetTotals(sheet).modifiers.WIL).toBe(4);
  });

  it('allows typing multiple digits into coins without losing focus', async () => {
    render(<CharacterProvider><CurrencyPurse /></CharacterProvider>);
    const user = userEvent.setup();
    const input = screen.getByRole('spinbutton', { name: 'Ouro gp' });
    await user.clear(input); await user.type(input, '123');
    expect(input.value).toBe('123');
    expect(document.activeElement).toBe(input);
  });

  it('adds the class currently displayed after the previous option is removed', async () => {
    render(<CharacterProvider><ProgressionPage /></CharacterProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Criar progressão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar multiclasse' }));
    const selector = screen.getByRole('combobox', { name: 'Adicionar multiclasse' });
    expect(selector.value).toBe('cleric');
    expect(within(selector).getByRole('option', { name: 'Clérigo' }).selected).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar multiclasse' }));
    const saved = JSON.parse(localStorage.getItem(CHARACTER_KEY));
    expect(saved.profiles.dnd.progression.classes.map(entry => entry.classId)).toEqual(['barbarian', 'bard', 'cleric']);
  });
});
