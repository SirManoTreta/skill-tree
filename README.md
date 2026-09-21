# Hability Sheet

Ficha digital de RPG em React, Vite e Tailwind. Ficha, progressão por cards, inventário e equipamento usam um estado compartilhado, com salvamento local imediato.

## Tipos de ficha

O seletor **Tipo de ficha** alterna entre **D&D** e **One Piece**. Cada tipo mantém sua própria ficha, inventário, moedas e progressão. Alternar ou recarregar preserva ambos.

- **D&D:** Força, Destreza, Constituição, Inteligência, Sabedoria e Carisma; 18 perícias.
- **One Piece:** Força, Destreza, Constituição, Sabedoria, Presença e Vontade; 19 perícias conforme a ficha de referência fornecida.

No modelo One Piece, História, Investigação, Medicina, Natureza e Sobrevivência usam Sabedoria; Atuação, Enganação, Intimidação, Persuasão e Provocação usam Presença; Haki, Intuição, Percepção, Sobrenatural e Sorte usam Vontade. A configuração está em `src/sheet/systems.js` e também controla salvaguardas e bônus de origens.

O modelo reproduz os atributos e as perícias da referência; não é uma reprodução das quatro páginas do PDF nem uma implementação completa das regras de One Piece. A progressão de One Piece usa nível manual e cards customizados, sem liberar classes de D&D.

Na página **Ficha**, a seção **Habilidades, técnicas e magias** permite adicionar, editar e remover cards próprios de cada personagem. Cada card contém nome, tipo, descrição, custo, alcance, dano, duração, requisito, grau, a marcação **Auxiliar** e um campo numérico de **Salvaguarda** dentro do octógono. Os campos são livres para as regras de cada mesa. Os cards são salvos automaticamente, separados por sistema, e incluídos na exportação da ficha e no backup completo.

## Salvamento e backups

- Os dados antigos são carregados na ficha de D&D. As chaves antigas são preservadas; o novo documento usa `hability-characters-v3`.
- O salvamento ocorre em cada alteração e o estado sobrevive à navegação entre abas.
- Falhas de leitura ou gravação aparecem na interface. Dados ilegíveis não são sobrescritos automaticamente. Se o navegador recusar uma gravação, exporte um backup antes de fechar a página.
- **Exportar Tudo** gera um backup de ambos os tipos, incluindo moedas, equipamento e progressão. Não copia dados de outros aplicativos do mesmo domínio.
- **Restaurar backup** aceita o formato atual (v3), o backup geral antigo (v2) e fichas individuais. Valida o arquivo antes de aplicar. **Desfazer importação** fica disponível até a próxima edição.
- **Exportar JSON**, dentro da ficha, gera uma ficha individual com os valores calculados consolidados. O backup completo preserva também as opções de cálculo automático.
- Imagens novas: PNG, JPEG, GIF ou WebP, até 512 KB, ou URL HTTP(S). Arquivos JSON: até 10 MB. Imagens externas dependem da rede.

## Equipamento e progressão

Equipar usa a categoria do item e tags exatas para acessórios. Pode-se arrastar ou usar o seletor de slot. Trocar um ocupante libera o anterior; duplicar um item não duplica seu slot.

Na ficha de D&D, as opções de cálculo automático permitem obter classe/níveis e proficiência da progressão, e CA da armadura/escudo equipados. Valores manuais continuam disponíveis. A fórmula de CA cobre armaduras leves, médias e pesadas, escudo e Destreza; características especiais de classe continuam sendo ajustes manuais.

O catálogo de D&D contém 90 cards iniciais, dos níveis 1 a 5, em português. O nível total é limitado a 20 e há controles para corrigir níveis e remover classes. Conteúdo de níveis posteriores e regras da mesa deve ser registrado em cards customizados.

## Desenvolvimento

Use Node.js 22.12 ou superior compatível com as dependências.

```bash
npm ci
npm run dev
```

```bash
npm run lint -- --max-warnings 0
npm test
npm run build
npm run preview
```

`npm run check` executa lint, testes e build. O GitHub Actions executa essas verificações em pull requests e antes do deploy da `main`, usando o lockfile com `npm ci`.

## Uso offline

O build de produção gera um service worker que armazena todas as abas e os recursos locais. Após a primeira visita completa, a indicação **Pronto para uso offline** confirma a preparação. Funciona em HTTPS ou localhost; o servidor de desenvolvimento não registra o worker. Atualizações são ativadas quando as páginas da versão anterior forem fechadas.

O cache é separado pelo caminho de publicação, compatível com GitHub Pages. Não armazena imagens externas nem controla outros projetos no mesmo domínio.

## Estrutura

- `src/character/`: estado compartilhado, migração, validação e backups.
- `src/sheet/`: tipos de ficha, cálculos e componentes de apresentação.
- `src/inventory/`: editor, lista, moedas e regras de equipamento.
- `src/progression/`: catálogo, classes e cards customizados.
- `build/offline.js`: geração do cache da aplicação.
- `tests/`: regressões de dados, interfaces e funcionamento offline.

Arquivos da árvore antiga permanecem como referência histórica; essa árvore não faz parte da navegação atual.
