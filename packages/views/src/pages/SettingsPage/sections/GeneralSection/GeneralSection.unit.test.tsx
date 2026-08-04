import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NotificationStoreProvider } from "../../../../store/notificationStore";
import { ThemeStoreProvider } from "../../../../store/themeStore";
import { GeneralSection } from "./GeneralSection";

const renderSection = () =>
  render(
    <ThemeStoreProvider>
      <NotificationStoreProvider>
        <GeneralSection />
      </NotificationStoreProvider>
    </ThemeStoreProvider>,
  );

describe("GeneralSection", () => {
  it("changes theme and notification preferences", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: "深色" }));
    expect(screen.getByRole("button", { name: "深色" })).toHaveAttribute("aria-pressed", "true");

    const waiting = screen.getByRole("switch", { name: "运行需要处理" });
    expect(waiting).toHaveAttribute("aria-checked", "true");
    await user.click(waiting);
    expect(waiting).toHaveAttribute("aria-checked", "false");
  });
});
