import { pluginRegistry } from "@repo/plugin";
import { apiEndpointPlugin } from "./api-endpoint-plugin";
import { githubProjectsPlugin } from "@repo/plugins";

/**
 * Register all built-in plugins.
 * Import this module once in the app entry to activate plugins.
 */
pluginRegistry.register(apiEndpointPlugin);
pluginRegistry.register(githubProjectsPlugin);
