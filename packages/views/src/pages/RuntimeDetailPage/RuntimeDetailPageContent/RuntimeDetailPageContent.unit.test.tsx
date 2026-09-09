import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { RuntimeDetailPageContent } from "./RuntimeDetailPageContent";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), navigate: vi.fn(), pending: false }));
vi.mock("@refinedev/core", () => ({
  useOne: () => ({
    result: { id: "runtime-1", name: "Codex", type: "codex", connection: { mode: "local" } },
    query: { isLoading: false },
  }),
  useDelete: () => ({ mutate: mocks.remove, mutation: { isPending: mocks.pending } }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ runtimeId: "runtime-1" }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
vi.mock("../../../components/PageHeader", () => ({
  PageHeader: ({ actions }: { actions: ReactNode }) => <header>{actions}</header>,
}));
vi.mock("../../../platform", () => ({ usePlatform: () => ({ apiBaseUrl: "/api" }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = false;
});

describe("Runtime deletion", () => {
  it("confirms twice, deletes the selected ID, and navigates only after success", async () => {
    const user = userEvent.setup();
    render(<RuntimeDetailPageContent />);
    const button = screen.getByRole("button", { name: "Delete" });
    await user.click(button);
    expect(mocks.remove).not.toHaveBeenCalled();
    await user.click(button);
    expect(mocks.remove).toHaveBeenCalledWith(
      { resource: "agentRuntimes", id: "runtime-1" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
    act(() => mocks.remove.mock.calls[0]?.[1].onSuccess());
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/runtimes" });
  });
  it("disables duplicate deletion while the mutation is pending", () => {
    mocks.pending = true;
    render(<RuntimeDetailPageContent />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
