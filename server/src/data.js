const now = new Date().toISOString();

export const demoData = {
  companies: [
    {
      id: "company-1",
      name: "NorthForge Builders",
      slug: "northforge",
      plan: "Pro",
      ownerId: "user-1",
      createdAt: now
    }
  ],
  users: [
    {
      id: "user-1",
      companyId: "company-1",
      name: "Alicia Ramos",
      email: "admin@northforge.dev",
      passwordHash: "$2b$10$1jqFm9G5WMjyZL1XpIPnkurlLUpmJFud2pxt43V0MnPgXd5qHSM7u",
      role: "Admin",
      profileSettings: {
        currencyCode: "USD",
        themeMode: "dark"
      },
      createdAt: now
    },
    {
      id: "user-2",
      companyId: "company-1",
      name: "Marco Cruz",
      email: "estimator@northforge.dev",
      passwordHash: "$2b$10$1jqFm9G5WMjyZL1XpIPnkurlLUpmJFud2pxt43V0MnPgXd5qHSM7u",
      role: "Estimator",
      profileSettings: {
        currencyCode: "USD",
        themeMode: "dark"
      },
      createdAt: now
    },
    {
      id: "user-3",
      companyId: "company-1",
      name: "Dana Reyes",
      email: "viewer@northforge.dev",
      passwordHash: "$2b$10$1jqFm9G5WMjyZL1XpIPnkurlLUpmJFud2pxt43V0MnPgXd5qHSM7u",
      role: "Viewer",
      profileSettings: {
        currencyCode: "USD",
        themeMode: "dark"
      },
      createdAt: now
    }
  ],
  projects: [
    {
      id: "project-1",
      companyId: "company-1",
      name: "60sqm Bungalow House",
      location: "Quezon City",
      description: "Single-storey 60sqm bungalow with two bedrooms, one bath, living area, and kitchen.",
      status: "Estimating",
      areaSqm: 60,
      createdAt: now,
      blueprintSummary: {
        roomDimensions: ["Living Area 4m x 5m", "Bedroom 1 3m x 3m", "Bedroom 2 3m x 3m", "Kitchen 3m x 2.5m"],
        wallLengths: 112,
        floorAreas: 60,
        structuralElements: ["6 columns", "strip footing", "roof framing"]
      }
    }
  ],
  documents: [
    {
      id: "document-1",
      companyId: "company-1",
      projectId: "project-1",
      filename: "bungalow-floor-plan.pdf",
      storedPath: "server/uploads/company-1/document-1-bungalow-floor-plan.pdf",
      notes: "Initial floor plan upload for review.",
      areaHint: 60,
      extractionSummary: "Parsed bungalow-floor-plan.pdf. AI found 60sqm buildable area and generated a starter BOQ.",
      extracted: {
        roomDimensions: ["Living 4m x 5m", "Bedroom 1 3m x 3m", "Bedroom 2 3m x 3m", "Kitchen 3m x 2.5m", "Toilet 1.8m x 2m"],
        wallLengths: 112,
        floorAreas: 60,
        structuralElements: ["6 columns", "roof truss", "strip footing"]
      },
      boq: [
        { material: "Portland Cement", quantity: 280, unit: "bags" },
        { material: "CHB 4\"", quantity: 3200, unit: "pcs" },
        { material: "10mm Rebar", quantity: 500, unit: "pcs" }
      ],
      reviewStatus: "Reviewed",
      createdAt: now
    }
  ],
  estimateTemplates: [
    {
      id: "template-1",
      companyId: "company-1",
      name: "Residential Standard",
      overheadPercent: 12,
      profitPercent: 18,
      contingencyPercent: 7
    }
  ],
  promptTemplates: [
    {
      id: "prompt-template-1",
      companyId: "company-1",
      label: "60sqm bungalow standard",
      type: "Residential",
      isDefault: true,
      prompt: "Generate a standard 60 sqm bungalow house estimate in Quezon City with 2 bedrooms, 1 bathroom, and complete residential finishes.",
      createdAt: now
    }
  ],
  materials: [
    {
      id: "material-1",
      companyId: "company-1",
      name: "Portland Cement",
      unit: "bag",
      averagePrice: 260,
      lastMonthPrice: 245,
      trend: "Rising",
      suppliers: ["Wilcon Depot", "CW Home Depot", "Shopee"]
    },
    {
      id: "material-2",
      companyId: "company-1",
      name: "10mm Rebar",
      unit: "piece",
      averagePrice: 210,
      lastMonthPrice: 195,
      trend: "Rising",
      suppliers: ["Wilcon Depot", "Shopee", "Lazada"]
    },
    {
      id: "material-3",
      companyId: "company-1",
      name: "CHB 4\"",
      unit: "piece",
      averagePrice: 18,
      lastMonthPrice: 17.5,
      trend: "Stable",
      suppliers: ["CW Home Depot", "Handyman Do It Best"]
    }
  ],
  priceResearch: [
    {
      id: "price-1",
      material: "10mm Rebar",
      supplier: "Wilcon Depot",
      source: "seed",
      location: "Quezon City",
      price: 215,
      unit: "per piece",
      delivery: "Available",
      distanceKm: 5,
      confidence: "high",
      checkedAt: now
    },
    {
      id: "price-2",
      material: "10mm Rebar",
      supplier: "Shopee",
      source: "seed",
      location: "Metro Manila",
      price: 205,
      unit: "per piece",
      delivery: "3 days",
      distanceKm: 12,
      confidence: "medium",
      checkedAt: now
    },
    {
      id: "price-3",
      material: "Portland Cement",
      supplier: "CW Home Depot",
      source: "seed",
      location: "Quezon City",
      price: 258,
      unit: "per bag",
      delivery: "Available",
      distanceKm: 7,
      confidence: "high",
      checkedAt: now
    }
  ],
  estimates: [
    {
      id: "estimate-1",
      companyId: "company-1",
        projectId: "project-1",
        prompt: "Generate estimate for a 60sqm bungalow house in Quezon City",
        status: "Draft",
        directCost: 913600,
      overheadPercent: 12,
      profitPercent: 18,
      contingencyPercent: 7,
      finalContractPrice: 1246824,
      laborCost: 210000,
        equipmentCost: 78000,
        wasteFactorPercent: 8,
        reviewedAt: null,
        approvedAt: null,
        approvedByUserId: null,
        updatedAt: now,
        createdAt: now,
      items: [
        { material: "Portland Cement", quantity: 280, unit: "bags", unitPrice: 260, category: "Materials" },
        { material: "CHB 4\"", quantity: 3200, unit: "pcs", unitPrice: 18, category: "Materials" },
        { material: "10mm Rebar", quantity: 500, unit: "pcs", unitPrice: 210, category: "Materials" },
        { material: "Sand", quantity: 15, unit: "m3", unitPrice: 1700, category: "Materials" },
        { material: "Gravel", quantity: 14, unit: "m3", unitPrice: 1850, category: "Materials" },
        { material: "General Labor", quantity: 1, unit: "lot", unitPrice: 210000, category: "Labor" },
        { material: "Mixer & Vibrator Rental", quantity: 1, unit: "lot", unitPrice: 78000, category: "Equipment" }
      ]
    }
  ],
  alerts: [
    {
      id: "alert-1",
      type: "price",
      title: "Rebar prices increased 8% this month",
      severity: "high"
    }
  ],
  auditLogs: [],
  subscriptions: [
    {
      id: "starter",
      name: "Starter",
      priceMonthly: 49,
      features: ["5 projects", "basic estimates", "email support"]
    },
    {
      id: "pro",
      name: "Pro",
      priceMonthly: 129,
      features: ["unlimited projects", "AI estimates", "supplier comparison"]
    },
    {
      id: "enterprise",
      name: "Enterprise",
      priceMonthly: 349,
      features: ["team collaboration", "API access", "custom onboarding"]
    }
  ],
  resets: []
};
