import type { OrdinePlugin, ObjectTypeDefinition, PluginNodeHandler } from "./types";

/**
 * Central registry for plugins and their contributed object types.
 * Designed as a singleton — import `pluginRegistry` from `@repo/plugin`.
 */
export class PluginRegistry {
  private plugins = new Map<string, OrdinePlugin>();
  private objectTypes = new Map<string, ObjectTypeDefinition>();

  register(plugin: OrdinePlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }
    this.plugins.set(plugin.id, plugin);

    for (const objType of plugin.objectTypes ?? []) {
      if (this.objectTypes.has(objType.id)) {
        throw new Error(
          `Object type "${objType.id}" is already registered (by plugin "${this.getObjectTypeOwner(objType.id)}")`,
        );
      }
      this.objectTypes.set(objType.id, objType);
    }
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    for (const objType of plugin.objectTypes ?? []) {
      this.objectTypes.delete(objType.id);
    }
    this.plugins.delete(pluginId);
  }

  getPlugin(pluginId: string): OrdinePlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getObjectType(typeId: string): ObjectTypeDefinition | undefined {
    return this.objectTypes.get(typeId);
  }

  getNodeHandler(typeId: string): PluginNodeHandler | undefined {
    return this.objectTypes.get(typeId)?.nodeHandler;
  }

  getAllObjectTypes(): ObjectTypeDefinition[] {
    return [...this.objectTypes.values()];
  }

  getAllPlugins(): OrdinePlugin[] {
    return [...this.plugins.values()];
  }

  hasObjectType(typeId: string): boolean {
    return this.objectTypes.has(typeId);
  }

  clear(): void {
    this.plugins.clear();
    this.objectTypes.clear();
  }

  private getObjectTypeOwner(typeId: string): string | undefined {
    for (const plugin of this.plugins.values()) {
      if (plugin.objectTypes?.some((o) => o.id === typeId)) {
        return plugin.id;
      }
    }

    return undefined;
  }
}

export const pluginRegistry = new PluginRegistry();
