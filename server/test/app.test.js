import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { demoData } from "../src/data.js";
import { store } from "../src/store.js";
import { startServer } from "../src/index.js";
import { config } from "../src/config.js";
import { generateEstimate, recalculateEstimate } from "../src/ai.js";
import { resetExchangeRatesCache } from "../src/exchange-rates.js";

const login = async (baseUrl, email, password) => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  return {
    status: response.status,
    body: await response.json()
  };
};

const bootstrap = async (baseUrl, token) => {
  const response = await fetch(`${baseUrl}/api/bootstrap`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  return response.json();
};

const createEstimateFixture = async ({
  companyId = "company-1",
  projectId = "project-1",
  prompt = "Generate estimate for a 60 sqm bungalow house in Quezon City",
  items,
  status = "Draft"
} = {}) => {
  const estimateItems =
    items ||
    generateEstimate({
      prompt,
      materials: demoData.materials,
      template: demoData.estimateTemplates[0]
    }).items;

  return store.insert("estimates", {
    companyId,
    projectId,
    prompt,
    createdAt: new Date().toISOString(),
    ...recalculateEstimate({
      location: "Quezon City",
      areaSqm: 60,
      wasteFactorPercent: 8,
      overheadPercent: 12,
      profitPercent: 18,
      contingencyPercent: 7,
      status,
      items: estimateItems
    })
  });
};

test("register creates an isolated tenant workspace", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Skyline Masonry",
        name: "Dana Stone",
        email: "owner@skyline.dev",
        password: "strongpass123"
      })
    });

    const registerBody = await registerResponse.json();
    assert.equal(registerResponse.status, 200);
    assert.ok(registerBody.token);

    const adminLogin = await login(baseUrl, "admin@northforge.dev", "buildintel123");
    const originalBootstrap = await bootstrap(baseUrl, adminLogin.body.token);
    const newBootstrap = await bootstrap(baseUrl, registerBody.token);

    assert.equal(
      originalBootstrap.projects.length,
      demoData.projects.filter((entry) => entry.companyId === "company-1").length
    );
    assert.equal(newBootstrap.projects.length, 0);
    assert.equal(newBootstrap.company.name, "Skyline Masonry");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("document upload enforces file size limits", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const originalMaxUploadBytes = config.maxUploadBytes;

  try {
    config.maxUploadBytes = 1024;

    const adminLogin = await login(baseUrl, "admin@northforge.dev", "buildintel123");
    const workspace = await bootstrap(baseUrl, adminLogin.body.token);
    const projectId = workspace.projects[0].id;
    const largeContent = Buffer.alloc(config.maxUploadBytes + 1, "a").toString("base64");

    const response = await fetch(`${baseUrl}/api/projects/${projectId}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminLogin.body.token}`
      },
      body: JSON.stringify({
        filename: "too-large.txt",
        notes: "oversized test upload",
        areaHint: 60,
        contentBase64: largeContent
      })
    });

    const body = await response.json();
    assert.equal(response.status, 413);
    assert.match(body.message, /Upload exceeds limit/i);
  } finally {
    config.maxUploadBytes = originalMaxUploadBytes;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("sensitive actions are captured in audit logs", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const adminLogin = await login(baseUrl, "admin@northforge.dev", "buildintel123");
    const token = adminLogin.body.token;

    const projectResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Audit Project",
        location: "Pasig City",
        description: "Audit log verification project for the hardening phase.",
        areaSqm: 88
      })
    });

    assert.equal(projectResponse.status, 201);

    const auditResponse = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const auditBody = await auditResponse.json();

    assert.equal(auditResponse.status, 200);
    assert.ok(auditBody.logs.some((entry) => entry.action === "project.create"));
    assert.ok(auditBody.logs.some((entry) => entry.action === "auth.login"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("starter plan blocks AI estimates and supplier comparison", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Starter Co",
        name: "Sam Starter",
        email: "sam@starter.dev",
        password: "strongpass123"
      })
    });
    const registerBody = await registerResponse.json();
    const token = registerBody.token;

    const aiResponse = await fetch(`${baseUrl}/api/ai/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt: "Generate estimate for a 60sqm bungalow house in Quezon City"
      })
    });

    const pricingResponse = await fetch(`${baseUrl}/api/pricing/research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        material: "10mm Rebar",
        location: "Quezon City"
      })
    });

    assert.equal(aiResponse.status, 403);
    assert.equal(pricingResponse.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("starter plan enforces project count until upgraded", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Limit Co",
        name: "Lina Limit",
        email: "lina@limit.dev",
        password: "strongpass123"
      })
    });
    const registerBody = await registerResponse.json();
    const token = registerBody.token;

    for (let index = 0; index < 5; index += 1) {
      const response = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: `Project ${index + 1}`,
          location: "Makati",
          description: `Starter plan project ${index + 1} created for plan limit testing.`,
          areaSqm: 50 + index
        })
      });
      assert.equal(response.status, 201);
    }

    const blockedResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Project 6",
        location: "Makati",
        description: "This project should be blocked by the Starter plan limit.",
        areaSqm: 72
      })
    });

    assert.equal(blockedResponse.status, 403);

    const upgradeResponse = await fetch(`${baseUrl}/api/company/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ plan: "Pro" })
    });

    assert.equal(upgradeResponse.status, 200);

    const allowedResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Project 7",
        location: "Taguig",
        description: "This project should succeed after plan upgrade.",
        areaSqm: 91
      })
    });

    assert.equal(allowedResponse.status, 201);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("pricing feed import makes new supplier rows searchable", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const adminLogin = await login(baseUrl, "admin@northforge.dev", "buildintel123");
    const token = adminLogin.body.token;

    const importResponse = await fetch(`${baseUrl}/api/pricing/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        source: "weekly-feed",
        csvText:
          "material,supplier,location,price,unit,delivery,distanceKm,confidence\n10mm Rebar,Metro Steel Supply,Pasig City,199,per piece,Available,4,high"
      })
    });

    const importBody = await importResponse.json();
    assert.equal(importResponse.status, 201);
    assert.equal(importBody.importedCount, 1);

    const pricingResponse = await fetch(`${baseUrl}/api/pricing/research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        material: "10mm Rebar",
        location: "Pasig City"
      })
    });

    const pricingBody = await pricingResponse.json();
    assert.equal(pricingResponse.status, 200);
    assert.equal(pricingBody.bestSupplier.supplier, "Metro Steel Supply");
    assert.ok(pricingBody.sources.includes("weekly-feed"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("remote pricing feed import loads external rows", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const feedServer = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/csv" });
    res.end("material,supplier,location,price,unit,delivery,distanceKm,confidence\nPortland Cement,Remote Depot,Taguig City,249,per bag,Available,6,high");
  });

  await new Promise((resolve) => feedServer.listen(0, "127.0.0.1", resolve));
  const feedPort = feedServer.address().port;

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const adminLogin = await login(baseUrl, "admin@northforge.dev", "buildintel123");
    const token = adminLogin.body.token;

    const importResponse = await fetch(`${baseUrl}/api/pricing/import-remote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        source: "remote-csv",
        url: `http://127.0.0.1:${feedPort}/feed.csv`
      })
    });

    const importBody = await importResponse.json();
    assert.equal(importResponse.status, 201);
    assert.equal(importBody.importedCount, 1);

    const pricingResponse = await fetch(`${baseUrl}/api/pricing/research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        material: "Portland Cement",
        location: "Taguig City"
      })
    });

    const pricingBody = await pricingResponse.json();
    assert.equal(pricingResponse.status, 200);
    assert.equal(pricingBody.bestSupplier.supplier, "Remote Depot");
    assert.ok(pricingBody.sources.includes("remote-csv"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => feedServer.close(resolve));
  }
});

test("estimate market refresh falls back to workspace pricing data when web search is unavailable", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const adminLogin = await login(baseUrl, "admin@northforge.dev", "buildintel123");
    const token = adminLogin.body.token;
    const estimate = await createEstimateFixture({
      items: [
        { material: "10mm Rebar", quantity: 40, unit: "piece", unitPrice: 190, category: "Materials" },
        { material: "Portland Cement", quantity: 80, unit: "bag", unitPrice: 240, category: "Materials" },
        { material: "Skilled Labor", quantity: 10, unit: "day", unitPrice: 1200, category: "Labor" }
      ]
    });

    const refreshResponse = await fetch(`${baseUrl}/api/estimates/${estimate.id}/refresh-market-prices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const refreshBody = await refreshResponse.json();

    assert.equal(refreshResponse.status, 200);
    assert.equal(refreshBody.mode, "catalog");
    assert.ok(refreshBody.refreshedCount >= 2);
    assert.ok(refreshBody.estimate.items.some((item) => item.material === "10mm Rebar" && item.unitPrice === 215));
    assert.ok(refreshBody.estimate.items.some((item) => item.material === "Portland Cement" && item.unitPrice === 260));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("account settings update profile and company details", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const adminLogin = await login(baseUrl, "admin@northforge.dev", "buildintel123");
    const token = adminLogin.body.token;

    const updateResponse = await fetch(`${baseUrl}/api/account`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Alicia Ramos Updated",
        email: "alicia.updated@northforge.dev",
        companyName: "NorthForge Builders Updated",
        preferences: {
          currencyCode: "PHP",
          themeMode: "light"
        }
      })
    });

    const updateBody = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updateBody.user.name, "Alicia Ramos Updated");
    assert.equal(updateBody.user.email, "alicia.updated@northforge.dev");
    assert.equal(updateBody.company.name, "NorthForge Builders Updated");
    assert.equal(updateBody.user.profileSettings.currencyCode, "PHP");
    assert.equal(updateBody.user.profileSettings.themeMode, "light");

    const bootstrapResponse = await bootstrap(baseUrl, token);
    assert.equal(bootstrapResponse.user.name, "Alicia Ramos Updated");
    assert.equal(bootstrapResponse.company.name, "NorthForge Builders Updated");
    assert.equal(bootstrapResponse.user.profileSettings.currencyCode, "PHP");
    assert.equal(bootstrapResponse.user.profileSettings.themeMode, "light");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("prompt templates persist at the workspace level", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const estimatorLogin = await login(baseUrl, "estimator@northforge.dev", "buildintel123");
    const token = estimatorLogin.body.token;

    const createResponse = await fetch(`${baseUrl}/api/prompt-templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        label: "Warehouse shell",
        prompt: "Generate a warehouse shell-only estimate for a 400 sqm storage building in Valenzuela. Exclude painting and electrical."
      })
    });

    const created = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(created.label, "Warehouse shell");

    const bootstrapBody = await bootstrap(baseUrl, token);
    assert.ok(bootstrapBody.promptTemplates.some((entry) => entry.id === created.id));

    const updateResponse = await fetch(`${baseUrl}/api/prompt-templates/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        label: "Warehouse shell revised",
        type: "Warehouse",
        isDefault: true
      })
    });

    const updated = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updated.label, "Warehouse shell revised");
    assert.equal(updated.type, "Warehouse");
    assert.equal(updated.isDefault, true);

    const deleteResponse = await fetch(`${baseUrl}/api/prompt-templates/${created.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    assert.equal(deleteResponse.status, 204);

    const afterDelete = await bootstrap(baseUrl, token);
    assert.ok(!afterDelete.promptTemplates.some((entry) => entry.id === created.id));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("role permissions are enforced across viewer, estimator, and admin endpoints", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const adminLogin = await login(baseUrl, "admin@northforge.dev", "buildintel123");
    const estimatorLogin = await login(baseUrl, "estimator@northforge.dev", "buildintel123");
    const viewerLogin = await login(baseUrl, "viewer@northforge.dev", "buildintel123");

    const adminToken = adminLogin.body.token;
    const estimatorToken = estimatorLogin.body.token;
    const viewerToken = viewerLogin.body.token;

    const viewerProjectResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${viewerToken}`
      },
      body: JSON.stringify({
        name: "Viewer Project Attempt",
        location: "Quezon City",
        description: "Viewer should not be able to create projects.",
        areaSqm: 55
      })
    });

    const viewerEstimateResponse = await fetch(`${baseUrl}/api/ai/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${viewerToken}`
      },
      body: JSON.stringify({
        prompt: "Generate estimate for a 60 sqm bungalow house in Quezon City"
      })
    });

    const viewerDocumentReviewResponse = await fetch(`${baseUrl}/api/documents/document-1/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${viewerToken}`
      },
      body: JSON.stringify({
        extractionSummary: "Viewer edit attempt",
        reviewStatus: "Reviewed",
        extracted: {
          roomDimensions: ["Living 4m x 5m"],
          wallLengths: 112,
          floorAreas: 60,
          structuralElements: ["roof truss"]
        }
      })
    });

    const estimatorProjectResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${estimatorToken}`
      },
      body: JSON.stringify({
        name: "Estimator Project",
        location: "Pasig City",
        description: "Estimator should be able to create projects.",
        areaSqm: 84
      })
    });

    const estimatorMaterialResponse = await fetch(`${baseUrl}/api/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${estimatorToken}`
      },
      body: JSON.stringify({
        name: "Estimator Added Material",
        unit: "bag",
        averagePrice: 199,
        lastMonthPrice: 194,
        trend: "Stable",
        suppliers: ["CW Home Depot"]
      })
    });

    const estimatorTemplateResponse = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${estimatorToken}`
      },
      body: JSON.stringify({
        name: "Estimator Template Attempt",
        overheadPercent: 12,
        profitPercent: 18,
        contingencyPercent: 7
      })
    });

    const estimatorAuditResponse = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: {
        Authorization: `Bearer ${estimatorToken}`
      }
    });

    const estimatorPlanResponse = await fetch(`${baseUrl}/api/company/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${estimatorToken}`
      },
      body: JSON.stringify({ plan: "Starter" })
    });

    const adminTemplateResponse = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: "Admin Template",
        overheadPercent: 11,
        profitPercent: 16,
        contingencyPercent: 6
      })
    });

    const adminAuditResponse = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(viewerProjectResponse.status, 403);
    assert.equal(viewerEstimateResponse.status, 403);
    assert.equal(viewerDocumentReviewResponse.status, 403);

    assert.equal(estimatorProjectResponse.status, 201);
    assert.equal(estimatorMaterialResponse.status, 201);
    assert.equal(estimatorTemplateResponse.status, 403);
    assert.equal(estimatorAuditResponse.status, 403);
    assert.equal(estimatorPlanResponse.status, 403);

    assert.equal(adminTemplateResponse.status, 201);
    assert.equal(adminAuditResponse.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("estimate approval flow enforces review and admin approval rules", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const adminLogin = await login(baseUrl, "admin@northforge.dev", "buildintel123");
    const estimatorLogin = await login(baseUrl, "estimator@northforge.dev", "buildintel123");
    const adminToken = adminLogin.body.token;
    const estimatorToken = estimatorLogin.body.token;
    const estimate = await createEstimateFixture();

    const reviewResponse = await fetch(`${baseUrl}/api/estimates/${estimate.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${estimatorToken}`
      },
      body: JSON.stringify({ status: "Reviewed" })
    });
    const reviewed = await reviewResponse.json();

    const approveDeniedResponse = await fetch(`${baseUrl}/api/estimates/${estimate.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${estimatorToken}`
      },
      body: JSON.stringify({ status: "Approved" })
    });

    const approveResponse = await fetch(`${baseUrl}/api/estimates/${estimate.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: "Approved" })
    });
    const approved = await approveResponse.json();

    const editDeniedResponse = await fetch(`${baseUrl}/api/estimates/${estimate.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${estimatorToken}`
      },
      body: JSON.stringify({
        location: "Quezon City",
        areaSqm: 60,
        wasteFactorPercent: 8,
        overheadPercent: 12,
        profitPercent: 18,
        contingencyPercent: 7,
        items: reviewed.items.map((item) => ({
          material: item.material,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          category: item.category
        }))
      })
    });

    assert.equal(reviewResponse.status, 200);
    assert.equal(reviewed.status, "Reviewed");
    assert.ok(reviewed.reviewedAt);

    assert.equal(approveDeniedResponse.status, 403);

    assert.equal(approveResponse.status, 200);
    assert.equal(approved.status, "Approved");
    assert.ok(approved.approvedAt);
    assert.equal(approved.approvedByUserId, "user-1");

    assert.equal(editDeniedResponse.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("exchange rates endpoint returns normalized rates with AED derived from USD", async () => {
  await store.init();
  await store.replaceAll(demoData);

  const originalFetch = global.fetch;
  global.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url;
    if (url?.includes("eurofxref-daily.xml")) {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <gesmes:Envelope>
          <Cube>
            <Cube time="2026-03-17">
              <Cube currency="USD" rate="1.09"/>
              <Cube currency="PHP" rate="62.5"/>
              <Cube currency="GBP" rate="0.84"/>
            </Cube>
          </Cube>
        </gesmes:Envelope>`,
        { status: 200, headers: { "Content-Type": "application/xml" } }
      );
    }
    return originalFetch(input, init);
  };

  resetExchangeRatesCache();

  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await fetch(`${baseUrl}/api/reference-data/exchange-rates`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.base, "EUR");
    assert.equal(body.date, "2026-03-17");
    assert.equal(body.rates.EUR, 1);
    assert.equal(body.rates.USD, 1.09);
    assert.equal(body.rates.PHP, 62.5);
    assert.equal(body.rates.GBP, 0.84);
    assert.equal(body.rates.AED, 1.09 * 3.6725);
  } finally {
    global.fetch = originalFetch;
    resetExchangeRatesCache();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("demo estimate generator returns richer contractor-ready line items", () => {
  const estimate = generateEstimate({
    prompt: "Generate a detailed estimate for a 60 sqm bungalow house in Quezon City, Philippines with standard residential finish.",
    materials: demoData.materials,
    template: demoData.estimateTemplates[0]
  });

  assert.ok(estimate.items.length >= 20);
  assert.ok(estimate.items.some((item) => item.category === "Labor"));
  assert.ok(estimate.items.some((item) => item.category === "Equipment"));
  assert.ok(estimate.items.some((item) => item.material === "Roofing Sheets"));
  assert.ok(estimate.items.some((item) => item.material === "Electrical Wire"));
  assert.ok(estimate.directCost > 0);
  assert.ok(estimate.finalContractPrice > estimate.directCost);
});

test("demo estimate generator responds to prompt scope and finish cues", () => {
  const premiumTwoStorey = generateEstimate({
    prompt: "Generate a premium 2-storey 120 sqm house estimate in Pasig City with 4 bedrooms and 3 bathrooms.",
    materials: demoData.materials,
    template: demoData.estimateTemplates[0]
  });

  const shellOnly = generateEstimate({
    prompt: "Generate a basic 120 sqm house shell-only estimate in Pasig City. Exclude electrical, plumbing, painting, doors, and windows.",
    materials: demoData.materials,
    template: demoData.estimateTemplates[0]
  });

  assert.ok(premiumTwoStorey.areaSqm > shellOnly.areaSqm);
  assert.ok(premiumTwoStorey.items.some((item) => item.material === "Lighting Fixtures"));
  assert.ok(!shellOnly.items.some((item) => item.material === "Lighting Fixtures"));
  assert.ok(!shellOnly.items.some((item) => item.material === "Plumbing Fixtures"));
  assert.ok(!shellOnly.items.some((item) => item.material === "Paint Finish Coat"));
  assert.ok(premiumTwoStorey.finalContractPrice > shellOnly.finalContractPrice);
});
