import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store";
import { CanvasSettingsDrawer } from "./CanvasSettingsDrawer";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    onClick: handleClick,
    to,
  }: {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
    to: string;
  }) => (
    <a className={className} href={to} onClick={handleClick}>
      {children}
    </a>
  ),
}));

const renderOpenDrawer = () => {
  const store = createHarnessCanvasStore();
  store.setState({ isCanvasSettingsOpen: true });

  render(
    <HarnessCanvasStoreContext.Provider value={store}>
      <CanvasSettingsDrawer />
    </HarnessCanvasStoreContext.Provider>,
  );

  return store;
};

describe("CanvasSettingsDrawer", () => {
  it("renders localized canvas controls", () => {
    renderOpenDrawer();

    expect(screen.getByText(/Canvas Settings|Canvas 设置/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Show minimap|显示 MiniMap/)).toBeChecked();
    expect(screen.getByLabelText(/Show viewport controls|显示视图控制/)).not.toBeChecked();
    expect(screen.getByLabelText(/Show grid background|显示网格背景/)).toBeChecked();
    expect(screen.getByLabelText(/Snap nodes to grid|节点吸附到网格/)).not.toBeChecked();
    expect(screen.getByRole("link", { name: /Open global settings|打开全局设置/ })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("updates settings and closes without clearing canvas state", async () => {
    const user = userEvent.setup();
    const store = renderOpenDrawer();
    store.setState({
      nodes: [
        {
          id: "node-1",
          type: "file",
          position: { x: 0, y: 0 },
          data: {
            label: "User Label",
            nodeType: "file",
            filePath: "",
            language: "typescript",
            description: "",
          },
        },
      ],
    });

    await user.click(screen.getByLabelText(/Show grid background|显示网格背景/));
    expect(store.getState().canvasSettings.showBackground).toBe(false);

    await user.click(
      screen.getByRole("button", { name: /Close Canvas settings|关闭 Canvas 设置/ }),
    );
    expect(store.getState().isCanvasSettingsOpen).toBe(false);
    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().nodes[0]?.data.label).toBe("User Label");
  });
});
