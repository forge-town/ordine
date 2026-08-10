import type { StorybookConfig } from "@storybook/react-vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve absolute path of a package — required for monorepo / PnP setups.
 */
function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../../../packages/views/src/pages/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-vitest"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-onboarding"),
  ],
  framework: getAbsolutePath("@storybook/react-vite"),
  viteFinal: async (viteConfig) => {
    const storybookDir = dirname(fileURLToPath(import.meta.url));
    const existingAliases = Array.isArray(viteConfig.resolve?.alias)
      ? viteConfig.resolve.alias
      : [];

    return {
      ...viteConfig,
      resolve: {
        ...viteConfig.resolve,
        alias: [
          {
            find: "@/integrations/refine/dataProvider",
            replacement: resolve(storybookDir, "mocks/dataProvider.ts"),
          },
          {
            find: "@/router",
            replacement: resolve(storybookDir, "mocks/router.ts"),
          },
          ...existingAliases,
        ],
      },
    };
  },
};

export default config;
