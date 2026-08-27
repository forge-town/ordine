import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../../../test/test-wrapper";
import { ConversationsPageContent } from "./ConversationsPageContent";

describe("ConversationsPageContent", () => {
  it("renders the empty state when no conversations exist", async () => {
    render(<ConversationsPageContent />);

    expect(await screen.findByText("Conversations")).toBeInTheDocument();
    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
  });
});
