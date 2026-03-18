import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function signIn(page) {
  await signInAs(page, "admin@northforge.dev", "buildintel123");
}

async function signInAs(page, email, password) {
  await page.goto("/");
  const signInButton = page.getByRole("button", { name: "Sign in to demo workspace" });
  if (email === "admin@northforge.dev" && password === "buildintel123" && await signInButton.isVisible().catch(() => false)) {
    await signInButton.click();
  } else {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /^Sign in$/ }).click();
  }
  await expect(page.getByText("BuildIntel Workspace")).toBeVisible();
}

async function ensureProPlan(page) {
  await page.getByRole("navigation").getByRole("link", { name: /Billing/i }).click();
  await expect(page.getByRole("heading", { name: "Plan Control" })).toBeVisible();

  const planSection = page.locator("section").filter({ hasText: "Plan Control" });
  const proCard = planSection.getByRole("heading", { name: "Pro" }).locator("xpath=ancestor::div[contains(@class,'rounded-[22px]')][1]");

  if (await proCard.getByText("Active").isVisible().catch(() => false)) {
    return;
  }

  await proCard.getByRole("button", { name: "Switch Plan" }).click();
  await expect(proCard.getByText("Active")).toBeVisible();
}

test("projects page creates a project and updates its pipeline status", async ({ page }) => {
  await signIn(page);
  await ensureProPlan(page);

  await page.getByRole("navigation").getByRole("link", { name: /Projects/i }).click();
  await expect(page.getByRole("heading", { name: "Projects Pipeline" })).toBeVisible();

  const projectName = `Projects QA ${Date.now()}`;
  const intakeSection = page.locator("section").filter({ hasText: "Project Intake" });
  await intakeSection.getByLabel("Project Name").fill(projectName);
  await intakeSection.getByLabel("Location").fill("Makati City");
  await intakeSection.getByLabel("Area (sqm)").fill("95");
  await intakeSection.getByLabel("Description").fill("Project created in browser QA to validate the pipeline flow.");

  await intakeSection.getByRole("button", { name: "Add Project" }).click();

  const pipelineSection = page.locator("section").filter({ hasText: "Pipeline Board" });
  const projectCard = pipelineSection.getByText(projectName, { exact: true }).locator("xpath=ancestor::div[1]");
  await expect(projectCard).toBeVisible();

  await projectCard.getByLabel("Move To").selectOption("Submitted");

  const submittedColumn = pipelineSection.locator("div").filter({ has: page.getByRole("heading", { name: "Submitted" }) }).first();
  await expect(submittedColumn.getByText(projectName)).toBeVisible();
});

test("pricing page researches pricing and supplier matches", async ({ page }) => {
  await signIn(page);
  await ensureProPlan(page);

  await page.getByRole("navigation").getByRole("link", { name: /Pricing/i }).click();
  await expect(page.getByRole("heading", { name: "Pricing Control Room" })).toBeVisible();

  const marketSection = page.locator("section").filter({ hasText: "Research Market Rate" });
  await marketSection.getByLabel("Material").fill("10mm Rebar");
  await marketSection.getByLabel("Location").fill("Quezon City");
  await marketSection.getByRole("button", { name: "Research Price" }).click();

  await expect(page.getByText("Best Supplier")).toBeVisible();
  await expect(page.getByText("Top Price Points")).toBeVisible();

  const compareSection = page.locator("section").filter({ hasText: "Supplier Comparison" });
  await compareSection.getByLabel("Location").fill("Quezon City");
  await compareSection.getByLabel("Material").fill("10mm Rebar");
  await compareSection.getByRole("button", { name: "Find Suppliers" }).click();

  await expect(compareSection.getByText(/confidence/i)).toBeVisible();
});

test("documents page saves review edits for an uploaded file", async ({ page }) => {
  await signIn(page);

  await page.getByRole("navigation").getByRole("link", { name: /Documents/i }).click();
  await expect(page.getByRole("heading", { name: "Document Workflow" })).toBeVisible();

  const uploadSection = page.locator("section").filter({ hasText: "Upload and Analyze" });
  const filename = `review-qa-${Date.now()}.txt`;
  await uploadSection.getByLabel("Upload File").setInputFiles({
    name: filename,
    mimeType: "text/plain",
    buffer: Buffer.from("bedroom, kitchen, roof framing, slab area")
  });

  await uploadSection.getByRole("button", { name: "Upload and Analyze" }).click();

  const reviewQueue = page.locator("section").filter({ hasText: "Review Queue" });
  const reviewHeading = reviewQueue.getByRole("heading", { name: filename });
  await expect(reviewHeading).toBeVisible();
  const reviewCard = reviewHeading.locator("xpath=ancestor::div[contains(@class,'surface-card')][1]");

  await reviewCard.getByLabel("Summary").fill("QA updated summary for review workflow.");
  await reviewCard.getByLabel("Review Status").selectOption("Reviewed");

  await reviewCard.getByRole("button", { name: "Save Review" }).click();

  await expect(reviewCard.getByLabel("Summary")).toHaveValue("QA updated summary for review workflow.");
  await expect(reviewCard.getByLabel("Review Status")).toHaveValue("Reviewed");
});

test("billing page shows the active plan and creates a template", async ({ page }) => {
  await signIn(page);

  await page.getByRole("navigation").getByRole("link", { name: /Billing/i }).click();
  await expect(page.getByRole("heading", { name: "Billing and Governance" })).toBeVisible();

  const planSection = page.locator("section").filter({ hasText: "Plan Control" });
  await expect(planSection.getByText("Active")).toBeVisible();

  const templateSection = page.locator("section").filter({ hasText: "Template Studio" });
  const templateName = `QA Template ${Date.now()}`;
  await templateSection.getByLabel("Template Name").fill(templateName);
  await templateSection.getByLabel("Overhead %").fill("11");
  await templateSection.getByLabel("Profit %").fill("16");
  await templateSection.getByLabel("Contingency %").fill("6");

  await templateSection.getByRole("button", { name: "Create Template" }).click();

  await expect(templateSection.getByText(templateName)).toBeVisible();
});

test("settings page persists currency and theme choices across navigation", async ({ page }) => {
  await signIn(page);

  await page.getByRole("navigation").getByRole("link", { name: /Settings/i }).click();
  await expect(page.getByRole("heading", { name: "Workspace Preferences" })).toBeVisible();

  const settingsSection = page.locator("section").filter({ hasText: "Workspace Preferences" });
  await settingsSection.getByLabel("Currency").selectOption("PHP");
  await settingsSection.getByLabel("Appearance").selectOption("light");

  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  await expect(settingsSection.getByLabel("Currency")).toHaveValue("PHP");
  await expect(settingsSection.getByLabel("Appearance")).toHaveValue("light");
  await expect(settingsSection.getByText("Converted using Quezon City")).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: /Dashboard/i }).click();
  await expect(page.getByRole("heading", { name: "BuildIntel Workspace" })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: /Settings/i }).click();

  await expect(settingsSection.getByLabel("Currency")).toHaveValue("PHP");
  await expect(settingsSection.getByLabel("Appearance")).toHaveValue("light");
  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
});

test("estimate totals respond to currency switching for the active project location", async ({ page }) => {
  await signIn(page);

  await page.getByRole("navigation").getByRole("link", { name: /Settings/i }).click();
  const settingsSection = page.locator("section").filter({ hasText: "Workspace Preferences" });
  await settingsSection.getByLabel("Currency").selectOption("PHP");

  await page.getByRole("navigation").getByRole("link", { name: /Estimates/i }).click();
  const estimateSection = page.locator("section").filter({ hasText: "Estimator" }).first();
  const finalPriceMetric = estimateSection.locator("div").filter({ hasText: "Final Price" }).nth(0);
  await expect(finalPriceMetric).toContainText("₱");
  const phpValue = (await finalPriceMetric.textContent()) || "";

  await page.getByRole("navigation").getByRole("link", { name: /Settings/i }).click();
  await settingsSection.getByLabel("Currency").selectOption("USD");

  await page.getByRole("navigation").getByRole("link", { name: /Estimates/i }).click();
  await expect(finalPriceMetric).toContainText("$");
  const usdValue = (await finalPriceMetric.textContent()) || "";

  expect(usdValue).not.toEqual(phpValue);
});

test("estimator sees editing tools but not admin billing controls", async ({ page }) => {
  await signInAs(page, "estimator@northforge.dev", "buildintel123");

  await expect(page.getByRole("navigation").getByRole("link", { name: /Billing/i })).toHaveCount(0);

  await page.goto("/billing");
  await expect(page.getByRole("heading", { name: "BuildIntel Workspace" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: /Pricing/i }).click();
  await expect(page.getByRole("heading", { name: "Pricing Control Room" })).toBeVisible();
  await expect(page.getByText("Feed Operations")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Material" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: /Estimates/i }).click();
  await expect(page.getByRole("button", { name: "Generate Draft" })).toBeEnabled();
  await expect(page.getByText("Add rows fast")).toBeVisible();
  await expect(page.getByRole("button", { name: /No Changes to Save|Save Estimate Changes/ })).toHaveCount(1);
});

test("viewer stays in read-only mode across workspace pages", async ({ page }) => {
  await signInAs(page, "viewer@northforge.dev", "buildintel123");

  await expect(page.getByRole("navigation").getByRole("link", { name: /Billing/i })).toHaveCount(0);

  await page.getByRole("navigation").getByRole("link", { name: /Projects/i }).click();
  await expect(page.getByText("Project creation is limited")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Project" })).toHaveCount(0);

  await page.getByRole("navigation").getByRole("link", { name: /Documents/i }).click();
  await expect(page.getByText("Uploads are restricted")).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload and Analyze" })).toHaveCount(0);

  await page.getByRole("navigation").getByRole("link", { name: /Estimates/i }).click();
  await expect(page.getByText("Read-only role. Draft generation is disabled.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Draft Restricted" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Read Only" })).toBeDisabled();
});
