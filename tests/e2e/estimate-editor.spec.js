import { test, expect } from "@playwright/test";

test("estimate editor supports validation, duplication, and save", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Sign in to demo workspace" }).click();
  await page.getByRole("navigation").getByRole("link", { name: /Estimates/i }).click();

  const draftSection = page.locator("section").filter({ hasText: "AI Draft" });
  await draftSection.getByRole("button", { name: "Generate Draft" }).click();

  const editorSection = page.locator("section").filter({ hasText: "Finalize" });
  await expect(editorSection).toBeVisible();

  await editorSection.getByRole("button", { name: "Blank row" }).click();
  const saveButton = editorSection.getByRole("button", { name: "Fix Rows to Save" });
  await expect(saveButton).toBeDisabled();
  await expect(editorSection.getByText("need attention before save")).toBeVisible();

  const newRow = editorSection.locator("table").first().locator("tbody tr").last();
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

  const enabledSaveButton = editorSection.getByRole("button", { name: "Save Estimate Changes" });
  await expect(enabledSaveButton).toBeEnabled();

  const materialRows = editorSection.locator("table tbody tr:visible").filter({
    has: page.locator('input[value="E2E Test Material"]')
  });
  const countBeforeDuplicate = await materialRows.count();
  await newRow.getByRole("button", { name: "Copy row" }).click();
  await expect(materialRows).toHaveCount(countBeforeDuplicate + 1);

  const saveResponse = page.waitForResponse((response) =>
    response.url().includes("/api/estimates/") &&
    response.request().method() === "PATCH" &&
    response.status() === 200
  );
  await enabledSaveButton.click();
  await saveResponse;
});
