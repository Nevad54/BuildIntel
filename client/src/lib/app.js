export const API_ROOT = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, "");
export const TOKEN_KEY = "buildintel.token";
export const SETTINGS_KEY = "buildintel.settings";
export const PROMPT_TEMPLATES_KEY = "buildintel.promptTemplates";

export const loginDefaults = { email: "admin@northforge.dev", password: "buildintel123" };
export const registerDefaults = { companyName: "", name: "", email: "", password: "" };
export const projectDefaults = { name: "", location: "", areaSqm: "", description: "" };
export const templateDefaults = { name: "", overheadPercent: "", profitPercent: "", contingencyPercent: "" };
export const materialDefaults = {
  name: "",
  unit: "",
  averagePrice: "",
  lastMonthPrice: "",
  trend: "Stable",
  suppliers: ""
};
export const estimateDefaults = {
  prompt: "",
  projectId: "",
  templateId: "",
  discipline: ""
};
export const documentDefaults = { projectId: "", newProjectName: "", filename: "", areaHint: "", notes: "", file: null, files: [], docType: "architectural" };
export const researchDefaults = { material: "", location: "" };
export const supplierDefaults = { material: "", location: "" };
export const pricingImportDefaults = {
  source: "weekly-feed",
  csvText: "material,supplier,location,price,unit,delivery,distanceKm,confidence\n"
};
export const remoteImportDefaults = { source: "remote-csv", url: "" };
export const simulationDefaults = { directCost: "", overheadPercent: "", profitPercent: "", contingencyPercent: "" };

export const navItems = [
  { to: "/dashboard", label: "Dashboard", description: "Overview and quick actions" },
  { to: "/projects", label: "Projects", description: "Pipeline and scope setup" },
  { to: "/estimates", label: "Estimates", description: "AI, simulation, and export" },
  { to: "/documents", label: "Documents", description: "Uploads and review queue" },
  { to: "/pricing", label: "Pricing", description: "Materials, alerts, suppliers" },
  { to: "/billing", label: "Billing", description: "Plan limits and admin logs" },
  { to: "/settings", label: "Settings", description: "Preferences and account" }
];

export const getNavItemsForRole = (role) =>
  navItems.filter((item) => {
    if (item.to === "/billing") {
      return role === "Admin";
    }
    return true;
  });

export const currencyChoices = [
  { value: "USD", label: "US Dollar" },
  { value: "EUR", label: "Euro" },
  { value: "GBP", label: "British Pound" },
  { value: "PHP", label: "Philippine Peso" },
  { value: "AED", label: "UAE Dirham" }
];

export const themeChoices = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" }
];

export const defaultSettings = {
  currencyCode: "USD",
  themeMode: "dark"
};

const locationCurrencyRules = [
  { currency: "PHP", patterns: [/philippines/i, /\bquezon city\b/i, /\bmakati\b/i, /\bpasig\b/i, /\btaguig\b/i, /\bmanila\b/i, /\bvalenzuela\b/i, /\bcebu\b/i, /\bdavao\b/i] },
  { currency: "AED", patterns: [/\buae\b/i, /\bdubai\b/i, /\babu dhabi\b/i, /\bsharjah\b/i] },
  { currency: "GBP", patterns: [/\buk\b/i, /\bunited kingdom\b/i, /\blondon\b/i, /\bengland\b/i, /\bscotland\b/i, /\bwales\b/i] },
  { currency: "EUR", patterns: [/\beuro/i, /\bgermany\b/i, /\bfrance\b/i, /\bspain\b/i, /\bitaly\b/i, /\bnetherlands\b/i, /\bbelgium\b/i, /\bportugal\b/i, /\bireland\b/i, /\baustria\b/i, /\bfinland\b/i] },
  { currency: "USD", patterns: [/\busa\b/i, /\bunited states\b/i, /\bnew york\b/i, /\bcalifornia\b/i, /\btexas\b/i, /\bflorida\b/i, /\bchicago\b/i, /\blos angeles\b/i] }
];

let clientIdCounter = 0;

export const createClientId = (prefix = "client") => {
  clientIdCounter += 1;

  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${clientIdCounter}`;
};

export const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const inferCurrencyFromLocation = (value, fallbackCurrency = defaultSettings.currencyCode) => {
  const text = String(value || "").trim();
  if (!text) {
    return fallbackCurrency;
  }

  for (const rule of locationCurrencyRules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.currency;
    }
  }

  return fallbackCurrency;
};

const resolveRate = (rates, currencyCode) => {
  if (currencyCode === "EUR") {
    return 1;
  }

  return Number(rates?.[currencyCode]) || null;
};

export const convertCurrencyValue = (value, targetCurrency, { baseCurrency = targetCurrency, exchangeRates } = {}) => {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue) || !targetCurrency || !baseCurrency || targetCurrency === baseCurrency) {
    return numericValue;
  }

  const rates = exchangeRates || globalThis.window?.__buildintelExchangeRates?.rates;
  const baseRate = resolveRate(rates, baseCurrency);
  const targetRate = resolveRate(rates, targetCurrency);

  if (!baseRate || !targetRate) {
    return numericValue;
  }

  return (numericValue * targetRate) / baseRate;
};

export const formatCurrency = (value, currencyCode = defaultSettings.currencyCode, options = {}) => {
  const normalizedOptions = typeof options === "string" ? { location: options } : options;
  const baseCurrency =
    normalizedOptions.baseCurrency ||
    inferCurrencyFromLocation(normalizedOptions.location, currencyCode);
  const convertedValue = convertCurrencyValue(value, currencyCode, {
    baseCurrency,
    exchangeRates: normalizedOptions.exchangeRates
  });

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0
  }).format(convertedValue);
};

export const api = async (path, { token, method = "GET", body, headers = {} } = {}) => {
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body)
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload;
};

export const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
