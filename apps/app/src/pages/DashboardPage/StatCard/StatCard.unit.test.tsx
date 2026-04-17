import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Layers } from "lucide-react";
import { StatCard } from "./StatCard";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode; to: string }) => <a>{children}</a>,
}));

describe("StatCard", () => {
  it("renders label and value", () => {
    render(
      <StatCard icon={Layers} label="Pipelines" sub="已设计的流水线" to="/pipelines" value={5} />
    );
    expect(screen.getByText("Pipelines")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders sub text", () => {
    render(
      <StatCard icon={Layers} label="Pipelines" sub="已设计的流水线" to="/pipelines" value={5} />
    );
    expect(screen.getByText("已设计的流水线")).toBeInTheDocument();
  });
});
