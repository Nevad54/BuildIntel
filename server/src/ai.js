const round = (value) => Math.round(value * 100) / 100;

const normalize = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const DEFAULT_PRICE_BOOK = {
  "portland cement": 260,
  "chb 4": 18,
  "10mm rebar": 210,
  sand: 1700,
  gravel: 1850,
  "tie wire": 95,
  "coco lumber": 115,
  "roofing sheets": 620,
  "steel purlins": 255,
  "ceiling board": 320,
  "floor tiles": 640,
  "ceramic wall tiles": 710,
  "paint primer": 285,
  "paint finish coat": 355,
  "electrical wire": 42,
  "lighting fixtures": 1450,
  "pvc pipe": 220,
  "plumbing fixtures": 6800,
  "metal door set": 7800,
  "aluminum window set": 9200,
  "insulation": 210,
  "metal stud": 175,
  "gypsum board": 430,
  "vinyl plank flooring": 950,
  "suspended ceiling grid": 235,
  "convenience outlets": 180,
  "warehouse floor hardener": 480,
  "structural steel": 86,
  "roll up door": 42000,
  "wire mesh": 185,
  "rib type roofing": 720
};

const PROFILE_LIBRARY = {
  residential: {
    key: "residential",
    wasteFactorPercent: 8,
    materials(area) {
      return [
        { material: "Portland Cement", quantity: Math.round(area * 4.7), unit: "bags" },
        { material: "CHB 4\"", quantity: Math.round(area * 53), unit: "pcs" },
        { material: "10mm Rebar", quantity: Math.round(area * 8.4), unit: "pcs" },
        { material: "Sand", quantity: round(area * 0.25), unit: "m3" },
        { material: "Gravel", quantity: round(area * 0.23), unit: "m3" },
        { material: "Tie Wire", quantity: round(area * 0.18), unit: "rolls" },
        { material: "Coco Lumber", quantity: Math.round(area * 1.1), unit: "pcs" },
        { material: "Steel Purlins", quantity: Math.round(area * 1.45), unit: "pcs" },
        { material: "Roofing Sheets", quantity: round(area * 1.18), unit: "m2" },
        { material: "Ceiling Board", quantity: round(area * 1.02), unit: "m2" },
        { material: "Floor Tiles", quantity: round(area * 1.05), unit: "m2" },
        { material: "Paint Primer", quantity: Math.round(area * 0.42), unit: "gallons" },
        { material: "Paint Finish Coat", quantity: Math.round(area * 0.55), unit: "gallons" },
        { material: "Electrical Wire", quantity: Math.round(area * 6.5), unit: "meters" },
        { material: "Lighting Fixtures", quantity: Math.max(8, Math.round(area / 6)), unit: "pcs" },
        { material: "PVC Pipe", quantity: Math.round(area * 1.7), unit: "meters" },
        { material: "Plumbing Fixtures", quantity: 1, unit: "lot" },
        { material: "Metal Door Set", quantity: Math.max(4, Math.round(area / 15)), unit: "sets" },
        { material: "Aluminum Window Set", quantity: Math.max(5, Math.round(area / 12)), unit: "sets" }
      ];
    },
    labor(area) {
      return [
        { material: "Site Preparation Labor", quantity: 1, unit: "lot", unitPrice: round(area * 450) },
        { material: "Structural Labor", quantity: 1, unit: "lot", unitPrice: round(area * 1700) },
        { material: "Architectural Finishing Labor", quantity: 1, unit: "lot", unitPrice: round(area * 850) },
        { material: "Electrical and Plumbing Labor", quantity: 1, unit: "lot", unitPrice: round(area * 620) }
      ];
    },
    equipment(area) {
      return [
        { material: "Concrete Mixer Rental", quantity: 1, unit: "lot", unitPrice: round(area * 420) },
        { material: "Scaffold and Formworks Rental", quantity: 1, unit: "lot", unitPrice: round(area * 360) },
        { material: "Hauling and Delivery Equipment", quantity: 1, unit: "lot", unitPrice: round(area * 220) }
      ];
    }
  },
  fitout: {
    key: "fitout",
    wasteFactorPercent: 5,
    materials(area) {
      return [
        { material: "Metal Stud", quantity: Math.round(area * 2.3), unit: "pcs" },
        { material: "Gypsum Board", quantity: round(area * 1.7), unit: "m2" },
        { material: "Insulation", quantity: round(area * 0.95), unit: "rolls" },
        { material: "Vinyl Plank Flooring", quantity: round(area * 1.08), unit: "m2" },
        { material: "Ceiling Board", quantity: round(area * 1.02), unit: "m2" },
        { material: "Suspended Ceiling Grid", quantity: Math.round(area * 1.1), unit: "pcs" },
        { material: "Paint Primer", quantity: Math.round(area * 0.3), unit: "gallons" },
        { material: "Paint Finish Coat", quantity: Math.round(area * 0.42), unit: "gallons" },
        { material: "Electrical Wire", quantity: Math.round(area * 7.4), unit: "meters" },
        { material: "Lighting Fixtures", quantity: Math.max(10, Math.round(area / 5)), unit: "pcs" },
        { material: "Convenience Outlets", quantity: Math.max(8, Math.round(area / 8)), unit: "pcs" },
        { material: "PVC Pipe", quantity: Math.round(area * 1.2), unit: "meters" }
      ];
    },
    labor(area) {
      return [
        { material: "Partitions and Ceiling Labor", quantity: 1, unit: "lot", unitPrice: round(area * 1450) },
        { material: "Flooring and Finishing Labor", quantity: 1, unit: "lot", unitPrice: round(area * 980) },
        { material: "MEPF Fit-Out Labor", quantity: 1, unit: "lot", unitPrice: round(area * 760) }
      ];
    },
    equipment(area) {
      return [
        { material: "Mobile Scaffold Rental", quantity: 1, unit: "lot", unitPrice: round(area * 180) },
        { material: "Power Tools Rental", quantity: 1, unit: "lot", unitPrice: round(area * 140) }
      ];
    }
  },
  warehouse: {
    key: "warehouse",
    wasteFactorPercent: 6,
    materials(area) {
      return [
        { material: "Portland Cement", quantity: Math.round(area * 3.8), unit: "bags" },
        { material: "Structural Steel", quantity: Math.round(area * 11.5), unit: "kg" },
        { material: "10mm Rebar", quantity: Math.round(area * 5.6), unit: "pcs" },
        { material: "Wire Mesh", quantity: round(area * 1.04), unit: "m2" },
        { material: "Rib Type Roofing", quantity: round(area * 1.12), unit: "m2" },
        { material: "Steel Purlins", quantity: Math.round(area * 1.3), unit: "pcs" },
        { material: "Roll Up Door", quantity: Math.max(1, Math.round(area / 250)), unit: "sets" },
        { material: "Warehouse Floor Hardener", quantity: round(area * 1.02), unit: "m2" },
        { material: "Paint Primer", quantity: Math.round(area * 0.18), unit: "gallons" },
        { material: "Paint Finish Coat", quantity: Math.round(area * 0.24), unit: "gallons" },
        { material: "Electrical Wire", quantity: Math.round(area * 2.9), unit: "meters" },
        { material: "Lighting Fixtures", quantity: Math.max(12, Math.round(area / 18)), unit: "pcs" }
      ];
    },
    labor(area) {
      return [
        { material: "Structural Steel Erection Labor", quantity: 1, unit: "lot", unitPrice: round(area * 1280) },
        { material: "Slab and Masonry Labor", quantity: 1, unit: "lot", unitPrice: round(area * 840) },
        { material: "Roofing and Finishing Labor", quantity: 1, unit: "lot", unitPrice: round(area * 510) }
      ];
    },
    equipment(area) {
      return [
        { material: "Boom Lift and Manlift Rental", quantity: 1, unit: "lot", unitPrice: round(area * 260) },
        { material: "Welding Equipment Rental", quantity: 1, unit: "lot", unitPrice: round(area * 180) },
        { material: "Concrete Vibrator Rental", quantity: 1, unit: "lot", unitPrice: round(area * 120) }
      ];
    }
  }
};

const extractPromptContext = (prompt) => {
  const value = normalize(prompt);
  const hasExcludedScope = (term) =>
    new RegExp(`(exclude|excluding|without|no)\\s+(?:[a-z0-9]+\\s+){0,6}${term}`).test(value) ||
    /\bshell only\b/.test(value);
  const floorMatch = prompt.match(/(\d+)\s*[- ]?(storey|story|floor)/i);
  const bedroomMatch = prompt.match(/(\d+)\s*(bedroom|br)\b/i);
  const bathroomMatch = prompt.match(/(\d+)\s*(bathroom|bath|toilet)/i);
  const finishLevel = /(premium|high end|luxury|executive)/.test(value)
    ? "premium"
    : /(mid range|midrange|standard|typical)/.test(value)
      ? "standard"
      : /(basic|economy|bare|low cost)/.test(value)
        ? "basic"
        : "standard";

  return {
    floors: floorMatch ? Number(floorMatch[1]) : /(two storey|two story|2 storey|2 story)/.test(value) ? 2 : 1,
    bedrooms: bedroomMatch ? Number(bedroomMatch[1]) : /(bungalow|house|residential)/.test(value) ? 2 : 0,
    bathrooms: bathroomMatch ? Number(bathroomMatch[1]) : /(bungalow|house|residential)/.test(value) ? 1 : 0,
    finishLevel,
    electricalScope: !hasExcludedScope("electrical"),
    plumbingScope: !hasExcludedScope("plumbing"),
    paintingScope: !hasExcludedScope("painting"),
    ceilingScope: !/(open ceiling|no ceiling)/.test(value) && !hasExcludedScope("ceiling"),
    flooringScope: !/(bare slab|no tiles|unfinished floor)/.test(value) && !hasExcludedScope("flooring"),
    doorsAndWindowsScope: !hasExcludedScope("doors") && !hasExcludedScope("windows")
  };
};

const getFinishMultiplier = (finishLevel) => {
  if (finishLevel === "basic") {
    return 0.88;
  }

  if (finishLevel === "premium") {
    return 1.22;
  }

  return 1;
};

const scaleQuantity = (quantity, multiplier) => round(quantity * multiplier);

const tuneMaterialItems = (items, context) => {
  const finishMultiplier = getFinishMultiplier(context.finishLevel);
  const floorMultiplier = context.floors > 1 ? 1 + (context.floors - 1) * 0.82 : 1;
  const roomMultiplier = context.bedrooms > 0 ? 1 + Math.max(context.bedrooms - 2, 0) * 0.08 : 1;
  const bathMultiplier = context.bathrooms > 0 ? 1 + Math.max(context.bathrooms - 1, 0) * 0.1 : 1;

  return items
    .filter((item) => {
      const normalizedName = normalize(item.material);

      if (!context.electricalScope && /(electrical|lighting|outlets)/.test(normalizedName)) {
        return false;
      }

      if (!context.plumbingScope && /(plumbing|pvc pipe)/.test(normalizedName)) {
        return false;
      }

      if (!context.paintingScope && /paint/.test(normalizedName)) {
        return false;
      }

      if (!context.ceilingScope && /(ceiling|insulation|suspended ceiling)/.test(normalizedName)) {
        return false;
      }

      if (!context.flooringScope && /(tiles|flooring|floor hardener)/.test(normalizedName)) {
        return false;
      }

      if (!context.doorsAndWindowsScope && /(door|window)/.test(normalizedName)) {
        return false;
      }

      return true;
    })
    .map((item) => {
      let multiplier = 1;
      const normalizedName = normalize(item.material);

      if (/(paint|tiles|flooring|ceiling|lighting fixtures|plumbing fixtures|metal door set|aluminum window set|roll up door)/.test(normalizedName)) {
        multiplier *= finishMultiplier;
      }

      if (/(cement|rebar|chb|sand|gravel|tie wire|coco lumber|roofing|purlins|structural steel|wire mesh)/.test(normalizedName)) {
        multiplier *= floorMultiplier;
      }

      if (/(lighting fixtures|electrical wire|metal door set|aluminum window set)/.test(normalizedName)) {
        multiplier *= roomMultiplier;
      }

      if (/(pvc pipe|plumbing fixtures|ceramic wall tiles)/.test(normalizedName)) {
        multiplier *= bathMultiplier;
      }

      return {
        ...item,
        quantity: Math.max(item.quantity === 1 ? 1 : 0.1, scaleQuantity(item.quantity, multiplier))
      };
    });
};

const tuneLaborItems = (items, area, context) => {
  const finishMultiplier = getFinishMultiplier(context.finishLevel);
  const floorMultiplier = context.floors > 1 ? 1 + (context.floors - 1) * 0.7 : 1;
  const serviceMultiplier = (context.electricalScope ? 1 : 0.9) * (context.plumbingScope ? 1 : 0.92);

  return items
    .filter((item) => {
      const normalizedName = normalize(item.material);

      if (!context.electricalScope && /electrical/.test(normalizedName)) {
        return false;
      }

      if (!context.plumbingScope && /plumbing/.test(normalizedName)) {
        return false;
      }

      return true;
    })
    .map((item) => {
      let multiplier = floorMultiplier * serviceMultiplier;
      const normalizedName = normalize(item.material);

      if (/(finishing|fit out|architectural)/.test(normalizedName)) {
        multiplier *= finishMultiplier;
      }

      return {
        ...item,
        unitPrice: round(item.unitPrice * multiplier)
      };
    });
};

const tuneEquipmentItems = (items, context) =>
  items.map((item) => ({
    ...item,
    unitPrice: round(item.unitPrice * (context.floors > 1 ? 1.18 : 1))
  }));

const parseArea = (prompt) => {
  const match = prompt.match(/(\d+(?:\.\d+)?)\s*(sqm|sq\.?\s?m|m2)/i);
  return match ? Number(match[1]) : 60;
};

const parseLocation = (prompt) => {
  const inMatch = prompt.match(/\bin\s+([a-zA-Z0-9,\s-]+?)(?:\.|,|$)/i);
  if (inMatch) {
    return inMatch[1].trim();
  }

  const forMatch = prompt.match(/\bfor\s+[a-z0-9\s-]+\s+([A-Z][a-zA-Z\s-]+)$/);
  return forMatch ? forMatch[1].trim() : "Metro Manila";
};

const detectProfile = (prompt) => {
  const value = normalize(prompt);

  if (/(fit out|fitout|office|tenant improvement|renovation|retail)/.test(value)) {
    return PROFILE_LIBRARY.fitout;
  }

  if (/(warehouse|industrial|storage|depot)/.test(value)) {
    return PROFILE_LIBRARY.warehouse;
  }

  return PROFILE_LIBRARY.residential;
};

const sumByCategory = (items, category) =>
  items
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + item.total, 0);

const resolveMaterialPrice = (materials, materialName) => {
  const normalizedName = normalize(materialName).replace(/\bpcs\b/g, "piece").replace(/\bbags\b/g, "bag");

  const exact = materials.find((material) => normalize(material.name).replace(/\bbags\b/g, "bag").replace(/\bpcs\b/g, "piece") === normalizedName);
  if (exact?.averagePrice) {
    return exact.averagePrice;
  }

  return DEFAULT_PRICE_BOOK[normalizedName] || 100;
};

export const analyzeBlueprint = ({ filename = "plan.pdf", notes = "", areaHint = 60 }) => {
  const area = Number(areaHint) || 60;
  return {
    fileName: filename,
    extracted: {
      roomDimensions: [
        "Living 4m x 5m",
        "Bedroom 1 3m x 3m",
        "Bedroom 2 3m x 3m",
        "Kitchen 3m x 2.5m",
        "Toilet 1.8m x 2m"
      ],
      wallLengths: Math.round(area * 1.86),
      floorAreas: area,
      structuralElements: ["6 columns", "roof truss", "strip footing"]
    },
    boq: PROFILE_LIBRARY.residential.materials(area).slice(0, 6).map(({ material, quantity, unit }) => ({ material, quantity, unit })),
    summary: `Parsed ${filename}. AI found ${area}sqm buildable area and generated a starter BOQ. ${notes}`.trim()
  };
};

export const recalculateEstimate = ({
  items,
  overheadPercent,
  profitPercent,
  contingencyPercent,
  wasteFactorPercent = 0,
  location,
  areaSqm,
  status = "Draft",
  reviewedAt = null,
  approvedAt = null,
  approvedByUserId = null,
  updatedAt = new Date().toISOString()
}) => {
  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;

    return {
      ...item,
      quantity,
      unitPrice,
      total: round(quantity * unitPrice)
    };
  });

  const materialCost = sumByCategory(normalizedItems, "Materials");
  const laborCost = sumByCategory(normalizedItems, "Labor");
  const equipmentCost = sumByCategory(normalizedItems, "Equipment");
  const wasteCost = round(materialCost * ((Number(wasteFactorPercent) || 0) / 100));
  const directCost = round(materialCost + wasteCost + laborCost + equipmentCost);
  const overhead = round(directCost * ((Number(overheadPercent) || 0) / 100));
  const profit = round(directCost * ((Number(profitPercent) || 0) / 100));
  const contingency = round(directCost * ((Number(contingencyPercent) || 0) / 100));
  const finalContractPrice = round(directCost + overhead + profit + contingency);

  return {
    status,
    location,
    areaSqm: Number(areaSqm) || 0,
    wasteFactorPercent: Number(wasteFactorPercent) || 0,
    laborCost,
    equipmentCost,
    directCost,
    finalContractPrice,
    overheadPercent: Number(overheadPercent) || 0,
    profitPercent: Number(profitPercent) || 0,
    contingencyPercent: Number(contingencyPercent) || 0,
    reviewedAt,
    approvedAt,
    approvedByUserId,
    updatedAt,
    items: normalizedItems
  };
};

export const generateEstimate = ({ prompt, materials, template }) => {
  const area = parseArea(prompt);
  const location = parseLocation(prompt);
  const profile = detectProfile(prompt);
  const context = extractPromptContext(prompt);

  const resolvedMaterials = tuneMaterialItems(profile.materials(area), context).map((item) => ({
    ...item,
    category: "Materials",
    unitPrice: resolveMaterialPrice(materials, item.material)
  }));

  const laborItems = tuneLaborItems(profile.labor(area), area, context).map((item) => ({
    ...item,
    category: "Labor"
  }));

  const equipmentItems = tuneEquipmentItems(profile.equipment(area), context).map((item) => ({
    ...item,
    category: "Equipment"
  }));

  return recalculateEstimate({
    location,
    areaSqm: area * Math.max(context.floors, 1),
    wasteFactorPercent: profile.wasteFactorPercent,
    overheadPercent: template.overheadPercent,
    profitPercent: template.profitPercent,
    contingencyPercent: template.contingencyPercent,
    items: [...resolvedMaterials, ...laborItems, ...equipmentItems]
  });
};

export const simulatePricing = ({ directCost, overheadPercent, profitPercent, contingencyPercent }) => {
  const overhead = round(directCost * (overheadPercent / 100));
  const profit = round(directCost * (profitPercent / 100));
  const contingency = round(directCost * (contingencyPercent / 100));
  const finalContractPrice = round(directCost + overhead + profit + contingency);

  return {
    directCost,
    overhead,
    profit,
    contingency,
    finalContractPrice
  };
};
