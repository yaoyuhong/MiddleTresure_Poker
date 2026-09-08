import { expect, test } from "@playwright/test";

test("shows the poker club product entry point", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Middle Treasure Poker" }),
  ).toBeVisible();
  await expect(
    page.getByText("Private games. Clear settlement."),
  ).toBeVisible();
});
