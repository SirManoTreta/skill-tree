export const CLASS_OPTIONS = [
  { value: "barbarian", label: "Bárbaro" },
  { value: "bard", label: "Bardo" },
  { value: "cleric", label: "Clérigo" },
  { value: "druid", label: "Druida" },
  { value: "fighter", label: "Guerreiro" },
  { value: "monk", label: "Monge" },
  { value: "paladin", label: "Paladino" },
  { value: "ranger", label: "Patrulheiro" },
  { value: "rogue", label: "Ladino" },
  { value: "sorcerer", label: "Feiticeiro" },
  { value: "warlock", label: "Bruxo" },
  { value: "wizard", label: "Mago" },
  { value: "artificer", label: "Artífice" },
  { value: "gunslinger", label: "Pistoleiro" },
];

const asiCard = (classId) => ({
  id: `${classId}-asi-4`,
  level: 4,
  title: "Aumento de Atributo",
  kind: "choice",
  summary: "Escolha entre melhorar atributos ou pegar um talento, conforme a mesa usar.",
  details: "Este card marca o ponto de evolução em que o personagem ajusta sua build. Serve bem como lembrete visual dentro da ficha.",
  tags: ["Talento", "Escolha"],
});

const subclassCard = (classId) => ({
  id: `${classId}-subclass`,
  level: 3,
  title: "Subclasse / Especialização",
  kind: "choice",
  summary: "Escolha a trilha, juramento, domínio ou arquétipo que define o estilo da classe.",
  details: "Use o campo de subclasse na progressão para registrar a escolha. Depois, você pode complementar com cards customizados da mesa ou do seu homebrew.",
  tags: ["Subclasse", "Escolha"],
});

export const CARD_CATALOG = {
  barbarian: [
    { id: "barbarian-rage", level: 1, title: "Fúria", kind: "resource", summary: "Entre em fúria para ganhar dano extra e resistência física.", details: "Card central do Bárbaro. Pode ser usado como lembrete de usos por descanso e do estado ativo do personagem.", tags: ["Recurso", "Combate"] },
    { id: "barbarian-unarmored-defense", level: 1, title: "Defesa sem Armadura", kind: "passive", summary: "Sua resistência natural substitui armaduras pesadas em várias builds.", details: "Bom para builds mais agressivas ou tribais. Pode ficar equipado como card passivo.", tags: ["Passiva"] },
    { id: "barbarian-reckless", level: 2, title: "Ataque Temerário", kind: "action", summary: "Ataque com vantagem, mas abrindo sua guarda.", details: "Ótimo card para lembrar a troca de risco por agressividade durante o turno.", tags: ["Ação", "Ofensivo"] },
    { id: "barbarian-danger-sense", level: 2, title: "Sentido de Perigo", kind: "passive", summary: "Reflexos afiados contra ameaças visíveis.", details: "Funciona bem como lembrete passivo ao lado do card de salvaguardas.", tags: ["Passiva", "Defesa"] },
    subclassCard("barbarian"),
    asiCard("barbarian"),
    { id: "barbarian-fast-movement", level: 5, title: "Movimento Rápido", kind: "passive", summary: "Seu deslocamento aumenta quando não está preso a armaduras pesadas.", details: "Ajuda a lembrar picos de mobilidade do Bárbaro conforme a ficha cresce.", tags: ["Passiva", "Mobilidade"] },
  ],
  bard: [
    { id: "bard-inspiration", level: 1, title: "Inspiração de Bardo", kind: "resource", summary: "Conceda dados de inspiração a aliados.", details: "Use o card como rastreador narrativo e mecânico do recurso central da classe.", tags: ["Recurso", "Suporte"] },
    { id: "bard-spellcasting", level: 1, title: "Conjuração", kind: "passive", summary: "Você ganha acesso às magias e truques de bardo.", details: "Bom como card fixo na seção de progressão para ligar a ficha às magias aprendidas.", tags: ["Magia"] },
    { id: "bard-jack-of-all-trades", level: 2, title: "Jack of All Trades", kind: "passive", summary: "Você adiciona parte da sua proficiência em testes onde não é treinado.", details: "Excelente lembrete para interações fora de combate e testes improvisados.", tags: ["Passiva", "Perícias"] },
    { id: "bard-song-of-rest", level: 2, title: "Canção de Descanso", kind: "rest", summary: "Aliados recuperam melhor o fôlego durante pausas curtas.", details: "Funciona bem como card de apoio da equipe.", tags: ["Descanso", "Suporte"] },
    subclassCard("bard"),
    asiCard("bard"),
    { id: "bard-inspiration-refresh", level: 5, title: "Inspiração Revigorada", kind: "passive", summary: "Sua inspiração passa a encaixar melhor na rotina do grupo.", details: "Use como marco do momento em que a classe fica mais constante em campanha.", tags: ["Passiva", "Recurso"] },
  ],
  cleric: [
    { id: "cleric-spellcasting", level: 1, title: "Conjuração Divina", kind: "passive", summary: "Você canaliza poder sagrado por magias e orações.", details: "Card base da classe, ligado ao preparo e à lista divina.", tags: ["Magia"] },
    { id: "cleric-divine-order", level: 1, title: "Ordem Divina", kind: "choice", summary: "Escolha uma inclinação mais marcial ou mais sacerdotal para sua atuação.", details: "Serve como lembrete do foco do clérigo dentro da ficha.", tags: ["Escolha"] },
    { id: "cleric-channel-divinity", level: 2, title: "Canalizar Divindade", kind: "resource", summary: "Acesse uma manifestação especial do seu poder sagrado.", details: "Pode ser usado para registrar usos e anotações do domínio.", tags: ["Recurso", "Divino"] },
    subclassCard("cleric"),
    asiCard("cleric"),
    { id: "cleric-smites-undead", level: 5, title: "Poder Divino Ampliado", kind: "passive", summary: "Seu controle sobre forças impuras ou milagres fica mais forte.", details: "Bom marcador do salto de poder do clérigo no meio do jogo inicial.", tags: ["Passiva", "Divino"] },
  ],
  druid: [
    { id: "druid-druidic", level: 1, title: "Druídico", kind: "passive", summary: "A linguagem e os costumes dos círculos naturais marcam sua identidade.", details: "Ótimo card de sabor e lembrete de RP.", tags: ["RP"] },
    { id: "druid-spellcasting", level: 1, title: "Conjuração Druídica", kind: "passive", summary: "Você manipula magia natural e elemental.", details: "Card base ligado à preparação de magias.", tags: ["Magia"] },
    { id: "druid-wild-shape", level: 2, title: "Forma Selvagem", kind: "resource", summary: "Assuma formas animais para explorar, lutar ou sobreviver.", details: "Um dos melhores exemplos de card com uso rastreável.", tags: ["Recurso", "Transformação"] },
    subclassCard("druid"),
    asiCard("druid"),
    { id: "druid-wild-strike", level: 5, title: "Forma Selvagem Aprimorada", kind: "passive", summary: "Seu vínculo com a natureza fica mais flexível ou agressivo.", details: "Use para sinalizar o ponto em que a classe começa a escalar com mais conforto.", tags: ["Passiva", "Transformação"] },
  ],
  fighter: [
    { id: "fighter-fighting-style", level: 1, title: "Estilo de Luta", kind: "choice", summary: "Escolha a postura de combate que mais combina com sua build.", details: "Defesa, duelo, arma grande, proteção e outros estilos podem virar cards derivados depois.", tags: ["Escolha", "Combate"] },
    { id: "fighter-second-wind", level: 1, title: "Segundo Fôlego", kind: "resource", summary: "Recupere um pouco de vida no meio da luta.", details: "Card ótimo para marcar usos por descanso curto.", tags: ["Recurso", "Cura"] },
    { id: "fighter-action-surge", level: 2, title: "Surto de Ação", kind: "resource", summary: "Ganhe uma explosão extra de ações em um turno crucial.", details: "Um dos recursos mais marcantes para virar card destacado.", tags: ["Recurso", "Ação"] },
    subclassCard("fighter"),
    asiCard("fighter"),
    { id: "fighter-extra-attack", level: 5, title: "Ataque Extra", kind: "passive", summary: "Você pode atacar mais vezes quando toma a ação de Ataque.", details: "Marco clássico de progressão marcial. Funciona como lembrete constante na ficha.", tags: ["Passiva", "Combate"] },
  ],
  monk: [
    { id: "monk-martial-arts", level: 1, title: "Artes Marciais", kind: "passive", summary: "Seu corpo vira arma e disciplina ao mesmo tempo.", details: "O card pode resumir ataques desarmados, destreza e dano próprio da classe.", tags: ["Passiva", "Combate"] },
    { id: "monk-unarmored-defense", level: 1, title: "Defesa sem Armadura", kind: "passive", summary: "Movimento e foco sustentam sua proteção.", details: "Bom card passivo para builds leves.", tags: ["Passiva"] },
    { id: "monk-ki", level: 2, title: "Pontos de Ki", kind: "resource", summary: "Você aprende a gastar energia interior em técnicas especiais.", details: "Perfeito para card com rastreador manual.", tags: ["Recurso", "Ki"] },
    { id: "monk-unarmored-movement", level: 2, title: "Movimento sem Armadura", kind: "passive", summary: "Sua mobilidade aumenta conforme a disciplina cresce.", details: "Ajuda a lembrar deslocamentos alterados em exploração e combate.", tags: ["Passiva", "Mobilidade"] },
    subclassCard("monk"),
    asiCard("monk"),
    { id: "monk-extra-attack", level: 5, title: "Ataque Extra", kind: "passive", summary: "Você encaixa mais golpes na mesma abertura.", details: "Marca o salto ofensivo do monge no começo do jogo médio.", tags: ["Passiva", "Combate"] },
  ],
  paladin: [
    { id: "paladin-lay-on-hands", level: 1, title: "Mãos Curativas", kind: "resource", summary: "Reserve um poço de cura e suporte emergencial.", details: "Funciona muito bem como card de recurso com observações do grupo.", tags: ["Recurso", "Cura"] },
    { id: "paladin-spellcasting", level: 1, title: "Poder Sagrado", kind: "passive", summary: "Você começa a unir espada e milagre na mesma ficha.", details: "Pode servir como âncora entre progressão e magias preparadas.", tags: ["Magia", "Divino"] },
    { id: "paladin-fighting-style", level: 2, title: "Estilo de Luta", kind: "choice", summary: "Defina a forma como sua presença marcial se manifesta.", details: "Card de escolha para builds mais defensivas, agressivas ou protetoras.", tags: ["Escolha", "Combate"] },
    { id: "paladin-divine-smite", level: 2, title: "Golpe Divino", kind: "resource", summary: "Converta magia em punição radiante no impacto certo.", details: "Um ótimo card para lembrar gasto de espaços e explosões de dano.", tags: ["Recurso", "Dano"] },
    subclassCard("paladin"),
    asiCard("paladin"),
    { id: "paladin-extra-attack", level: 5, title: "Ataque Extra", kind: "passive", summary: "Seu ritmo de combate fica mais constante.", details: "Esse card marca o momento em que o paladino se firma no front.", tags: ["Passiva", "Combate"] },
  ],
  ranger: [
    { id: "ranger-favored-enemy", level: 1, title: "Caçador Preparado", kind: "passive", summary: "Você se especializa em leitura de terreno, rastros e presas.", details: "Card ótimo para lembrar a fantasia de rastreador fora de combate.", tags: ["Passiva", "Exploração"] },
    { id: "ranger-spellcasting", level: 1, title: "Conjuração", kind: "passive", summary: "Você combina sobrevivência, magia e precisão.", details: "Ajuda a amarrar a classe à seção de magias da ficha.", tags: ["Magia"] },
    { id: "ranger-fighting-style", level: 2, title: "Estilo de Luta", kind: "choice", summary: "Arco, duas armas, defesa ou outra abordagem de caçada.", details: "Card de escolha que ajuda a visualizar o papel tático da classe.", tags: ["Escolha", "Combate"] },
    { id: "ranger-utility", level: 2, title: "Ferramentas de Caça", kind: "passive", summary: "Você ganha truques e preparação para exploração hostil.", details: "Use esse espaço para registrar a versão da mesa ou homebrew.", tags: ["Passiva", "Exploração"] },
    subclassCard("ranger"),
    asiCard("ranger"),
    { id: "ranger-extra-attack", level: 5, title: "Ataque Extra", kind: "passive", summary: "Sua cadência ofensiva melhora bastante.", details: "Card claro para builds de arqueiro ou duelista de fronteira.", tags: ["Passiva", "Combate"] },
  ],
  rogue: [
    { id: "rogue-expertise", level: 1, title: "Especialização", kind: "choice", summary: "Dobre o peso de algumas perícias ou ferramentas chave.", details: "Um dos melhores cards para representar identidade do personagem.", tags: ["Escolha", "Perícias"] },
    { id: "rogue-sneak-attack", level: 1, title: "Ataque Furtivo", kind: "passive", summary: "Você transforma oportunidade em dano preciso.", details: "Card constante de combate, ideal para ficar sempre visível.", tags: ["Passiva", "Dano"] },
    { id: "rogue-thieves-cant", level: 1, title: "Gíria dos Ladrões", kind: "passive", summary: "Um marcador social e clandestino da classe.", details: "Perfeito para lembrar espaço de RP do ladino.", tags: ["RP"] },
    { id: "rogue-cunning-action", level: 2, title: "Ação Ardilosa", kind: "bonus", summary: "Você esgueira, corre e some com muito mais liberdade.", details: "Ótimo card de ação bônus para combate tático.", tags: ["Ação Bônus", "Mobilidade"] },
    subclassCard("rogue"),
    asiCard("rogue"),
    { id: "rogue-uncanny-dodge", level: 5, title: "Esquiva Sobrenatural", kind: "reaction", summary: "Reduza parte do dano quando reage no tempo certo.", details: "Esse card merece destaque por ser fácil de esquecer no calor do combate.", tags: ["Reação", "Defesa"] },
  ],
  sorcerer: [
    { id: "sorcerer-spellcasting", level: 1, title: "Magia Inata", kind: "passive", summary: "Seu poder surge de dentro, não de estudo ou pacto.", details: "Card base da classe para ligar magia e identidade.", tags: ["Magia"] },
    { id: "sorcerer-origin", level: 1, title: "Origem Feiticeira", kind: "choice", summary: "Escolha a fonte sobrenatural da sua magia.", details: "Esse card ajuda a amarrar a fantasia da subclasse desde cedo.", tags: ["Escolha", "Origem"] },
    { id: "sorcerer-font-of-magic", level: 2, title: "Fonte de Magia", kind: "resource", summary: "Pontos de feitiçaria passam a moldar sua economia de poder.", details: "Ideal para rastrear usos e combos da classe.", tags: ["Recurso", "Magia"] },
    subclassCard("sorcerer"),
    asiCard("sorcerer"),
    { id: "sorcerer-flexibility", level: 5, title: "Magia Afiada", kind: "passive", summary: "Seu repertório passa a render viradas mais fortes.", details: "Card genérico para marcar a subida de impacto do feiticeiro no meio do início da campanha.", tags: ["Passiva", "Magia"] },
  ],
  warlock: [
    { id: "warlock-pact-magic", level: 1, title: "Magia de Pacto", kind: "passive", summary: "Seu poder vem de um acordo perigoso ou útil demais para recusar.", details: "Card central da classe, ótimo para ligar com descanso curto e poucos espaços muito fortes.", tags: ["Magia", "Pacto"] },
    { id: "warlock-patron", level: 1, title: "Patrono Sobrenatural", kind: "choice", summary: "Escolha quem ou o que alimenta o seu pacto.", details: "Pode ser usado como âncora narrativa da campanha.", tags: ["Escolha", "Narrativo"] },
    { id: "warlock-invocations", level: 2, title: "Invocações Místicas", kind: "choice", summary: "Modifique sua build com melhorias permanentes e estranhas.", details: "Funciona muito bem como conjunto de subcards futuros.", tags: ["Escolha", "Customização"] },
    subclassCard("warlock"),
    asiCard("warlock"),
    { id: "warlock-pact-boon", level: 5, title: "Pacto Consolidado", kind: "passive", summary: "Seu pacto já molda claramente seu jeito de jogar.", details: "Card-marca para builds de lâmina, tomo, corrente e variantes da mesa.", tags: ["Passiva", "Pacto"] },
  ],
  wizard: [
    { id: "wizard-spellbook", level: 1, title: "Grimório", kind: "passive", summary: "Seu livro de magias passa a ser parte vital da ficha.", details: "Ótimo card para lembrar aquisição, cópia e preparo de magia.", tags: ["Magia"] },
    { id: "wizard-spellcasting", level: 1, title: "Conjuração Arcana", kind: "passive", summary: "Você domina magia através de estudo e método.", details: "Card base para a fantasia clássica do mago.", tags: ["Magia"] },
    { id: "wizard-arcane-recovery", level: 2, title: "Recuperação Arcana", kind: "rest", summary: "Parte do seu poder volta com um momento de foco.", details: "Excelente lembrete de descanso curto e preparação.", tags: ["Descanso", "Magia"] },
    subclassCard("wizard"),
    asiCard("wizard"),
    { id: "wizard-potent-cantrips", level: 5, title: "Cantrips Mais Confiáveis", kind: "passive", summary: "Sua base arcana já segura melhor os combates longos.", details: "Card genérico útil para marcar esse ponto da curva do mago.", tags: ["Passiva", "Magia"] },
  ],
  artificer: [
    { id: "artificer-tinkering", level: 1, title: "Tinkering Mágico", kind: "passive", summary: "Pequenas engenhocas e truques definem sua presença.", details: "Ótimo card de RP e utilidade.", tags: ["RP", "Utilidade"] },
    { id: "artificer-spellcasting", level: 1, title: "Conjuração de Artífice", kind: "passive", summary: "Você mistura ferramenta, fórmula e magia.", details: "Card base do conceito da classe.", tags: ["Magia", "Ferramentas"] },
    { id: "artificer-infuse-item", level: 2, title: "Infundir Item", kind: "choice", summary: "Melhore equipamentos com infusões práticas.", details: "Perfeito para conversar com o inventário do projeto.", tags: ["Escolha", "Equipamento"] },
    subclassCard("artificer"),
    asiCard("artificer"),
    { id: "artificer-extra-attack", level: 5, title: "Ataque Extra / Pico de Engenharia", kind: "passive", summary: "Seu estilo técnico começa a render mais em combate.", details: "Use como marcador genérico até detalhar a subclasse.", tags: ["Passiva", "Combate"] },
  ],
  gunslinger: [
    { id: "gunslinger-firearm-training", level: 1, title: "Treino com Armas de Fogo", kind: "passive", summary: "Você domina recuo, manutenção e precisão das armas.", details: "Bom card base para campanhas com tecnologia ou black powder.", tags: ["Passiva", "Arma de Fogo"] },
    { id: "gunslinger-trick-shot", level: 1, title: "Disparo Especial", kind: "choice", summary: "Escolha uma manobra ou truque que define seu estilo de tiro.", details: "Funciona muito bem com homebrew e cards customizados.", tags: ["Escolha", "Combate"] },
    { id: "gunslinger-grit", level: 2, title: "Grit", kind: "resource", summary: "Concentre frieza e precisão em momentos críticos.", details: "Card central do Pistoleiro para rastrear recursos de combate.", tags: ["Recurso", "Arma de Fogo"] },
    subclassCard("gunslinger"),
    asiCard("gunslinger"),
    { id: "gunslinger-extra-attack", level: 5, title: "Ataque Extra", kind: "passive", summary: "Você passa a sustentar rajadas mais consistentes.", details: "Marco importante para builds de duelista ou rifleiro.", tags: ["Passiva", "Combate"] },
  ],
};

export function getClassLabel(classId) {
  return CLASS_OPTIONS.find((option) => option.value === classId)?.label || classId;
}

export function getClassCards(classId) {
  return CARD_CATALOG[classId] || [];
}
