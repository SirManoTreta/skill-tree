const skill = (id, abl) => ({ id, abl });

export const SHEET_SYSTEMS = {
  dnd: {
    id: 'dnd', label: 'D&D',
    abilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
    skills: [
      skill('acrobatics', 'DEX'), skill('animalHandling', 'WIS'), skill('arcana', 'INT'),
      skill('athletics', 'STR'), skill('deception', 'CHA'), skill('history', 'INT'),
      skill('insight', 'WIS'), skill('intimidation', 'CHA'), skill('investigation', 'INT'),
      skill('medicine', 'WIS'), skill('nature', 'INT'), skill('perception', 'WIS'),
      skill('performance', 'CHA'), skill('persuasion', 'CHA'), skill('religion', 'INT'),
      skill('sleightOfHand', 'DEX'), skill('stealth', 'DEX'), skill('survival', 'WIS'),
    ],
  },
  onePiece: {
    id: 'onePiece', label: 'One Piece',
    // Attribute order and skill associations transcribed from the supplied sheet.
    abilities: ['STR', 'DEX', 'CON', 'WIS', 'PRE', 'WIL'],
    skills: [
      skill('athletics', 'STR'), skill('acrobatics', 'DEX'), skill('stealth', 'DEX'),
      skill('sleightOfHand', 'DEX'), skill('history', 'WIS'), skill('investigation', 'WIS'),
      skill('medicine', 'WIS'), skill('nature', 'WIS'), skill('survival', 'WIS'),
      skill('performance', 'PRE'), skill('deception', 'PRE'), skill('intimidation', 'PRE'),
      skill('persuasion', 'PRE'), skill('provocation', 'PRE'), skill('haki', 'WIL'),
      skill('insight', 'WIL'), skill('perception', 'WIL'), skill('supernatural', 'WIL'),
      skill('luck', 'WIL'),
    ],
  },
};

export const getSystem = (id = 'dnd') => SHEET_SYSTEMS[id] || SHEET_SYSTEMS.dnd;

export const emptyOrigin = (systemId = 'dnd') => ({
  name: '',
  abilities: Object.fromEntries(getSystem(systemId).abilities.map(key => [key, 0])),
  skills: Object.fromEntries(getSystem(systemId).skills.map(({ id }) => [id, 0])),
});

export const createDefaultSheet = (systemId = 'dnd') => ({
  systemId,
  identity: { name: '', player: '', campaign: '', classLine: '', biography: '' },
  powers: [],
  abilities: Object.fromEntries(getSystem(systemId).abilities.map(key => [key, 10])),
  saves: Object.fromEntries(getSystem(systemId).abilities.map(key => [key, 0])),
  skills: Object.fromEntries(getSystem(systemId).skills.map(({ id }) => [id, 0])),
  prof: 2, ac: 10, speed: systemId === 'onePiece' ? '9 m' : '30 ft',
  hp: { max: 10, current: 10, temp: 0 }, initAlert: false,
  autoClass: false, autoProf: false, autoAc: false,
  origins: Object.fromEntries(['species', 'background', 'class'].map(key => [key, emptyOrigin(systemId)])),
});
