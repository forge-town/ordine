import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NodeArtifact } from "@repo/schemas";
import { ArtifactPreview } from "./ArtifactPreview";

describe("ArtifactPreview", () => {
  it("renders inline markdown through the markdown renderer", () => {
    render(
      <ArtifactPreview artifact={{ kind: "inline", contentType: "markdown", content: "# hi" }} />,
    );
    expect(screen.getByTestId("artifact-preview")).toBeInTheDocument();
    expect(screen.getByTestId("artifact-renderer-markdown")).toBeInTheDocument();
  });

  it("sandboxes html WITHOUT allow-same-origin (no privilege escape)", () => {
    render(
      <ArtifactPreview artifact={{ kind: "inline", contentType: "html", content: "<h1>x</h1>" }} />,
    );
    const iframe = screen.getByTestId("artifact-renderer-html");
    const sandbox = iframe.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
  });

  it("routes json to the code renderer", () => {
    render(<ArtifactPreview artifact={{ kind: "inline", contentType: "json", content: "{}" }} />);
    expect(screen.getByTestId("artifact-renderer-code")).toBeInTheDocument();
  });

  it("shows an empty state when inline content is missing", () => {
    render(<ArtifactPreview artifact={{ kind: "inline", contentType: "text" }} />);
    expect(screen.getByTestId("artifact-preview-empty")).toBeInTheDocument();
  });

  it("renders a dir file tree and loads the selected file via the injected loader", async () => {
    const artifact: NodeArtifact = {
      kind: "dir",
      contentType: "html",
      content: "/out",
      files: [
        { path: "index.html", contentType: "html" },
        { path: "tokens.json", contentType: "json" },
      ],
    };
    const loadFile = vi.fn().mockResolvedValue({ content: "<h1>ok</h1>", contentType: "html" });
    render(<ArtifactPreview artifact={artifact} loadFile={loadFile} />);

    expect(screen.getByTestId("artifact-preview-tab-0")).toBeInTheDocument();
    expect(screen.getByTestId("artifact-preview-tab-1")).toBeInTheDocument();
    await waitFor(() => expect(loadFile).toHaveBeenCalledWith("/out/index.html"));
    await waitFor(() => expect(screen.getByTestId("artifact-renderer-html")).toBeInTheDocument());
  });
});
