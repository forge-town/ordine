import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";

describe("Field", () => {
  it("renders label", () => {
    render(<Field label="分类"><span>值</span></Field>);
    expect(screen.getByText("分类")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(<Field label="语言"><input placeholder="typescript" /></Field>);
    expect(screen.getByPlaceholderText("typescript")).toBeInTheDocument();
  });
});
