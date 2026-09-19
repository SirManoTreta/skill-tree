export const EQUIPMENT_SLOTS = [
  'helmet', 'amulet', 'ring1', 'ring2', 'weaponMain', 'armorChest', 'offhand', 'belt', 'gloves', 'boots',
];

export function canDropInSlot(item, slotId) {
  if (!item || Number(item.qty ?? 1) <= 0) return false;
  const tags = (Array.isArray(item.tags) ? item.tags : [])
    .map(tag => String(tag).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase());
  const has = (...values) => values.some(value => tags.includes(value));
  const weapon = item.category === 'weapon' || has('weapon', 'arma');
  const shield = (item.category === 'armor' && item.armorType === 'shield') || has('shield', 'escudo');
  switch (slotId) {
    case 'weaponMain': return weapon;
    case 'offhand': return weapon || shield;
    case 'armorChest': return !shield && (item.category === 'armor' || has('armadura', 'armor', 'roupa'));
    case 'helmet': return has('helm', 'helmet', 'capacete', 'chapeu');
    case 'gloves': return has('glove', 'gloves', 'gauntlet', 'luva', 'manopla', 'bracadeira');
    case 'boots': return has('boot', 'boots', 'bota', 'sapato');
    case 'belt': return has('belt', 'cinto');
    case 'amulet': return has('amulet', 'amuleto');
    case 'ring1': case 'ring2': return has('ring', 'anel', 'alianca');
    default: return false;
  }
}

export function equipItem(items, id, slot) {
  const item = items.find(entry => entry.id === id);
  if (!item || (slot && !canDropInSlot(item, slot))) return items;
  return items.map(entry => {
    if (entry.id === id) return { ...entry, slot: slot || null, equipped: Boolean(slot) };
    if (slot && entry.slot === slot) return { ...entry, slot: null, equipped: false };
    return entry;
  });
}

export function armorClass(items, dexterityModifier) {
  const armor = items.find(item => item.slot === 'armorChest' && item.equipped);
  const shield = items.find(item => item.slot === 'offhand' && item.equipped && item.armorType === 'shield');
  const dex = armor?.armorType === 'heavy' ? 0 : armor?.armorType === 'medium'
    ? Math.min(2, dexterityModifier) : dexterityModifier;
  return Number(armor?.ac || 10) + dex + Number(shield?.ac || 0);
}
