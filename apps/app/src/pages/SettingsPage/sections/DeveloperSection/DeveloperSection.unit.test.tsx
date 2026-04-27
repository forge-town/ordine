import { render } from "@/test/test-wrapper";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeveloperSection } from "./DeveloperSection";

const { mockUpdateSettings } = vi.hoisted(() => ({
  mockUpdateSettings: vi.fn(),
}));

vi.mock("@repo/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange: (value: string) => void;
    value: string;
  }) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange(e.target.value);

    return (
      <select aria-label="runtime-select" value={value} onChange={handleChange}>
        {children}
      </select>
    );
  },
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock("@refinedev/core", () => ({
  useOne: () => ({
    query: { isLoading: false },
    result: {
      defaultAgentRuntime: "mastra",
      defaultOutputPath: "/tmp/ordine-output",
    },
  }),
  useUpdate: () => ({ mutateAsync: mockUpdateSettings }),
}));

describe("DeveloperSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateSettings.mockResolvedValue({ data: {} });
  });

  it("saves the selected default agent runtime", async () => {
    render(<DeveloperSection />);

    fireEvent.change(screen.getByLabelText("runtime-select"), {
      target: { value: "codex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存更改" }));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        resource: "settings",
        id: "default",
        values: {
          defaultAgentRuntime: "codex",
          defaultOutputPath: "/tmp/ordine-output",
        },
      });
    });
  });
});
