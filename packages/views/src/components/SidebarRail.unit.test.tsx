import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar, SidebarProvider, SidebarRail } from "@repo/ui/sidebar";

const STORAGE_KEY = "test.sidebar.width";

const renderRail = () => {
  const result = render(
    <SidebarProvider widthStorageKey={STORAGE_KEY}>
      <Sidebar collapsible="icon">
        <SidebarRail resizable />
      </Sidebar>
    </SidebarProvider>,
  );
  const wrapper = result.container.querySelector<HTMLElement>('[data-slot="sidebar-wrapper"]');
  const sidebar = result.container.querySelector<HTMLElement>('[data-slot="sidebar"][data-state]');

  if (!wrapper || !sidebar) throw new Error("Sidebar test harness did not render");

  return {
    ...result,
    rail: screen.getByRole("separator", { name: "Resize or toggle sidebar" }),
    sidebar,
    wrapper,
  };
};

const dragRail = (rail: HTMLElement, startX: number, endX: number, pointerId: number) => {
  fireEvent.pointerDown(rail, { button: 0, clientX: startX, pointerId });
  fireEvent.pointerMove(rail, { clientX: endX, pointerId });
  fireEvent.pointerUp(rail, { clientX: endX, pointerId });
};

describe("SidebarRail", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);

        return 1;
      }),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it("toggles on click and resizes with the keyboard", () => {
    const { rail, sidebar, wrapper } = renderRail();

    fireEvent.keyDown(rail, { key: "ArrowRight" });
    expect(wrapper.style.getPropertyValue("--sidebar-width")).toBe("272px");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("272");

    fireEvent.click(rail);
    expect(sidebar).toHaveAttribute("data-state", "collapsed");

    fireEvent.keyDown(rail, { key: "ArrowRight" });
    expect(sidebar).toHaveAttribute("data-state", "expanded");
    expect(wrapper.style.getPropertyValue("--sidebar-width")).toBe("272px");
  });

  it("clamps, collapses, reopens, and suppresses the click after dragging", () => {
    const { rail, sidebar, wrapper } = renderRail();

    dragRail(rail, 256, 500, 1);
    expect(sidebar).toHaveAttribute("data-state", "expanded");
    expect(wrapper.style.getPropertyValue("--sidebar-width")).toBe("384px");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("384");

    fireEvent.click(rail);
    expect(sidebar).toHaveAttribute("data-state", "expanded");

    dragRail(rail, 384, 100, 2);
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
    expect(wrapper.style.getPropertyValue("--sidebar-width")).toBe("384px");

    dragRail(rail, 48, 150, 3);
    expect(sidebar).toHaveAttribute("data-state", "expanded");
    expect(wrapper.style.getPropertyValue("--sidebar-width")).toBe("208px");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("208");
  });

  it("ignores invalid stored widths and clamps out-of-range values", () => {
    localStorage.setItem(STORAGE_KEY, "not-a-number");
    const first = renderRail();
    expect(first.wrapper.style.getPropertyValue("--sidebar-width")).toBe("256px");
    first.unmount();

    localStorage.setItem(STORAGE_KEY, "999");
    const second = renderRail();
    expect(second.wrapper.style.getPropertyValue("--sidebar-width")).toBe("384px");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("384");
  });
});
