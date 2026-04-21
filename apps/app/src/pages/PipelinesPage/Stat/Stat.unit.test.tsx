import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Layers } from "lucide-react";
import { Stat } from "./Stat";

describe("Stat", () => {
  it("renders label and value", () => {
    render(<Stat icon={Layers} label="节点数" value={5} />);
    expect(screen.getByText("节点数")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<Stat icon={Layers} label="更新时间" value="2024/1/1" />);
    expect(screen.getByText("2024/1/1")).toBeInTheDocument();
  });
});
