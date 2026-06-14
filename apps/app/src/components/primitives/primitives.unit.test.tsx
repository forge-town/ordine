import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Box, Circle, FileText, GitBranch, Search } from "lucide-react";
import { render } from "@/test/test-wrapper";
import { BarRow, Chip, Dot, Icon, MiniChain, Mono, SearchInput, Stat, StatusPill, Tag } from ".";

describe("primitives", () => {
  it("renders Icon", () => {
    render(<Icon icon={Search} title="Search" />);

    expect(screen.getByRole("img", { name: "Search" })).toBeInTheDocument();
  });

  it("renders StatusPill", () => {
    render(<StatusPill status="running" />);

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("renders Dot", () => {
    render(<Dot ping tone="success" />);

    expect(document.querySelector(".ping")).toBeInTheDocument();
  });

  it("renders Chip", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Chip active count={3} onClick={handleClick}>
        All
      </Chip>,
    );

    await user.click(screen.getByRole("button", { name: /All3/ }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders Stat", () => {
    render(<Stat label="Runs" sub="today" value="12" />);

    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders Tag", () => {
    render(<Tag>draft</Tag>);

    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("renders Mono", () => {
    render(<Mono>AI</Mono>);

    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("renders SearchInput", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput placeholder="Search components" value="" onChange={handleChange} />);

    await user.type(screen.getByPlaceholderText("Search components"), "a");

    expect(handleChange).toHaveBeenCalledWith("a");
  });

  it("renders MiniChain", () => {
    render(
      <MiniChain
        steps={[
          { icon: FileText, label: "File" },
          { compound: true, icon: Box, label: "Component" },
        ]}
      />,
    );

    expect(screen.getByTitle("File")).toBeInTheDocument();
    expect(screen.getByTitle("Component")).toBeInTheDocument();
  });

  it("renders BarRow", () => {
    render(<BarRow label="Pipeline" pct={42} sub="$4.2" value="42k" />);

    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("42k")).toBeInTheDocument();
  });

  it("renders fallback display primitives together", () => {
    render(
      <div>
        <StatusPill status="done" />
        <MiniChain steps={[{ icon: Circle }, { icon: GitBranch }]} />
      </div>,
    );

    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});
