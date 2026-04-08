import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InputPortRow } from "./InputPortRow";

describe("InputPortRow", () => {
  it("renders port name", () => {
    render(
      <InputPortRow
        port={{
          name: "source_file",
          kind: "file",
          required: true,
          description: "输入文件",
        }}
      />
    );
    expect(screen.getByText("source_file")).toBeInTheDocument();
  });

  it("shows 必填 badge when required", () => {
    render(<InputPortRow port={{ name: "p", kind: "text", required: true, description: "" }} />);
    expect(screen.getByText("必填")).toBeInTheDocument();
  });

  it("hides 必填 badge when not required", () => {
    render(<InputPortRow port={{ name: "p", kind: "text", required: false, description: "" }} />);
    expect(screen.queryByText("必填")).not.toBeInTheDocument();
  });
});
