import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { SkillsPage } from "./SkillsPage";

vi.mock("@/routes/_layout/skills", () => ({
  Route: { useLoaderData: () => [] },
}));

describe("SkillsPage", () => {
  it("renders without crashing", () => {
    render(<SkillsPage />);
    expect(document.body).toBeTruthy();
  });
});
