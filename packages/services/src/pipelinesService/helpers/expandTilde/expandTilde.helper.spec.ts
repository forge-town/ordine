import { describe, expect, it } from "vitest";
import { expandTilde } from "./expandTilde.helper";
import { homedir } from "node:os";
import { join } from "node:path";
describe("expandTilde", () => {
  it("retains the Pipeline content and error boundary", () => {
    expect(expandTilde("~")).toBe(homedir());
    expect(expandTilde("~/reports")).toBe(join(homedir(), "reports"));
    expect(expandTilde("relative/path")).toBe("relative/path");
  });
});
