import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HarnessCanvasStoreProvider } from "../../_store";
import { SkillPalette } from "./SkillPalette";

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>
    {children}
  </HarnessCanvasStoreProvider>
);

describe("SkillPalette", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkillPalette />, { wrapper });
    expect(container.firstChild).toBeTruthy();
  });
});
