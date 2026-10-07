import JSZip from "jszip";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createExtractDocxTextHelper =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "normalizeWhitespace">) =>
  async (bytes: Uint8Array) => {
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) {
      return "";
    }

    return (0, serviceBindings.normalizeWhitespace)(
      documentXml
        .replaceAll(/<[^>]+>/g, " ")
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">"),
    );
  };
