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
        currencyCode: "PHP",
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
        currencyCode: "PHP",
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
        currencyCode: "PHP",
        themeMode: "dark"
      },
      createdAt: now
    }
  ],
  projects: [
    {
      id: "project-default",
      companyId: "company-1",
      name: "My First Project",
      location: "",
      description: "",
      status: "Estimating",
      areaSqm: 0,
      createdAt: now
    },
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
  documents: [],
  estimateTemplates: [
    { id: "tmpl-1", companyId: "company-1", name: "Standard Residential", overheadPercent: 12, profitPercent: 18, contingencyPercent: 7 }
  ],
  promptTemplates: [],
  materials: [
    { id: "mat-1", companyId: "company-1", name: "Portland Cement (Type I)", unit: "bag", averagePrice: 260, lastMonthPrice: 250, trend: "Rising", suppliers: ["Wilcon Depot", "CW Home Depot"] },
    { id: "mat-2", companyId: "company-1", name: "10mm Deformed Bar (Rebar)", unit: "piece", averagePrice: 215, lastMonthPrice: 210, trend: "Rising", suppliers: ["Wilcon Depot", "Handyman"] },
    { id: "mat-3", companyId: "company-1", name: "12mm Deformed Bar (Rebar)", unit: "piece", averagePrice: 310, lastMonthPrice: 308, trend: "Stable", suppliers: ["Wilcon Depot", "Metro Steel"] },
    { id: "mat-4", companyId: "company-1", name: "CHB 4\" (Concrete Hollow Block)", unit: "piece", averagePrice: 18, lastMonthPrice: 18, trend: "Stable", suppliers: ["CW Home Depot", "Handyman"] },
    { id: "mat-5", companyId: "company-1", name: "Washed Sand", unit: "cu.m.", averagePrice: 1700, lastMonthPrice: 1650, trend: "Rising", suppliers: ["Local Quarry", "Shopee"] },
    { id: "mat-6", companyId: "company-1", name: "Crushed Gravel (3/4\")", unit: "cu.m.", averagePrice: 1850, lastMonthPrice: 1850, trend: "Stable", suppliers: ["Local Quarry"] },
    { id: "mat-7", companyId: "company-1", name: "Plain Cement Board (4.5mm)", unit: "sheet", averagePrice: 380, lastMonthPrice: 365, trend: "Rising", suppliers: ["Wilcon Depot", "CW Home Depot"] },
    { id: "mat-8", companyId: "company-1", name: "Corrugated G.I. Sheet (pre-painted)", unit: "sheet", averagePrice: 520, lastMonthPrice: 510, trend: "Stable", suppliers: ["Wilcon Depot", "Handyman"] }
  ],
  priceResearch: [],
  estimates: [],
  alerts: [],
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
