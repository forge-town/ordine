import { pluginRegistry } from "@repo/plugin";
import { githubProjectsPlugin } from "./github-project-plugin";

export const registerBuiltinPlugins = () => {
  if (!pluginRegistry.getPlugin(githubProjectsPlugin.id)) {
    pluginRegistry.register(githubProjectsPlugin);
  }
};
