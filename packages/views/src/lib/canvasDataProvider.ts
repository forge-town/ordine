import type { DataProvider } from "@refinedev/core";

/**
 * Client-agnostic registry for the Refine DataProvider used by Canvas store
 * actions (which run outside React and therefore cannot use the
 * `useDataProvider()` hook). Each consuming app registers its own provider via
 * `setCanvasDataProvider` (see CanvasPageStoreProvider), keeping @repo/views
 * free of any client-specific data layer.
 */
let canvasDataProvider: DataProvider | null = null;

export const setCanvasDataProvider = (dataProvider: DataProvider): void => {
  canvasDataProvider = dataProvider;
};

export const getCanvasDataProvider = (): DataProvider => {
  if (!canvasDataProvider) {
    throw new Error(
      "Canvas dataProvider not set. Ensure CanvasPageStoreProvider is mounted within a Refine provider.",
    );
  }

  return canvasDataProvider;
};
