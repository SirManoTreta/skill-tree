import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import CharacterProvider from '../src/character/CharacterProvider';
import { applyImport, CHARACTER_KEY, createDocument, normalizeSheet } from '../src/character/schema';
import { createCharacterStore } from '../src/character/store';
import { createDefaultSheet } from '../src/sheet/systems';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const renderApp = () => render(<CharacterProvider><App /></CharacterProvider>);
const samplePower = (overrides = {}) => ({ id: 'spell', name: 'Chama arcana', kind: 'spell',
  cost: '1 espaço', range: '18 m', damage: '2d6', duration: '1 rodada', requirement: 'V, S',
  description: 'Uma chama atinge o alvo.\nTeste de resistência de Destreza.', grade: '1', auxiliary: true, saveValue: 15, ...overrides });

describe('power persistence and imports', () => {
  it('loads older sheets and backups without powers', () => {
    const legacy = createDefaultSheet();
    delete legacy.powers;
    legacy.identity.name = 'Legado';
    expect(normalizeSheet(legacy).powers).toEqual([]);
    const doc = createDocument();
    delete doc.profiles.dnd.sheet.powers;
    delete doc.profiles.onePiece.sheet.powers;
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(doc));
    const store = createCharacterStore(localStorage);
    expect(store.getSnapshot().error).toBeNull();
    expect(store.getSnapshot().document.profiles.onePiece.sheet.powers).toEqual([]);
    expect(applyImport(doc, legacy).profiles.dnd.sheet.identity.name).toBe('Legado');
    const legacyPower = samplePower();
    delete legacyPower.saveValue;
    expect(normalizeSheet({ ...legacy, powers: [legacyPower] }).powers[0].saveValue).toBe('');
  });

  it.each(['dnd', 'onePiece'])('round-trips all fields in %s sheet and full backups', systemId => {
    const doc = createDocument();
    doc.profiles[systemId].sheet.powers = [samplePower()];
    const whole = applyImport(createDocument(), JSON.parse(JSON.stringify(doc)));
    const individual = applyImport(createDocument(), JSON.parse(JSON.stringify(doc.profiles[systemId].sheet)));
    expect(whole.profiles[systemId].sheet.powers).toEqual([samplePower()]);
    expect(individual.profiles[systemId].sheet.powers).toEqual([samplePower()]);
  });

  it.each([null, {}, [null], [{ name: 2 }], [{ kind: 'unknown' }], [{ auxiliary: 'false' }], [{ saveValue: 'invalid' }],
    [{ id: '' }], [{ id: 'same' }, { id: 'same' }]].map(powers => [powers]))('rejects malformed powers before changing data: %j', powers => {
    const store = createCharacterStore(localStorage);
    const before = store.getSnapshot().document;
    expect(() => store.importData({ ...createDefaultSheet(), powers })).toThrow();
    expect(store.getSnapshot().document).toBe(before);
    expect(localStorage.getItem(CHARACTER_KEY)).toBeNull();
  });
});

describe('power cards on the sheet', () => {
  it('edits all fields, preserves focus, and retains independent cards across tabs, systems and reloads', async () => {
    const user = userEvent.setup();
    const mounted = renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar habilidade, técnica ou magia' }));
    const card = within(screen.getByRole('article', { name: 'Recurso 1' }));
    const name = card.getByRole('textbox', { name: 'Nome do recurso' });
    expect(document.activeElement).toBe(name);
    await user.type(name, 'Chama arcana');
    expect(document.activeElement).toBe(name);
    fireEvent.change(card.getByRole('combobox', { name: 'Tipo:' }), { target: { value: 'spell' } });
    const fields = { 'Custo:': '1 espaço', 'Alcance:': '18 m', 'Dano:': '2d6', 'Duração:': '1 rodada',
      'Requisito:': 'V, S', 'Grau:': '1', 'Descrição': samplePower().description };
    for (const [label, value] of Object.entries(fields)) {
      fireEvent.change(card.getByRole('textbox', { name: label, exact: true }), { target: { value } });
    }
    fireEvent.click(card.getByRole('checkbox', { name: 'Auxiliar' }));
    const saveValue = card.getByRole('spinbutton', { name: 'Salvaguarda', exact: true });
    expect(saveValue.value).toBe('');
    await user.type(saveValue, '15');
    expect(saveValue.value).toBe('15');
    expect(document.activeElement).toBe(saveValue);
    fireEvent.click(screen.getByRole('button', { name: '📦 Inventário' }));
    fireEvent.click(screen.getByRole('button', { name: '📝 Ficha' }));
    expect((await screen.findByRole('textbox', { name: 'Nome do recurso' })).value).toBe('Chama arcana');

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de ficha' }), { target: { value: 'onePiece' } });
    expect(screen.queryByRole('article')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar habilidade, técnica ou magia' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do recurso' }), { target: { value: 'Golpe elástico' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo:' }), { target: { value: 'technique' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Salvaguarda', exact: true }), { target: { value: '12' } });
    const saved = JSON.parse(localStorage.getItem(CHARACTER_KEY));
    expect(saved.profiles.dnd.sheet.powers).toEqual([samplePower({ id: expect.any(String) })]);
    expect(saved.profiles.onePiece.sheet.powers[0]).toMatchObject({ name: 'Golpe elástico', kind: 'technique', saveValue: 12 });

    mounted.unmount(); renderApp();
    expect((await screen.findByRole('textbox', { name: 'Nome do recurso' })).value).toBe('Golpe elástico');
    expect(screen.getByRole('spinbutton', { name: 'Salvaguarda', exact: true }).value).toBe('12');
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de ficha' }), { target: { value: 'dnd' } });
    expect((await screen.findByRole('textbox', { name: 'Nome do recurso' })).value).toBe('Chama arcana');
    expect(screen.getByRole('checkbox', { name: 'Auxiliar' }).checked).toBe(true);
    const restoredSave = screen.getByRole('spinbutton', { name: 'Salvaguarda', exact: true });
    expect(restoredSave.value).toBe('15');
    await user.clear(restoredSave);
    expect(JSON.parse(localStorage.getItem(CHARACTER_KEY)).profiles.dnd.sheet.powers[0].saveValue).toBe('');
    await user.type(restoredSave, '0');
    expect(createCharacterStore(localStorage).getSnapshot().document.profiles.dnd.sheet.powers[0].saveValue).toBe(0);
  });

  it('removes only the selected card after confirmation and persists the remaining cards', async () => {
    const doc = createDocument();
    doc.profiles.dnd.sheet.powers = [samplePower(), samplePower({ id: 'second', name: 'Escudo' })];
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(doc));
    renderApp();
    const remove = await screen.findByRole('button', { name: 'Remover Chama arcana' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(remove);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    confirm.mockReturnValue(true);
    fireEvent.click(remove);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Nome do recurso' }).value).toBe('Escudo');
    expect(JSON.parse(localStorage.getItem(CHARACTER_KEY)).profiles.dnd.sheet.powers.map(entry => entry.id)).toEqual(['second']);
    fireEvent.click(screen.getByRole('button', { name: 'Remover Escudo' }));
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getByText(/Nenhuma habilidade, técnica ou magia cadastrada/)).toBeTruthy();
  });
});
