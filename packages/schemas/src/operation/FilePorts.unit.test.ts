import { describe, expect, it } from "vitest";
import { InputPortSchema } from "./InputPortSchema";
import { mediaTypeMatches } from "./MediaTypeSchema";
import { OutputItemSchema } from "./OutputItemSchema";

describe("file operation ports", () => {
  it("keeps existing operation ports readable", () => {
    expect(InputPortSchema.parse({ name: "source", kind: "file", required: true })).toMatchObject({
      name: "source",
    });
    expect(OutputItemSchema.parse({ name: "report", contentType: "markdown" })).toMatchObject({
      name: "report",
    });
  });

  it("allows MIME wildcards only on input ports", () => {
    expect(
      InputPortSchema.parse({
        id: "source-files",
        name: "Source files",
        kind: "file",
        required: true,
        accepts: ["text/*"],
      }).accepts,
    ).toEqual(["text/*"]);

    expect(() =>
      OutputItemSchema.parse({
        id: "report",
        name: "Report",
        contentType: "markdown",
        produces: ["text/*"],
      }),
    ).toThrow();
  });

  it("matches concrete output types against input patterns", () => {
    expect(mediaTypeMatches("text/*", "text/markdown")).toBe(true);
    expect(mediaTypeMatches("application/pdf", "text/markdown")).toBe(false);
  });
});
