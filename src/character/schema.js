import { createDefaultSheet, getSystem, SHEET_SYSTEMS } from '../sheet/systems.js';
import { canDropInSlot, EQUIPMENT_SLOTS } from '../inventory/equipment.js';

export const CHARACTER_KEY = 'hability-characters-v3';
export const BACKUP_VERSION = 3;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 512 * 1024;
export const defaultProgression = () => ({ version: 1, level: 1, classes: [], history: [], customCards: [] });

function record(value, path, fallback = {}) {
  if (value === undefined) return fallback;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: objeto inválido.`);
  return value;
}
function list(value, path) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${path}: lista inválida.`);
  return value;
}
function number(value, fallback, path, min = 0, max = 1000000000) {
  if (value === undefined) return fallback;
  const result = typeof value === 'boolean' ? Number(value) : value;
  if (typeof result !== 'number' || !Number.isFinite(result) || result < min || result > max) {
    throw new Error(`${path}: número inválido.`);
  }
  return result;
}
function string(value, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw new Error('Texto inválido no arquivo.');
  return value;
}
function numberMap(value, defaults, path, min, max) {
  const source = record(value, path);
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [
    key, number(source[key], fallback, `${path}.${key}`, min, max),
  ]));
}
const id = () => crypto.randomUUID();

export function normalizeSheet(value, systemId = 'dnd') {
  const source = record(value, 'Ficha');
  if (!SHEET_SYSTEMS[systemId] || (source.systemId && source.systemId !== systemId)) throw new Error('Tipo de ficha incompatível.');
  const base = createDefaultSheet(systemId);
  const identity = record(source.identity, 'Identidade');
  const hp = record(source.hp, 'PV');
  const origins = record(source.origins, 'Origens');
  return {
    ...base,
    identity: Object.fromEntries(Object.entries(base.identity).map(([key, value]) => [key, string(identity[key], value)])),
    abilities: numberMap(source.abilities, base.abilities, 'Atributos', 1, 30),
    saves: numberMap(source.saves, base.saves, 'Salvaguardas', 0, 9),
    skills: numberMap(source.skills, base.skills, 'Perícias', 0, 9),
    prof: number(source.prof, base.prof, 'Proficiência', 1, 10),
    ac: number(source.ac, base.ac, 'CA', 0, 100),
    speed: string(source.speed, base.speed),
    hp: { max: number(hp.max, 10, 'PV máximo'), current: number(hp.current, 10, 'PV atual'), temp: number(hp.temp, 0, 'PV temporário') },
    initAlert: source.initAlert === true,
    autoClass: source.autoClass === true, autoProf: source.autoProf === true, autoAc: source.autoAc === true,
    origins: Object.fromEntries(Object.entries(base.origins).map(([key, defaults]) => {
      const origin = record(origins[key], `Origem ${key}`);
      return [key, { name: string(origin.name),
        abilities: numberMap(origin.abilities, defaults.abilities, 'Bônus de atributo', -30, 30),
        skills: numberMap(origin.skills, defaults.skills, 'Bônus de perícia', 0, 9) }];
    })),
  };
}

export function validateImageUrl(value = '') {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 100) {
    throw new Error('Imagem muito grande. Use um arquivo de até 512 KB ou uma URL.');
  }
  if (!/^https?:\/\//i.test(value) && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(value)) {
    throw new Error('Use uma URL HTTP(S) ou uma imagem PNG, JPEG, GIF ou WebP.');
  }
  return value;
}

export function normalizeItems(value) {
  const ids = new Set();
  const slots = new Set();
  return list(value, 'Inventário').map((raw) => {
    const item = record(raw, 'Item');
    const itemId = string(item.id, id());
    if (ids.has(itemId)) throw new Error('O inventário contém identificadores repetidos.');
    ids.add(itemId);
    const tags = typeof item.tags === 'string' ? item.tags.split(/[,;|\s]+/).filter(Boolean) : list(item.tags, 'Tags').map(tag => string(tag));
    const taggedItem = { ...item, tags };
    const requestedSlot = EQUIPMENT_SLOTS.includes(item.slot) ? item.slot : null;
    const slot = requestedSlot && !slots.has(requestedSlot) && canDropInSlot(taggedItem, requestedSlot)
      ? requestedSlot
      : item.equipped === true ? EQUIPMENT_SLOTS.find(key => !slots.has(key) && canDropInSlot(taggedItem, key)) || null : null;
    if (slot) slots.add(slot);
    const normalized = { ...item, id: itemId, name: string(item.name), category: string(item.category, 'misc'),
      tags, qty: number(item.qty, 1, 'Quantidade'), weight: number(item.weight, 0, 'Peso'),
      valueGp: number(item.valueGp, 0, 'Valor'), ac: number(item.ac, 0, 'CA'),
      slot, equipped: Boolean(slot), imageUrl: string(item.imageUrl) };
    if (item.ammo !== undefined && item.ammo !== null) {
      const ammo = record(item.ammo, 'Munição');
      const ammoSlots = list(ammo.slots, 'Munições').map(rawSlot => {
        const entry = record(rawSlot, 'Munição');
        const max = number(entry.max, 0, 'Munição máxima');
        return { type: string(entry.type, 'Comum'), note: string(entry.note), max,
          current: Math.min(max, number(entry.current, 0, 'Munição atual')) };
      });
      normalized.ammo = { active: Math.min(Math.max(0, ammoSlots.length - 1), Math.floor(number(ammo.active, 0, 'Munição ativa'))), slots: ammoSlots };
    }
    return normalized;
  });
}

export function normalizeProgression(value) {
  const source = record(value, 'Progressão');
  const classIds = new Set();
  const classes = list(source.classes, 'Classes').map(raw => {
    const entry = record(raw, 'Classe');
    const classId = string(entry.classId);
    if (!classId || classIds.has(classId)) throw new Error('Classe ausente ou repetida.');
    classIds.add(classId);
    const level = number(entry.level, 1, 'Nível', 1, 100);
    if (!Number.isInteger(level)) throw new Error('O nível deve ser inteiro.');
    return { id: string(entry.id, id()), classId, level, subclass: string(entry.subclass) };
  });
  return { version: 1, level: number(source.level, 1, 'Nível', 1, 100), classes,
    history: list(source.history, 'Histórico').map(raw => {
      const entry = record(raw, 'Histórico');
      return { ...entry, id: string(entry.id, id()), classLabel: string(entry.classLabel),
        level: number(entry.level, 1, 'Nível', 1, 100),
        cardTitles: list(entry.cardTitles, 'Títulos').map(title => string(title)),
        cardIds: list(entry.cardIds, 'Cards').map(cardId => string(cardId)) };
    }),
    customCards: list(source.customCards, 'Cards').map(raw => {
      const entry = record(raw, 'Card');
      return { id: string(entry.id, id()), title: string(entry.title), sourceLabel: string(entry.sourceLabel),
        summary: string(entry.summary), details: string(entry.details), kind: string(entry.kind, 'custom'),
        level: number(entry.level, 1, 'Nível', 1, 100), tags: list(entry.tags, 'Tags').map(tag => string(tag)) };
    }),
  };
}

export function createProfile(systemId = 'dnd') {
  return { sheet: createDefaultSheet(systemId), items: [], wallet: { pp: 0, gp: 0, sp: 0, cp: 0 }, progression: defaultProgression(), legacyTree: { nodes: [], edges: [] } };
}

export function normalizeProfile(value, systemId) {
  const source = record(value, 'Personagem');
  const wallet = record(source.wallet, 'Moedas');
  const tree = record(source.legacyTree, 'Árvore antiga');
  return { sheet: normalizeSheet(source.sheet, systemId), items: normalizeItems(source.items),
    wallet: Object.fromEntries(['pp', 'gp', 'sp', 'cp'].map(key => [key, number(wallet[key], 0, 'Moedas')])),
    progression: normalizeProgression(source.progression),
    legacyTree: { nodes: list(tree.nodes, 'Nós'), edges: list(tree.edges, 'Ligações') } };
}

export function createDocument() {
  return { version: BACKUP_VERSION, activeSystem: 'dnd', profiles: { dnd: createProfile('dnd'), onePiece: createProfile('onePiece') } };
}

export function normalizeDocument(value) {
  const source = record(value, 'Backup');
  if (source.version !== BACKUP_VERSION || !SHEET_SYSTEMS[source.activeSystem]) throw new Error('Versão ou tipo de backup incompatível.');
  const profiles = record(source.profiles, 'Fichas');
  if (Object.keys(SHEET_SYSTEMS).some(key => !profiles[key]?.sheet)) throw new Error('O backup completo deve conter as duas fichas.');
  return { version: BACKUP_VERSION, activeSystem: source.activeSystem,
    profiles: Object.fromEntries(Object.keys(SHEET_SYSTEMS).map(key => [key, normalizeProfile(profiles[key], key)])) };
}

export function applyImport(current, parsed) {
  const source = record(parsed, 'Arquivo');
  if (source.profiles) return normalizeDocument(source);
  const systemId = source.sheet?.systemId || source.systemId || 'dnd';
  if (!SHEET_SYSTEMS[systemId]) throw new Error('Tipo de ficha desconhecido.');
  let profile = current.profiles[systemId];
  if (source.sheet && source.meta) {
    if (source.meta.version !== 2) throw new Error('Versão de backup incompatível.');
    // Read only app-owned fields. Never restore the old __allLocalStorage snapshot.
    profile = normalizeProfile({ sheet: source.sheet, items: source.inventory?.items, wallet: source.wallet,
      progression: source.progression, legacyTree: source.tree }, systemId);
  } else if (source.abilities) {
    profile = { ...profile, sheet: normalizeSheet(source, systemId) };
  } else {
    throw new Error('Selecione uma ficha ou um backup completo válido.');
  }
  return { ...current, activeSystem: systemId, profiles: { ...current.profiles, [systemId]: profile } };
}

export async function readImportFile(file) {
  if (!file || file.size > MAX_IMPORT_BYTES) throw new Error('O arquivo deve ter até 10 MB.');
  return JSON.parse(await file.text());
}

export function sheetTotals(sheet) {
  const system = getSystem(sheet.systemId);
  const abilities = Object.fromEntries(system.abilities.map(key => {
    const bonus = Object.values(sheet.origins).reduce((sum, origin) => sum + Number(origin.abilities[key] || 0), 0);
    return [key, Math.max(1, Math.min(30, sheet.abilities[key] + bonus))];
  }));
  return { abilities, modifiers: Object.fromEntries(system.abilities.map(key => [key, Math.floor((abilities[key] - 10) / 2)])) };
}
