import type { OrdinePlugin } from "./types";

/**
 * Helper to define a plugin with full type-safety.
 */
export const definePlugin = (plugin: OrdinePlugin): OrdinePlugin => plugin;
