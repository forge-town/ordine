import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutputItemRow } from "./OutputItemRow";

describe("OutputItemRow", () => {
  it("renders item name and kind", () => {
    render(
      <OutputItemRow
        item={{
          name: "result",
          kind: "file",
          description: "输出结果",
          templateIds: [],
        }}
      />
    );
    expect(screen.getByText("result")).toBeInTheDocument();
    expect(screen.getByText("file")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(
      <OutputItemRow
        item={{
          name: "out",
          kind: "folder",
          description: "输出文件夹",
          templateIds: [],
        }}
      />
    );
    expect(screen.getByText("输出文件夹")).toBeInTheDocument();
  });
});
