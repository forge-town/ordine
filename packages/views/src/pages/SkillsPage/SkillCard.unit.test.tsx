import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../test/test-wrapper";
import { SkillCard } from "./SkillCard";

describe("SkillCard", () => {
  it("shows the IO signature and can power or delete a skill", async () => {
    const handleCreateOperation = vi.fn();
    const handleDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <SkillCard
        item={{
          id: "skill-review",
          description: "Review changes before merge.",
          io: "repo -> review report",
          name: "codex-review",
          operation: "Codex Review Operation",
          source: "Codex",
          sourceCaption: "imported from Codex",
          sourceTone: "blue",
          tags: ["review"],
          title: "Codex Review",
        }}
        onCreateOperation={handleCreateOperation}
        onDelete={handleDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create operation from codex-review" }));
    await user.click(screen.getByRole("button", { name: "Delete codex-review" }));

    expect(screen.getByText("repo -> review report")).toBeInTheDocument();
    expect(handleCreateOperation).toHaveBeenCalledWith("skill-review");
    expect(handleDelete).toHaveBeenCalledWith("skill-review");
  });
});
