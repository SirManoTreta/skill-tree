# Hability Sheet

Aplicação React + Vite focada em ficha de personagem, progressão por cards, inventário e equipamento.

## O que mudou nesta versão

- a árvore saiu do fluxo principal do app
- entrou uma aba de progressão por cards para classe, multiclasse e biografia
- a navegação principal ficou em torno de ficha, progressão, inventário e equipamento
- a dependência de `reactflow` foi removida do runtime principal
- a exportação geral agora pode incluir a progressão do personagem

## Estrutura principal

```txt
src/
  app/
    AppHeader.jsx
    AppTabs.jsx
  constants/
    dnd.js
    storage.js
  inventory/
    CurrencyPurse.jsx
    EquipmentGrid.jsx
    EquipmentPage.jsx
    InventoryManager.jsx
  progression/
    catalog.js
    ProgressionPage.jsx
  shared/
    hooks/
      useLocalStorageState.js
    storage/
      localStorage.js
  sheet/
    CharacterSheet.jsx
  utils/
    i18n.js
    misc.js
  App.jsx
  main.jsx
```

## Rodando o projeto

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Observações

O projeto agora está mais alinhado com uma ficha digital offline-first.
A árvore antiga pode continuar guardada no código como referência, mas não faz mais parte da experiência principal.
