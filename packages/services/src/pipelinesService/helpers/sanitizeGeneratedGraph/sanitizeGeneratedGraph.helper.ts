import "../../../text-imports.d.ts";

export const sanitizeGeneratedGraph = (value: unknown): unknown => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const graph = value as Record<string, unknown>;
  if (!Array.isArray(graph.nodes)) {
    return value;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((nodeValue) => {
      if (!nodeValue || typeof nodeValue !== "object" || Array.isArray(nodeValue)) {
        return nodeValue;
      }

      const node = nodeValue as Record<string, unknown>;
      const dataValue = node.data;
      if (!dataValue || typeof dataValue !== "object" || Array.isArray(dataValue)) {
        return nodeValue;
      }

      const data = { ...(dataValue as Record<string, unknown>) };
      const normalizedType =
        node.type === "github-projects" || data.nodeType === "github-projects"
          ? "github-project"
          : node.type;
      if (data.nodeType === "github-projects") {
        data.nodeType = "github-project";
      }
      if (
        data.nodeType === "github-project" &&
        typeof data.owner !== "string" &&
        typeof data.repo === "string" &&
        data.repo.includes("/")
      ) {
        const [owner, ...repoParts] = data.repo.split("/");
        if (owner && repoParts.length > 0) {
          data.owner = owner;
          data.repo = repoParts.join("/");
        }
      }
      if (
        data.nodeType === "prompt" &&
        (typeof data.prompt !== "string" || data.prompt.trim().length === 0)
      ) {
        data.prompt =
          typeof data.description === "string" && data.description.trim().length > 0
            ? data.description
            : typeof data.label === "string"
              ? data.label
              : "Provide the Pipeline input.";
      }

      return { ...node, type: normalizedType, data };
    }),
  };
};
