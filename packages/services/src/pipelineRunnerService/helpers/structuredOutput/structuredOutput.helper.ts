import type { StructuredOutputAssemblyBindings } from "../../contracts";

import { createStructuredOutputTryParseJsonHelper } from "../structuredOutputTryParseJson";
import { createStructuredOutputExtractMethod } from "../../methods/structuredOutputExtract";
import { createStructuredOutputToMarkdownMethod } from "../../methods/structuredOutputToMarkdown";

const createStructuredOutputAssembly = () => {
  const serviceBindings: StructuredOutputAssemblyBindings = {
    get tryParseJson() {
      return tryParseJson;
    },
    get extract() {
      return extract;
    },
    get toMarkdown() {
      return toMarkdown;
    },
  };

  // ─── JSON extraction ──────────────────────────────────────────────────────────

  const tryParseJson = createStructuredOutputTryParseJsonHelper(serviceBindings);

  const extract = createStructuredOutputExtractMethod(serviceBindings);

  // ─── JSON → Markdown ──────────────────────────────────────────────────────────

  const toMarkdown = createStructuredOutputToMarkdownMethod(serviceBindings);

  return {
    extract,
    toMarkdown,
  };
};

export const structuredOutput = createStructuredOutputAssembly();
