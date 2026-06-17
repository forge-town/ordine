import type { Meta, StoryObj } from "@storybook/react";
import type { NodeArtifact, TemplateContentType } from "@repo/schemas";
import { ArtifactPreview } from "./ArtifactPreview";
import type { ArtifactFileLoadResult } from "./types";

const meta: Meta<typeof ArtifactPreview> = {
  title: "WorkspacePage/CanvasV2/Panels/ArtifactPreview",
  component: ArtifactPreview,
  decorators: [
    (Story) => (
      <div className="w-[520px] rounded-xl bg-surface-2/60 p-3 ring-1 ring-border">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ArtifactPreview>;

const inline = (
  contentType: TemplateContentType,
  content: string,
  label?: string,
): NodeArtifact => ({
  kind: "inline",
  contentType,
  content,
  label,
});

const SVG_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
  '<rect width="120" height="120" rx="16" fill="#111"/>' +
  '<circle cx="60" cy="60" r="34" fill="none" stroke="#f43f5e" stroke-width="8"/></svg>';

const DIR_FILES: Record<string, ArtifactFileLoadResult> = {
  "/out/showcase/index.html": {
    content:
      '<main style="font-family:system-ui;padding:24px"><h1>Bifrost UI</h1><p>Generated showcase.</p></main>',
    contentType: "html",
  },
  "/out/showcase/tokens.json": {
    content: '{\n  "color": { "primary": "#f43f5e" },\n  "radius": 16\n}',
    contentType: "json",
  },
  "/out/showcase/logo.svg": { content: SVG_LOGO, contentType: "xml" },
  "/out/showcase/README.md": {
    content: "# Bifrost\n\nA generated **design** showcase.\n\n- token-driven\n- multi-file",
    contentType: "markdown",
  },
};

const mockLoadFile = (filePath: string): Promise<ArtifactFileLoadResult> =>
  Promise.resolve(DIR_FILES[filePath] ?? { content: "// missing", contentType: "text" });

export const Html: Story = {
  args: {
    artifact: inline(
      "html",
      '<main style="font-family:system-ui;padding:24px;color:#111"><h1>Hello</h1><button>Sandboxed</button></main>',
      "showcase.html",
    ),
  },
};

export const Markdown: Story = {
  args: {
    artifact: inline(
      "markdown",
      "# Brief\n\n**Bold** idea with a list:\n\n- one\n- two\n- three",
      "brief.md",
    ),
  },
};

export const CodeJson: Story = {
  args: {
    artifact: inline("json", '{\n  "name": "bifrost",\n  "version": "1.0.0"\n}', "tokens.json"),
  },
};

export const Text: Story = {
  args: { artifact: inline("text", "plain run output\nwith two lines", "stdout.txt") },
};

export const Image: Story = {
  args: {
    artifact: { kind: "file", contentType: "xml", content: "/out/showcase/logo.svg" },
    loadFile: mockLoadFile,
  },
};

export const Directory: Story = {
  args: {
    artifact: {
      kind: "dir",
      contentType: "html",
      content: "/out/showcase",
      label: "showcase/",
      files: [
        { path: "index.html", contentType: "html" },
        { path: "tokens.json", contentType: "json" },
        { path: "logo.svg", contentType: "xml" },
        { path: "README.md", contentType: "markdown" },
      ],
    },
    loadFile: mockLoadFile,
  },
};

export const Empty: Story = {
  args: { artifact: { kind: "inline", contentType: "text" } },
};
