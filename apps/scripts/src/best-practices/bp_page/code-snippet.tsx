ConfigPage/
├── index.ts
├── ConfigPage.tsx
├── ConfigPageContent.tsx
└── _store/
    ├── provider.tsx
    ├── configPageSlice.ts
    └── configPageStore.ts

export const ConfigPage = () => (
  <ConfigPageStoreProvider>
    <ConfigPageContent />
  </ConfigPageStoreProvider>
);
