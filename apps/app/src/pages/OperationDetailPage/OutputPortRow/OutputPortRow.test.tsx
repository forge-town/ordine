import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutputPortRow } from "./OutputPortRow";

describe("OutputPortRow", () => {
  it("renders port name and path", () => {
    render(
      <OutputPortRow
        port={{
          name: "result",
          kind: "file",
          path: "/output/result.json",
          description: "输出结果",
        }}
      />
    );
    expect(screen.getByText("result")).toBeInTheDocument();
    expect(screen.getByText("/output/result.json")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(
      <OutputPortRow
        port={{
          name: "out",
          kind: "folder",
          path: "/out",
          description: "输出文件夹",
        }}
      />
    );
    expect(screen.getByText("输出文件夹")).toBeInTheDocument();
  });
});
