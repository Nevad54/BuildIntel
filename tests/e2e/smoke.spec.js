import { test, expect } from "@playwright/test";

test("core estimating flow works through the UI", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Sign in to demo workspace" }).click();
  await expect(page.getByText("BuildIntel Workspace")).toBeVisible();

  const projectName = `E2E Project ${Date.now()}`;
  const projectForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add Project" }) });
  await projectForm.getByLabel("Project Name").fill(projectName);
  await projectForm.getByLabel("Location").fill("Pasig City");
  await projectForm.getByLabel("Area (sqm)").fill("84");
  await projectForm.getByLabel("Description").fill("End-to-end project created by Playwright to validate the launch flow.");
  await projectForm.getByRole("button", { name: "Add Project" }).click();

  await page.getByRole("navigation").getByRole("link", { name: /Documents/i }).click();
  const documentSection = page.locator("section").filter({ hasText: "Upload and Analyze" });
  await documentSection.locator('input[type="file"]').setInputFiles({
    name: "scope-sheet.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("living room, slab, roof framing")
  });
  await documentSection.getByRole("button", { name: "Upload and Analyze" }).click();
  await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: /Pricing/i }).click();
  await expect(page.getByRole("heading", { name: "Pricing Control Room" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Supplier Comparison" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: /Billing/i }).click();
  await expect(page.getByRole("heading", { name: "Billing and Governance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Control" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: /Settings/i }).click();
  await expect(page.getByRole("heading", { name: "Workspace Preferences" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account and Identity" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: /Estimates/i }).click();
  const generateSection = page.locator("section").filter({ hasText: "Generate Draft" }).first();
  await generateSection.getByPlaceholder("60 sqm bungalow, Quezon City, standard finish, 2BR, 1 bath, complete fit-out...").fill(
    "Generate a standard 84 sqm bungalow house estimate in Pasig City with 2 bedrooms, 1 bathroom, and complete residential finishes."
  );
  await generateSection.getByRole("button", { name: "Generate Draft" }).click();

  const workspaceSection = page.locator("section").filter({ hasText: "Estimate Workspace" }).first();
  await expect(workspaceSection).toBeVisible();
  await expect(page.getByText("Final Price").first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export/i }).click();
  await page.getByRole("button", { name: "Export PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("estimate.pdf");
});
