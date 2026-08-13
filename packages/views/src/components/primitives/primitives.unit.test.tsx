import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Box, Circle, FileText, GitBranch, Search } from "lucide-react";
import { render } from "../../test/test-wrapper";
import { BarRow, Chip, Dot, Icon, MiniChain, Mono, SearchInput, Stat, StatusPill, Tag } from ".";

describe("app chrome primitives", () => {
  it("renders icon and status primitives accessibly", () => {
    render(
      <div>
        <Icon icon={Search} title="Search" />
        <StatusPill status="running" />
        <Dot ping tone="success" />
      </div>,
    );

    expect(screen.getByRole("img", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(document.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("supports interactive chips and search input clearing", async () => {
    const handleChipClick = vi.fn();
    const handleChange = vi.fn();
    const handleClear = vi.fn();
    const user = userEvent.setup();
    render(
      <div>
        <Chip active count={3} onClick={handleChipClick}>
          All
        </Chip>
        <SearchInput
          placeholder="Search components"
          value="a"
          onChange={handleChange}
          onClear={handleClear}
        />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "All (3)" }));
    await user.type(screen.getByPlaceholderText("Search components"), "b");
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(handleChipClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "All (3)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Search components" })).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith("ab");
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it("renders display and progress primitives", () => {
    render(
      <div>
        <Stat label="Runs" secondary="today" value="12" />
        <Tag>draft</Tag>
        <Mono>AI</Mono>
        <MiniChain
          steps={[
            { icon: FileText, label: "File" },
            { compound: true, icon: Box, label: "Component" },
          ]}
        />
        <BarRow label="Pipeline" percent={142} secondaryValue="$4.2" value="42k" />
        <MiniChain steps={[{ icon: Circle }, { icon: GitBranch }]} />
      </div>,
    );

    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByTitle("File")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
