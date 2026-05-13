import { describe, it, expect, vi } from "vitest";
import { toOperationMd } from "./exportOperation";
import { parseOperationMd, parseOperationZip } from "./importOperation";
import type { Operation } from "@repo/schemas";
import JSZip from "jszip";

vi.mock("@/integrations/refine/dataProvider", () => ({
  dataProvider: {},
  ResourceName: {},
}));

const makeOperation = (overrides: Partial<Operation> = {}): Operation => ({
  id: "op-test",
  name: "Check DAO Pattern",
  description: "检查 DAO 层代码是否符合约定",
  acceptedObjectTypes: ["folder"],
  config: {
    executor: {
      type: "agent",
      systemPrompt: "对目标代码中的 DAO 层进行检查。",
    },
    inputs: [],
    outputs: [
      { name: "report.md", contentType: "markdown", description: "检查报告", templateIds: [] },
      { name: "stats.json", contentType: "json", description: "统计数据", templateIds: [] },
    ],
  },
  ...overrides,
});

describe("toOperationMd", () => {
  it("generates correct frontmatter with input field", () => {
    const md = toOperationMd(makeOperation());
    expect(md).toContain("name: Check DAO Pattern");
    expect(md).toContain("description: 检查 DAO 层代码是否符合约定");
    expect(md).toContain("input: folder");
  });

  it("omits input when all object types are present", () => {
    const md = toOperationMd(
      makeOperation({ acceptedObjectTypes: ["file", "folder", "project", "prompt"] }),
    );
    expect(md).not.toContain("input:");
  });

  it("maps project to github-project", () => {
    const md = toOperationMd(makeOperation({ acceptedObjectTypes: ["project"] }));
    expect(md).toContain("input: github-project");
  });

  it("includes system prompt as body", () => {
    const md = toOperationMd(makeOperation());
    expect(md).toContain("对目标代码中的 DAO 层进行检查。");
  });

  it("generates outputs section with filenames", () => {
    const md = toOperationMd(makeOperation());
    expect(md).toContain("## Outputs");
    expect(md).toContain("- **report.md**: 检查报告");
    expect(md).toContain("- **stats.json**: 统计数据");
  });

  it("adds .md extension to output names without extension", () => {
    const md = toOperationMd(
      makeOperation({
        config: {
          inputs: [],
          outputs: [
            { name: "report", contentType: "markdown", description: "A report", templateIds: [] },
          ],
        },
      }),
    );
    expect(md).toContain("- **report.md**: A report");
  });

  it("infers extension from output contentType", () => {
    const op = makeOperation({
      config: {
        inputs: [],
        outputs: [
          {
            name: "dashboard",
            contentType: "html",
            description: "Dashboard",
            templateIds: ["tpl-1"],
          },
          { name: "data", contentType: "json", description: "Data", templateIds: ["tpl-2"] },
        ],
      },
    });
    const md = toOperationMd(op);
    expect(md).toContain("- **dashboard.html**: Dashboard");
    expect(md).toContain("- **data.json**: Data");
  });
});

describe("parseOperationMd", () => {
  it("parses a valid OPERATION.md", () => {
    const md = [
      "---",
      "name: Check DAO Pattern",
      "description: 检查 DAO 层代码",
      "input: folder",
      "---",
      "",
      "# Check DAO Pattern",
      "",
      "对目标代码中的 DAO 层进行检查。",
      "",
      "## Outputs",
      "",
      "- **report.md**: 检查报告",
      "- **stats.json**: 统计数据",
    ].join("\n");

    const result = parseOperationMd(md);
    expect(result.isOk()).toBe(true);
    const parsed = result._unsafeUnwrap();
    expect(parsed.name).toBe("Check DAO Pattern");
    expect(parsed.description).toBe("检查 DAO 层代码");
    expect(parsed.acceptedObjectTypes).toEqual(["folder"]);
    expect(parsed.config.executor.systemPrompt).toContain("对目标代码中的 DAO 层进行检查。");
    expect(parsed.config.outputs).toHaveLength(2);
    expect(parsed.config.outputs[0]!.name).toBe("report.md");
    expect(parsed.config.outputs[0]!.contentType).toBe("markdown");
    expect(parsed.config.outputs[1]!.name).toBe("stats.json");
    expect(parsed.config.outputs[1]!.contentType).toBe("json");
  });

  it("defaults input to any when omitted", () => {
    const md =
      "---\nname: Test\ndescription: Desc\n---\n\n# Test\n\n## Outputs\n\n- **out.md**: output\n";
    const result = parseOperationMd(md);
    expect(result._unsafeUnwrap().acceptedObjectTypes).toEqual([
      "file",
      "folder",
      "project",
      "prompt",
    ]);
  });

  it("maps github-project to project object type", () => {
    const md =
      "---\nname: Test\ndescription: Desc\ninput: github-project\n---\n\n# Test\n\n## Outputs\n\n- **out.md**: output\n";
    const result = parseOperationMd(md);
    expect(result._unsafeUnwrap().acceptedObjectTypes).toEqual(["project"]);
  });

  it("returns error for missing frontmatter", () => {
    const result = parseOperationMd("# No frontmatter");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toContain("frontmatter");
  });

  it("returns error for missing name", () => {
    const result = parseOperationMd("---\ndescription: Desc\n---\n\n# Test\n");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toContain("name");
  });
});

describe("roundtrip: toOperationMd → parseOperationMd", () => {
  it("preserves key fields through export-import cycle", () => {
    const original = makeOperation();
    const md = toOperationMd(original);
    const result = parseOperationMd(md);
    expect(result.isOk()).toBe(true);
    const parsed = result._unsafeUnwrap();

    expect(parsed.name).toBe(original.name);
    expect(parsed.description).toBe(original.description);
    expect(parsed.acceptedObjectTypes).toEqual(original.acceptedObjectTypes);
    expect(parsed.config.outputs).toHaveLength(original.config.outputs.length);
    expect(parsed.config.outputs[0]!.name).toBe("report.md");
    expect(parsed.config.outputs[0]!.contentType).toBe("markdown");
    expect(parsed.config.outputs[1]!.name).toBe("stats.json");
    expect(parsed.config.outputs[1]!.contentType).toBe("json");
    expect(parsed.config.executor.systemPrompt).toContain("对目标代码中的 DAO 层进行检查。");
  });
});

describe("parseOperationZip", () => {
  it("parses OPERATION.md from a ZIP file", async () => {
    const zip = new JSZip();
    const folder = zip.folder("check-dao-pattern");
    folder!.file(
      "OPERATION.md",
      "---\nname: Check DAO\ndescription: DAO check\ninput: folder\n---\n\n# Check DAO\n\nCheck DAO layer.\n\n## Outputs\n\n- **report.md**: Report\n",
    );

    const data = await zip.generateAsync({ type: "uint8array" });

    const result = await parseOperationZip(data);
    expect(result.isOk()).toBe(true);
    const parsed = result._unsafeUnwrap();
    expect(parsed.name).toBe("Check DAO");
    expect(parsed.acceptedObjectTypes).toEqual(["folder"]);
    expect(parsed.config.outputs[0]!.name).toBe("report.md");
    expect(parsed.config.outputs[0]!.contentType).toBe("markdown");
  });

  it("returns error when ZIP has no OPERATION.md", async () => {
    const zip = new JSZip();
    zip.file("readme.md", "hello");
    const data = await zip.generateAsync({ type: "uint8array" });

    const result = await parseOperationZip(data);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toContain("No OPERATION.md");
  });

  it("parses templates from templates/ folder and maps them to outputs", async () => {
    const zip = new JSZip();
    const folder = zip.folder("my-op");
    folder!.file(
      "OPERATION.md",
      "---\nname: Op\ndescription: Desc\ninput: folder\n---\n\n# Op\n\nDo stuff.\n\n## Outputs\n\n- **report.md**: Report\n- **data.json**: Data\n",
    );
    folder!.file(
      "_outputs.json",
      JSON.stringify([
        { name: "report.md", templateIds: ["tpl-1"] },
        { name: "data.json", templateIds: ["tpl-2", "tpl-3"] },
      ]),
    );
    const tplFolder = folder!.folder("templates");
    tplFolder!.file(
      "_meta.json",
      JSON.stringify([
        { id: "tpl-1", name: "Report Template", description: null, contentType: "markdown" },
        { id: "tpl-2", name: "Data Template", description: "JSON data", contentType: "json" },
        { id: "tpl-3", name: "Extra", description: null, contentType: "text" },
      ]),
    );
    tplFolder!.file("tpl-1.md", "# Report\n\nBody");
    tplFolder!.file("tpl-2.json", '{"key": "value"}');
    tplFolder!.file("tpl-3.txt", "plain text");

    const data = await zip.generateAsync({ type: "uint8array" });

    const result = await parseOperationZip(data);
    expect(result.isOk()).toBe(true);
    const parsed = result._unsafeUnwrap();

    // Templates parsed correctly
    expect(parsed.templates).toHaveLength(3);
    expect(parsed.templates[0]!.id).toBe("tpl-1");
    expect(parsed.templates[0]!.name).toBe("Report Template");
    expect(parsed.templates[0]!.content).toBe("# Report\n\nBody");
    expect(parsed.templates[0]!.contentType).toBe("markdown");
    expect(parsed.templates[1]!.content).toBe('{"key": "value"}');
    expect(parsed.templates[2]!.content).toBe("plain text");

    // Output→template mapping preserved
    expect(parsed.config.outputs[0]!.templateIds).toEqual(["tpl-1"]);
    expect(parsed.config.outputs[0]!.contentType).toBe("markdown");
    expect(parsed.config.outputs[1]!.templateIds).toEqual(["tpl-2", "tpl-3"]);
    expect(parsed.config.outputs[1]!.contentType).toBe("json");
  });

  it("preserves empty templateIds for outputs without templates", async () => {
    const zip = new JSZip();
    const folder = zip.folder("my-op");
    folder!.file(
      "OPERATION.md",
      "---\nname: Op\ndescription: Desc\n---\n\n# Op\n\nPrompt.\n\n## Outputs\n\n- **out.md**: Output\n",
    );

    const data = await zip.generateAsync({ type: "uint8array" });

    const result = await parseOperationZip(data);
    expect(result.isOk()).toBe(true);
    const parsed = result._unsafeUnwrap();
    expect(parsed.templates).toHaveLength(0);
    expect(parsed.config.outputs[0]!.templateIds).toEqual([]);
    expect(parsed.config.outputs[0]!.contentType).toBe("markdown");
  });
});
