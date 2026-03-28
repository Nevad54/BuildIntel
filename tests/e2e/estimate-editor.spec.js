import { test, expect } from "@playwright/test";

test("estimate editor supports validation, duplication, and save", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Sign in to demo workspace" }).click();
  await page.getByRole("navigation").getByRole("link", { name: /Estimates/i }).click();

  const generateSection = page.locator("section").filter({ hasText: "Generate Draft" }).first();
  await generateSection.getByPlaceholder("60 sqm bungalow, Quezon City, standard finish, 2BR, 1 bath, complete fit-out...").fill(
    "Generate a standard 60 sqm bungalow house estimate in Quezon City with 2 bedrooms, 1 bathroom, and complete residential finishes."
  );
  await generateSection.getByRole("button", { name: "Generate Draft" }).click();

  const workspaceSection = page.locator("section").filter({ hasText: "Estimate Workspace" }).first();
  await expect(workspaceSection).toBeVisible();
  await expect(workspaceSection.getByText("No estimate yet")).toHaveCount(0);

  await workspaceSection.getByRole("button", { name: "Item Builder" }).click();
  await page.getByRole("button", { name: "Blank row" }).click();

  const saveButton = workspaceSection.getByRole("button", { name: "Fix Rows to Save" });
  await expect(saveButton).toBeDisabled();
  await expect(page.getByText("Resolve the highlighted rows before saving.")).toBeVisible();

  const newRow = workspaceSection.locator("table").first().locator("tbody tr").last();
  const materialInput = newRow.locator('input[data-estimate-field="material"]');
  const quantityInput = newRow.locator('input[data-estimate-field="quantity"]');
  const unitInput = newRow.locator('input[data-estimate-field="unit"]');
  const unitPriceInput = newRow.locator('input[data-estimate-field="unitPrice"]');
  const categorySelect = newRow.locator('select[data-estimate-field="category"]');

  await materialInput.fill("E2E Test Material");
  await materialInput.press("Enter");
  await expect(quantityInput).toBeFocused();
  await quantityInput.fill("3");
  await quantityInput.press("Enter");
  await expect(unitInput).toBeFocused();
  await unitInput.fill("bags");
  await unitInput.press("Enter");
  await expect(unitPriceInput).toBeFocused();
  await unitPriceInput.fill("99");
  await unitPriceInput.press("Enter");
  await expect(categorySelect).toBeFocused();

  const enabledSaveButton = workspaceSection.getByRole("button", { name: "Save Estimate Changes" });
  await expect(enabledSaveButton).toBeEnabled();

  await newRow.getByRole("button", { name: "Copy row" }).click();
  await expect(enabledSaveButton).toBeEnabled();

  const saveResponse = page.waitForResponse((response) =>
    response.url().includes("/api/estimates/") &&
    response.request().method() === "PATCH" &&
    response.status() === 200
  );
  await enabledSaveButton.click();
  await saveResponse;
});
