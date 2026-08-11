import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import { expectNoJSErrors, navigateAndWait, test } from "./fixtures";

const fakeMcpServer = resolve(
  import.meta.dirname,
  "../../../packages/agent/src/mcp/mcpFakeServer.mjs",
);

const fillStdioConnectorForm = async (page: Page, command: string) => {
  await page.getByRole("textbox", { name: "Name" }).fill("QA Fake MCP");
  await page.getByRole("textbox", { name: "Command" }).fill(command);
  await page.getByRole("textbox", { name: "Arguments" }).fill(fakeMcpServer);
  await page.getByRole("textbox", { name: "Scopes" }).fill("files, write");
};

test.describe("Connectors Page", () => {
  test("creates, connects, invalidates edited config, and surfaces handshake failures", async ({
    page,
    pageErrors,
  }) => {
    await navigateAndWait(page, "/connectors");
    await expect(page.getByText("Local User", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add connector" }).click();
    await fillStdioConnectorForm(page, "node");
    await page.getByRole("button", { name: "Add connector" }).last().click();

    const connectorCard = page.getByRole("article").filter({ hasText: "QA Fake MCP" });
    await expect(connectorCard).toContainText("Needs setup");
    await connectorCard.getByRole("button", { name: "Test" }).click();
    await expect(connectorCard).toContainText("Connected");
    await expect(page.getByRole("status")).toContainText("Connection test completed successfully.");

    await connectorCard.getByRole("button", { name: "Manage" }).click();
    await page.getByRole("textbox", { name: "Command" }).fill("node-does-not-exist");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(connectorCard).toContainText("Needs setup");

    await connectorCard.getByRole("button", { name: "Test" }).click();
    await expect(page.getByRole("status")).toContainText("Connect connector failed");
    await expect(connectorCard).toContainText("Error");

    await page.getByRole("button", { name: "Add connector" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("QA Direct API");
    await page.getByRole("combobox", { name: "Method" }).selectOption("direct-api");
    await page.getByRole("button", { name: "Add connector" }).last().click();

    const directApiCard = page.getByRole("article").filter({ hasText: "QA Direct API" });
    await expect(directApiCard).toContainText("Needs setup");
    await expect(directApiCard.getByRole("button", { name: "Test" })).toHaveCount(0);

    await page.getByRole("button", { name: "via MCP" }).click();
    await expect(connectorCard).toBeVisible();
    await expect(directApiCard).toBeHidden();

    await page.getByRole("button", { name: "Needs setup" }).click();
    await expect(connectorCard).toBeHidden();
    await expect(directApiCard).toBeVisible();

    expectNoJSErrors(pageErrors);
  });
});
