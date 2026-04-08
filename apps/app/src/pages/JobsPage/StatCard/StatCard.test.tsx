import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(
      <StatCard
        color="text-blue-700"
        dot="bg-blue-500"
        label="运行中"
        value={5}
      />,
    );
    expect(screen.getByText("运行中")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders zero value", () => {
    render(
      <StatCard
        color="text-gray-700"
        dot="bg-gray-400"
        label="排队中"
        value={0}
      />,
    );
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
