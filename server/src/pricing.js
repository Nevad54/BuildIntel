const average = (values) => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
const round = (value) => Math.round(value * 100) / 100;

const normalize = (value) => String(value || "").trim().toLowerCase();
const tokenize = (value) =>
  normalize(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const isMaterialMatch = (candidate, query) => {
  const normalizedCandidate = normalize(candidate);
  const normalizedQuery = normalize(query);

  if (!normalizedCandidate || !normalizedQuery) {
    return false;
  }

  if (normalizedCandidate === normalizedQuery) {
    return true;
  }

  if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
    return true;
  }

  const queryTokens = tokenize(query);
  const candidateTokens = new Set(tokenize(candidate));

  return queryTokens.length > 0 && queryTokens.every((token) => candidateTokens.has(token));
};

export const buildPriceAlerts = async (store, companyId) => {
  const materials = await store.list("materials", (entry) => entry.companyId === companyId);
  const derived = materials
    .map((material) => {
      const change = material.lastMonthPrice ? ((material.averagePrice - material.lastMonthPrice) / material.lastMonthPrice) * 100 : 0;
      if (Math.abs(change) < 5) {
        return null;
      }

      const direction = change > 0 ? "increased" : "dropped";
      return {
        id: `material-${material.id}`,
        type: "price",
        title: `${material.name} prices ${direction} ${Math.abs(Math.round(change))}% versus last month`,
        severity: Math.abs(change) >= 10 ? "high" : "medium"
      };
    })
    .filter(Boolean);

  const stored = await store.list("alerts");
  return [...derived, ...stored];
};

export const researchPrices = async ({ material, location }, store) => {
  const materialName = normalize(material);
  const locationName = normalize(location);

  const candidates = await store.list("priceResearch", (entry) => {
    const sameMaterial = normalize(entry.material) === materialName;
    const locationHit = !locationName || normalize(entry.location).includes(locationName);
    return sameMaterial && locationHit;
  });

  const prices = candidates.length
    ? candidates
    : await store.list("priceResearch", (entry) => normalize(entry.material) === materialName);
  const numericPrices = prices.map((entry) => Number(entry.price));
  const lowestPrice = numericPrices.length ? Math.min(...numericPrices) : 0;
  const averagePrice = round(average(numericPrices));
  const recommendedEstimatePrice = round(averagePrice * 1.03);
  const sortedSuppliers = [...prices].sort((a, b) => a.price - b.price || a.distanceKm - b.distanceKm);

  if (sortedSuppliers.length === 0) {
    const catalogMatches = await store.list("materials", (entry) => isMaterialMatch(entry.name, material));
    const catalog = catalogMatches
      .sort((a, b) => a.averagePrice - b.averagePrice)
      .map((entry) => ({
        material,
        supplier: entry.suppliers?.[0] || "Workspace catalog",
        source: "workspace-catalog",
        location: location || "Workspace catalog",
        price: Number(entry.averagePrice) || 0,
        unit: entry.unit || "unit",
        delivery: "Catalog",
        distanceKm: 0,
        confidence: "medium",
        checkedAt: null
      }));

    const catalogPrices = catalog.map((entry) => Number(entry.price)).filter((value) => value > 0);
    const catalogAverage = round(average(catalogPrices));

    return {
      material,
      location: location || "Workspace catalog",
      suppliers: catalog,
      lowestPrice: catalogPrices.length ? Math.min(...catalogPrices) : 0,
      averagePrice: catalogAverage,
      recommendedEstimatePrice: round(catalogAverage * 1.03),
      bestSupplier: catalog[0] || null,
      freshness: null,
      sources: catalog.length ? ["workspace-catalog"] : []
    };
  }

  return {
    material,
    location: location || "All suppliers",
    suppliers: sortedSuppliers,
    lowestPrice,
    averagePrice,
    recommendedEstimatePrice,
    bestSupplier: sortedSuppliers[0] || null,
    freshness: sortedSuppliers[0]?.checkedAt || null,
    sources: [...new Set(sortedSuppliers.map((entry) => entry.source).filter(Boolean))]
  };
};

export const supplierFinder = async ({ location, material }, store) =>
  (await store.list("priceResearch", (entry) => {
    const locationHit = !location || normalize(entry.location).includes(normalize(location));
    const materialHit = !material || normalize(entry.material) === normalize(material);
    return locationHit && materialHit;
  }))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.price - b.price)
    .slice(0, 6);
