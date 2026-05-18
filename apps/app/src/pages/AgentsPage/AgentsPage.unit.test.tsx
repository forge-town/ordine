import { describe, it, expect } from "vitest";
import { render } from "@/test/test-wrapper";
import { AgentsPage } from "./AgentsPage";

describe("AgentsPage", () => {
  it("renders without crashing", () => {
    render(<AgentsPage />);
    expect(document.body).toBeTruthy();
  });
});
