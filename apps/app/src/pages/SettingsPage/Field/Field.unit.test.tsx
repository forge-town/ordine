import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "./Field";

describe("Field", () => {
  it("renders label", () => {
    render(
      <Field label="Name">
        <input />
      </Field>
    );
    expect(screen.getByText("Name")).toBeTruthy();
  });

  it("renders children", () => {
    render(
      <Field label="Test">
        <span>child content</span>
      </Field>
    );
    expect(screen.getByText("child content")).toBeTruthy();
  });
});
