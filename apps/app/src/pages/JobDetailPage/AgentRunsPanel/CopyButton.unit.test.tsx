import { render } from "@/test/test-wrapper";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

const writeText = vi.fn();

describe("CopyButton", () => {
  beforeEach(() => {
    writeText.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });
  });

  it("models clipboard failures as button state", async () => {
    writeText.mockRejectedValue(new Error("permission denied"));

    render(<CopyButton text="copy me" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy failed" })).toBeInTheDocument();
    });
  });
});
