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
  "rib type roofing": 720,
  // Civil works
  "pvc coupling": 85,
  "pvc elbow": 95,
  "pvc tee": 110,
  "pvc reducer": 120,
  "gi pipe": 680,
  "gi coupling": 95,
  "gate valve box cover": 650,
  "hydrant marker post": 280,
  "concrete thrust block": 1800,
  "gravel bedding": 1200,
  "pvc primer": 180,
  "pvc solvent cement": 220,
  "pipe joint lubricant": 95,
  "teflon tape": 35,
  "safety vest": 280,
  "hard hat": 350,
  "barricade": 850,
  "safety cone": 180,
  "sand": 1200,
  // Road pavement
  "gravel sub-base": 1100,
  "crushed aggregate base course": 1350,
  "curb and gutter": 850,
  "road pavement marking": 280,
  "12mm deformed bar": 245
};

const PROFILE_LIBRARY = {
  residential: {
    key: "residential",
    wasteFactorPercent: 8,
    materials(area) {
      return [
        { material: "Portland Cement", quantity: Math.round(area * 4.7), unit: "bags", qtoFormula: `${area}sqm × 4.7 bags/sqm = ${Math.round(area * 4.7)} bags` },
        { material: "CHB 4\"", quantity: Math.round(area * 53), unit: "pcs", qtoFormula: `${area}sqm × 53 pcs/sqm = ${Math.round(area * 53)} pcs` },
        { material: "10mm Rebar", quantity: Math.round(area * 8.4), unit: "pcs", qtoFormula: `${area}sqm × 8.4 pcs/sqm = ${Math.round(area * 8.4)} pcs` },
        { material: "Sand", quantity: round(area * 0.25), unit: "m3", qtoFormula: `${area}sqm × 0.25 m³/sqm = ${round(area * 0.25)} m³` },
        { material: "Gravel", quantity: round(area * 0.23), unit: "m3", qtoFormula: `${area}sqm × 0.23 m³/sqm = ${round(area * 0.23)} m³` },
        { material: "Tie Wire", quantity: round(area * 0.18), unit: "rolls", qtoFormula: `${area}sqm × 0.18 rolls/sqm = ${round(area * 0.18)} rolls` },
        { material: "Coco Lumber", quantity: Math.round(area * 1.1), unit: "pcs", qtoFormula: `${area}sqm × 1.1 pcs/sqm = ${Math.round(area * 1.1)} pcs` },
        { material: "Steel Purlins", quantity: Math.round(area * 1.45), unit: "pcs", qtoFormula: `${area}sqm × 1.45 pcs/sqm = ${Math.round(area * 1.45)} pcs` },
        { material: "Roofing Sheets", quantity: round(area * 1.18), unit: "m2", qtoFormula: `${area}sqm × 1.18 (roof pitch factor) = ${round(area * 1.18)} m²` },
        { material: "Ceiling Board", quantity: round(area * 1.02), unit: "m2", qtoFormula: `${area}sqm × 1.02 (2% waste) = ${round(area * 1.02)} m²` },
        { material: "Floor Tiles", quantity: round(area * 1.05), unit: "m2", qtoFormula: `${area}sqm × 1.05 (5% waste/cuts) = ${round(area * 1.05)} m²` },
        { material: "Paint Primer", quantity: Math.round(area * 0.42), unit: "gallons", qtoFormula: `${area}sqm × 0.42 gal/sqm = ${Math.round(area * 0.42)} gal` },
        { material: "Paint Finish Coat", quantity: Math.round(area * 0.55), unit: "gallons", qtoFormula: `${area}sqm × 0.55 gal/sqm = ${Math.round(area * 0.55)} gal` },
        { material: "Electrical Wire", quantity: Math.round(area * 6.5), unit: "meters", qtoFormula: `${area}sqm × 6.5 m/sqm = ${Math.round(area * 6.5)} m` },
        { material: "Lighting Fixtures", quantity: Math.max(8, Math.round(area / 6)), unit: "pcs", qtoFormula: `${area}sqm ÷ 6 sqm/fixture = ${Math.max(8, Math.round(area / 6))} pcs (min 8)` },
        { material: "PVC Pipe", quantity: Math.round(area * 1.7), unit: "meters", qtoFormula: `${area}sqm × 1.7 m/sqm = ${Math.round(area * 1.7)} m` },
        { material: "Plumbing Fixtures", quantity: 1, unit: "lot", qtoFormula: "1 lot (complete plumbing fixtures set)" },
        { material: "Metal Door Set", quantity: Math.max(4, Math.round(area / 15)), unit: "sets", qtoFormula: `${area}sqm ÷ 15 sqm/door = ${Math.max(4, Math.round(area / 15))} sets (min 4)` },
        { material: "Aluminum Window Set", quantity: Math.max(5, Math.round(area / 12)), unit: "sets", qtoFormula: `${area}sqm ÷ 12 sqm/window = ${Math.max(5, Math.round(area / 12))} sets (min 5)` }
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
        { material: "Metal Stud", quantity: Math.round(area * 2.3), unit: "pcs", qtoFormula: `${area}sqm × 2.3 pcs/sqm = ${Math.round(area * 2.3)} pcs` },
        { material: "Gypsum Board", quantity: round(area * 1.7), unit: "m2", qtoFormula: `${area}sqm × 1.7 (walls + ceiling) = ${round(area * 1.7)} m²` },
        { material: "Insulation", quantity: round(area * 0.95), unit: "rolls", qtoFormula: `${area}sqm × 0.95 rolls/sqm = ${round(area * 0.95)} rolls` },
        { material: "Vinyl Plank Flooring", quantity: round(area * 1.08), unit: "m2", qtoFormula: `${area}sqm × 1.08 (8% waste) = ${round(area * 1.08)} m²` },
        { material: "Ceiling Board", quantity: round(area * 1.02), unit: "m2", qtoFormula: `${area}sqm × 1.02 (2% waste) = ${round(area * 1.02)} m²` },
        { material: "Suspended Ceiling Grid", quantity: Math.round(area * 1.1), unit: "pcs", qtoFormula: `${area}sqm × 1.1 pcs/sqm = ${Math.round(area * 1.1)} pcs` },
        { material: "Paint Primer", quantity: Math.round(area * 0.3), unit: "gallons", qtoFormula: `${area}sqm × 0.30 gal/sqm = ${Math.round(area * 0.3)} gal` },
        { material: "Paint Finish Coat", quantity: Math.round(area * 0.42), unit: "gallons", qtoFormula: `${area}sqm × 0.42 gal/sqm = ${Math.round(area * 0.42)} gal` },
        { material: "Electrical Wire", quantity: Math.round(area * 7.4), unit: "meters", qtoFormula: `${area}sqm × 7.4 m/sqm = ${Math.round(area * 7.4)} m` },
        { material: "Lighting Fixtures", quantity: Math.max(10, Math.round(area / 5)), unit: "pcs", qtoFormula: `${area}sqm ÷ 5 sqm/fixture = ${Math.max(10, Math.round(area / 5))} pcs (min 10)` },
        { material: "Convenience Outlets", quantity: Math.max(8, Math.round(area / 8)), unit: "pcs", qtoFormula: `${area}sqm ÷ 8 sqm/outlet = ${Math.max(8, Math.round(area / 8))} pcs (min 8)` },
        { material: "PVC Pipe", quantity: Math.round(area * 1.2), unit: "meters", qtoFormula: `${area}sqm × 1.2 m/sqm = ${Math.round(area * 1.2)} m` }
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
  structural: {
    key: "structural",
    wasteFactorPercent: 7,
    materials(area) {
      return [
        { material: "Portland Cement", quantity: Math.round(area * 6.2), unit: "bags" },
        { material: "10mm Rebar", quantity: Math.round(area * 11.4), unit: "pcs" },
        { material: "Sand", quantity: round(area * 0.38), unit: "m3" },
        { material: "Gravel", quantity: round(area * 0.34), unit: "m3" },
        { material: "Tie Wire", quantity: round(area * 0.28), unit: "rolls" },
        { material: "Coco Lumber", quantity: Math.round(area * 1.6), unit: "pcs" }
      ];
    },
    labor(area) {
      return [
        { material: "Formworks and Shoring Labor", quantity: 1, unit: "lot", unitPrice: round(area * 980) },
        { material: "Rebar Fabrication and Installation Labor", quantity: 1, unit: "lot", unitPrice: round(area * 1420) },
        { material: "Concrete Pouring and Curing Labor", quantity: 1, unit: "lot", unitPrice: round(area * 760) },
        { material: "Structural Supervision (Licensed Civil Engineer)", quantity: 1, unit: "lot", unitPrice: round(area * 320) }
      ];
    },
    equipment(area) {
      return [
        { material: "Concrete Mixer Rental", quantity: 1, unit: "lot", unitPrice: round(area * 520) },
        { material: "Scaffold and Formworks Rental", quantity: 1, unit: "lot", unitPrice: round(area * 440) },
        { material: "Concrete Vibrator Rental", quantity: 1, unit: "lot", unitPrice: round(area * 180) }
      ];
    }
  },
  architectural: {
    key: "architectural",
    wasteFactorPercent: 6,
    materials(area) {
      return [
        { material: "Floor Tiles", quantity: round(area * 1.08), unit: "m2" },
        { material: "Ceramic Wall Tiles", quantity: round(area * 0.62), unit: "m2" },
        { material: "Paint Primer", quantity: Math.round(area * 0.44), unit: "gallons" },
        { material: "Paint Finish Coat", quantity: Math.round(area * 0.58), unit: "gallons" },
        { material: "Ceiling Board", quantity: round(area * 1.04), unit: "m2" },
        { material: "Suspended Ceiling Grid", quantity: Math.round(area * 1.1), unit: "pcs" },
        { material: "Metal Door Set", quantity: Math.max(3, Math.round(area / 14)), unit: "sets" },
        { material: "Aluminum Window Set", quantity: Math.max(4, Math.round(area / 11)), unit: "sets" }
      ];
    },
    labor(area) {
      return [
        { material: "Tiling Labor (Floor and Wall)", quantity: 1, unit: "lot", unitPrice: round(area * 680) },
        { material: "Painting Labor", quantity: 1, unit: "lot", unitPrice: round(area * 420) },
        { material: "Ceiling and Trim Labor", quantity: 1, unit: "lot", unitPrice: round(area * 380) },
        { material: "Doors and Windows Installation Labor", quantity: 1, unit: "lot", unitPrice: round(area * 290) }
      ];
    },
    equipment(area) {
      return [
        { material: "Mobile Scaffold Rental", quantity: 1, unit: "lot", unitPrice: round(area * 160) },
        { material: "Power Tools Rental", quantity: 1, unit: "lot", unitPrice: round(area * 120) }
      ];
    }
  },
  electrical: {
    key: "electrical",
    wasteFactorPercent: 5,
    materials(area) {
      return [
        { material: "Electrical Wire", quantity: Math.round(area * 8.5), unit: "meters" },
        { material: "PVC Conduit", quantity: Math.round(area * 4.2), unit: "meters" },
        { material: "Lighting Fixtures", quantity: Math.max(8, Math.round(area / 5)), unit: "pcs" },
        { material: "Convenience Outlets", quantity: Math.max(6, Math.round(area / 7)), unit: "pcs" },
        { material: "Panel Board", quantity: 1, unit: "set" },
        { material: "Circuit Breakers", quantity: Math.max(8, Math.round(area / 10)), unit: "pcs" }
      ];
    },
    labor(area) {
      return [
        { material: "Rough-in Wiring and Conduit Labor", quantity: 1, unit: "lot", unitPrice: round(area * 820) },
        { material: "Fixtures and Outlet Installation Labor", quantity: 1, unit: "lot", unitPrice: round(area * 560) },
        { material: "Panel Board and Circuit Schedule Labor", quantity: 1, unit: "lot", unitPrice: round(area * 380) },
        { material: "Licensed Master Electrician Supervision (RA 7920)", quantity: 1, unit: "lot", unitPrice: round(area * 240) }
      ];
    },
    equipment(area) {
      return [
        { material: "Cable Pulling Tools Rental", quantity: 1, unit: "lot", unitPrice: round(area * 140) },
        { material: "Testing Equipment (Insulation and Continuity)", quantity: 1, unit: "lot", unitPrice: round(area * 110) }
      ];
    }
  },
  plumbing: {
    key: "plumbing",
    wasteFactorPercent: 5,
    materials(area) {
      return [
        { material: "PVC Pipe", quantity: Math.round(area * 2.8), unit: "meters" },
        { material: "GI Pipe (Supply)", quantity: Math.round(area * 1.4), unit: "meters" },
        { material: "Plumbing Fixtures", quantity: Math.max(1, Math.round(area / 25)), unit: "lot" },
        { material: "PVC Fittings", quantity: Math.round(area * 3.2), unit: "pcs" },
        { material: "Gate Valves", quantity: Math.max(4, Math.round(area / 18)), unit: "pcs" }
      ];
    },
    labor(area) {
      return [
        { material: "Water Supply Rough-in Labor", quantity: 1, unit: "lot", unitPrice: round(area * 620) },
        { material: "Drainage and Sanitary Labor", quantity: 1, unit: "lot", unitPrice: round(area * 740) },
        { material: "Fixture Installation Labor", quantity: 1, unit: "lot", unitPrice: round(area * 480) },
        { material: "Licensed Master Plumber Supervision (RA 1378)", quantity: 1, unit: "lot", unitPrice: round(area * 220) }
      ];
    },
    equipment(area) {
      return [
        { material: "Pipe Threading and Cutting Equipment", quantity: 1, unit: "lot", unitPrice: round(area * 130) },
        { material: "Pressure Testing Equipment", quantity: 1, unit: "lot", unitPrice: round(area * 90) }
      ];
    }
  },
  firePro: {
    key: "firePro",
    wasteFactorPercent: 4,
    materials(area) {
      return [
        { material: "Sprinkler Heads (Wet Pipe)", quantity: Math.ceil(area / 10), unit: "pcs" },
        { material: "Sprinkler Pipe (Black Steel SCH 40)", quantity: Math.round(area * 1.6), unit: "meters" },
        { material: "Smoke Detectors (Photoelectric)", quantity: Math.ceil(area / 30), unit: "pcs" },
        { material: "Heat Detectors", quantity: Math.max(2, Math.ceil(area / 60)), unit: "pcs" },
        { material: "Fire Alarm Control Panel (Addressable)", quantity: 1, unit: "set" },
        { material: "Horn-Strobe Notification Appliances", quantity: Math.ceil(area / 40), unit: "pcs" },
        { material: "Manual Pull Stations", quantity: Math.max(2, Math.ceil(area / 80)), unit: "pcs" },
        { material: "Fire Hose Cabinet", quantity: Math.max(1, Math.ceil(area / 30)), unit: "sets" },
        { material: "Fire Extinguishers (per RA 9514)", quantity: Math.max(2, Math.ceil(area / 50)), unit: "pcs" }
      ];
    },
    labor(area) {
      return [
        { material: "Sprinkler System Installation Labor", quantity: 1, unit: "lot", unitPrice: round(area * 980) },
        { material: "Fire Alarm Wiring and Device Labor", quantity: 1, unit: "lot", unitPrice: round(area * 620) },
        { material: "Fire Extinguisher and Hose Cabinet Labor", quantity: 1, unit: "lot", unitPrice: round(area * 280) },
        { material: "BFP Permit Assistance (Flat Fee)", quantity: 1, unit: "lot", unitPrice: 15000 }
      ];
    },
    equipment(area) {
      return [
        { material: "Pipe Cutting and Threading Equipment", quantity: 1, unit: "lot", unitPrice: round(area * 160) },
        { material: "Hydrostatic Test Pump (200 psi)", quantity: 1, unit: "lot", unitPrice: round(area * 120) }
      ];
    }
  },
  highrise: {
    key: "highrise",
    wasteFactorPercent: 6,
    materials(area) {
      return [
        { material: "Portland Cement", quantity: Math.round(area * 7.8), unit: "bags" },
        { material: "10mm Rebar", quantity: Math.round(area * 14.5), unit: "pcs" },
        { material: "Sand", quantity: round(area * 0.46), unit: "m3" },
        { material: "Gravel", quantity: round(area * 0.42), unit: "m3" },
        { material: "Structural Steel", quantity: Math.round(area * 18), unit: "kg" },
        { material: "Aluminum Curtain Wall System", quantity: round(area * 0.35), unit: "m2" },
        { material: "Post-Tension Strand", quantity: Math.round(area * 2.2), unit: "meters" },
        { material: "Elevator (Passenger)", quantity: Math.max(1, Math.round(area / 800)), unit: "unit" },
        { material: "Building Management System (BMS)", quantity: 1, unit: "lot" }
      ];
    },
    labor(area) {
      return [
        { material: "Core Wall and Shear Wall Labor", quantity: 1, unit: "lot", unitPrice: round(area * 2200) },
        { material: "Post-Tensioned Slab Labor", quantity: 1, unit: "lot", unitPrice: round(area * 1850) },
        { material: "Curtain Wall Installation Labor", quantity: 1, unit: "lot", unitPrice: round(area * 980) },
        { material: "Full MEP (Mechanical, Electrical, Plumbing) Labor", quantity: 1, unit: "lot", unitPrice: round(area * 1640) },
        { material: "Structural Peer Review (SEOR)", quantity: 1, unit: "lot", unitPrice: round(area * 420) }
      ];
    },
    equipment(area) {
      return [
        { material: "Tower Crane Rental", quantity: 1, unit: "lot", unitPrice: round(area * 680) },
        { material: "Formworks (Climbing System)", quantity: 1, unit: "lot", unitPrice: round(area * 520) },
        { material: "Concrete Pump and Boom", quantity: 1, unit: "lot", unitPrice: round(area * 340) }
      ];
    }
  },
  prefab: {
    key: "prefab",
    wasteFactorPercent: 4,
    materials(area) {
      return [
        { material: "Precast RC Columns", quantity: Math.ceil(area / 24), unit: "pcs" },
        { material: "Precast Inverted-T Beams", quantity: Math.ceil(area / 8), unit: "pcs" },
        { material: "Hollow Core Precast Slab (265mm)", quantity: round(area * 1.04), unit: "m2" },
        { material: "Insulated Precast Wall Panels", quantity: round(area * 0.85), unit: "m2" },
        { material: "Non-Shrink Grout", quantity: Math.round(area * 0.12), unit: "bags" },
        { material: "Embedded Plate and Bolted Connection", quantity: Math.ceil(area / 6), unit: "sets" }
      ];
    },
    labor(area) {
      return [
        { material: "Precast Manufacturing QC Labor", quantity: 1, unit: "lot", unitPrice: round(area * 860) },
        { material: "Erection and Connection Labor", quantity: 1, unit: "lot", unitPrice: round(area * 1240) },
        { material: "Grouting and Topping Labor", quantity: 1, unit: "lot", unitPrice: round(area * 480) },
        { material: "BIM / 3D Clash Check and Erection Sequence Plan", quantity: 1, unit: "lot", unitPrice: round(area * 180) }
      ];
    },
    equipment(area) {
      return [
        { material: "Mobile Crane Rental (Erection)", quantity: 1, unit: "lot", unitPrice: round(area * 580) },
        { material: "Lowbed Trailer Transport", quantity: 1, unit: "lot", unitPrice: round(area * 260) },
        { material: "Temporary Bracing Equipment", quantity: 1, unit: "lot", unitPrice: round(area * 190) }
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

// ── Civil works helpers ──────────────────────────────────────────────────────

// Parse total pipe length (in meters) from a civil prompt string.
// Looks for patterns like "Total road length: 6147m" or "2952m" near pipe mentions.
const parseCivilPipeLength = (prompt) => {
  const roadMatch = prompt.match(/total road length[:\s]+(\d+(?:\.\d+)?)\s*m/i);
  if (roadMatch) return Number(roadMatch[1]);
  // Fallback: largest standalone metre value in the prompt
  const allM = [...prompt.matchAll(/(\d+(?:\.\d+)?)\s*m\b/g)].map((m) => Number(m[1]));
  return allM.length ? Math.max(...allM) : 1000;
};

// Parse fixture counts from civil prompt ("Fire hydrants: 9 pcs" etc.)
const parseCivilFixture = (prompt, pattern) => {
  const m = prompt.match(new RegExp(pattern + "[:\\s]+(\\d+)", "i"));
  return m ? Number(m[1]) : 0;
};

// Parse individual waterline pipe rows from the consolidated prompt.
// Prompt contains entries like:
//   "100mm PVC waterline: 2952m"  or  "Waterline pipe (size TBC): 2952m"
// Returns array of { label, lengthM }
const parseWaterlinePipes = (prompt) => {
  const rows = [];
  // Named size: "100mm PVC waterline: 2952m" or "6" PVC waterline: 1200m"
  const namedRe = /(\d+(?:mm|"))\s*(?:pvc\s*)?waterline[:\s]+(\d+(?:\.\d+)?)\s*m/gi;
  let m;
  while ((m = namedRe.exec(prompt)) !== null) {
    rows.push({ label: `${m[1]} PVC waterline pipe`, lengthM: Number(m[2]) });
  }
  // TBC fallback: "Waterline pipe (size TBC): 2952m"
  const tbcRe = /waterline pipe \(size tbc\)[:\s]+(\d+(?:\.\d+)?)\s*m/gi;
  while ((m = tbcRe.exec(prompt)) !== null) {
    rows.push({ label: "PVC waterline pipe (size TBC)", lengthM: Number(m[1]) });
  }
  return rows;
};

// Parse individual drainage pipe rows from the prompt.
// Returns array of { label, lengthM }
const parseDrainagePipes = (prompt) => {
  const rows = [];
  // Named RCP: "450mm RCP drainage: 1500m"
  const namedRe = /(\d+(?:mm|"))\s*(?:rcp\s*)?drainage[:\s]+(\d+(?:\.\d+)?)\s*m/gi;
  let m;
  while ((m = namedRe.exec(prompt)) !== null) {
    rows.push({ label: `${m[1]} RCP drainage pipe`, lengthM: Number(m[2]) });
  }
  // TBC fallback
  const tbcRe = /drainage pipe \(size tbc\)[:\s]+(\d+(?:\.\d+)?)\s*m/gi;
  while ((m = tbcRe.exec(prompt)) !== null) {
    rows.push({ label: "RCP drainage pipe (size TBC)", lengthM: Number(m[1]) });
  }
  return rows;
};

// Parse total road length from a civil prompt
const parseTotalRoadLength = (prompt) => {
  const m = prompt.match(/total road[:\s]+(\d+(?:\.\d+)?)\s*m/i);
  if (m) return Number(m[1]);
  const m2 = prompt.match(/road length[:\s]+(\d+(?:\.\d+)?)\s*m/i);
  if (m2) return Number(m2[1]);
  return 0;
};

PROFILE_LIBRARY.civil = {
  key: "civil",
  wasteFactorPercent: 5,
  materials(area, prompt = "") {
    const p = prompt || "";
    // Parse individual pipe rows so the BOQ shows one row per pipe size
    const waterlinePipes = parseWaterlinePipes(p);
    const drainagePipes  = parseDrainagePipes(p);

    // Total pipe length drives connector/accessory quantities
    const totalWaterlineM = waterlinePipes.reduce((s, r) => s + r.lengthM, 0);
    const totalDrainageM  = drainagePipes.reduce((s, r) => s + r.lengthM, 0);
    // Fall back to prompt-level extraction when no size-specific rows found
    const pipeLen = totalWaterlineM || parseCivilPipeLength(p);

    const hydrants    = parseCivilFixture(p, "fire hydrant");
    const gateValves  = parseCivilFixture(p, "gate valve");
    const catchBasins = parseCivilFixture(p, "catch basin");
    const manholes    = parseCivilFixture(p, "manhole");
    const sewerMH     = parseCivilFixture(p, "sewer manhole");
    const roadLengthM = parseTotalRoadLength(p);

    // Connectors & fittings based on total waterline length
    const couplings = Math.ceil(pipeLen / 6);
    const elbows    = Math.ceil(pipeLen / 40);
    const tees      = Math.ceil(pipeLen / 80);
    const reducers  = Math.ceil(pipeLen / 200);

    // GI pipe stubs at service connections (1.5m stub per 20m of main)
    const giPipeM    = Math.ceil(pipeLen / 20) * 1.5;
    const giCouplings = Math.ceil(giPipeM / 6);

    // Gate valve box covers — one per gate valve
    const valveBoxCovers = gateValves || Math.ceil(pipeLen / 100);

    // Thrust blocks — at each elbow and tee
    const thrustBlocks = elbows + tees;

    // Bedding materials
    const gravelBeddingCuM = round(pipeLen * 0.08); // ~0.08 m³ per linear meter

    // Concrete and rebar for structures
    const concreteBags = Math.ceil((manholes + sewerMH + catchBasins) * 3 + thrustBlocks * 1.5);
    const rebarPcs     = Math.ceil((manholes + sewerMH + catchBasins) * 6);

    // Safety items
    const safetySignsBarricades = Math.ceil(pipeLen / 50); // 1 set per 50m

    // Consumables
    const pvcPrimer       = Math.ceil(pipeLen / 100);
    const pvcCement       = Math.ceil(pipeLen / 80);
    const joiningLubricant = Math.ceil(pipeLen / 200);
    const teflonTape      = Math.ceil(gateValves * 2 + hydrants);

    // Road pavement items (when road length is present in prompt)
    // Standard road cross-section: 300mm gravel sub-base + 150mm base course + 150mm PCC
    // Road width assumed ~6m (2-lane subdivision road)
    const roadWidthM = 6;
    const roadAreaM2 = roadLengthM * roadWidthM;
    const subbaseM3  = round(roadAreaM2 * 0.30);  // 300mm depth
    const baseCourseM3 = round(roadAreaM2 * 0.15); // 150mm depth
    const pccBags    = Math.ceil(roadAreaM2 * 0.15 * 6.5); // 6.5 bags/m³ for 3000psi PCC
    const pccRebar   = Math.ceil(roadAreaM2 * 0.012); // 12mm rebar at 0.012 pcs/m²
    const curbAndGutterM = roadLengthM * 2;           // both sides
    const pavementMarkingsM2 = round(roadLengthM * 0.3); // lane markings ~30% of road length

    const items = [
      // --- Primary waterline pipes (one row per size) ---
      ...waterlinePipes.map((r) => ({
        material: r.label,
        quantity: Math.ceil(r.lengthM * 1.05), // 5% waste
        unit: "meters"
      })),
      // --- Primary drainage pipes (one row per size) ---
      ...drainagePipes.map((r) => ({
        material: r.label,
        quantity: Math.ceil(r.lengthM * 1.05), // 5% waste
        unit: "meters"
      })),
      // --- Connectors & fittings ---
      { material: "PVC Coupling (same diameter)", quantity: couplings, unit: "pcs" },
      { material: "PVC Elbow 90°", quantity: elbows, unit: "pcs" },
      { material: "PVC Tee", quantity: tees, unit: "pcs" },
      { material: "PVC Reducer", quantity: reducers, unit: "pcs" },
      // --- GI pipe at service stubs ---
      ...(giPipeM > 0 ? [
        { material: "GI Pipe (service stubs)", quantity: round(giPipeM), unit: "meters" },
        { material: "GI Coupling", quantity: giCouplings, unit: "pcs" }
      ] : []),
      // --- Valves & accessories ---
      ...(valveBoxCovers > 0 ? [{ material: "Gate Valve Box Cover", quantity: valveBoxCovers, unit: "pcs" }] : []),
      ...(hydrants > 0 ? [{ material: "Hydrant Marker Post", quantity: hydrants, unit: "pcs" }] : []),
      // --- Civil structures ---
      ...(thrustBlocks > 0 ? [{ material: "Concrete Thrust Block (cast in place)", quantity: thrustBlocks, unit: "pcs" }] : []),
      ...(gravelBeddingCuM > 0 ? [{ material: "Gravel Bedding (pipe trench)", quantity: gravelBeddingCuM, unit: "m³" }] : []),
      ...(concreteBags > 0 ? [{ material: "Portland Cement (structures)", quantity: concreteBags, unit: "bags" }] : []),
      ...(rebarPcs > 0 ? [{ material: "10mm Deformed Bar (rebar)", quantity: rebarPcs, unit: "pcs" }] : []),
      // --- Consumables ---
      { material: "PVC Primer", quantity: Math.max(1, pvcPrimer), unit: "cans" },
      { material: "PVC Solvent Cement", quantity: Math.max(1, pvcCement), unit: "cans" },
      { material: "Pipe Joint Lubricant", quantity: Math.max(1, joiningLubricant), unit: "tubes" },
      { material: "Teflon Tape", quantity: Math.max(5, teflonTape), unit: "rolls" },
      { material: "Sand (pipe bedding backfill)", quantity: round(pipeLen * 0.05), unit: "m³" },
      // --- Safety ---
      { material: "Safety Vest (Hi-Vis)", quantity: 10, unit: "pcs" },
      { material: "Hard Hat", quantity: 10, unit: "pcs" },
      { material: "Barricade / Traffic Signs Set", quantity: Math.max(1, safetySignsBarricades), unit: "sets" },
      { material: "Safety Cone", quantity: Math.ceil(pipeLen / 30), unit: "pcs" },
      // --- Road pavement (when road length is provided) ---
      ...(roadAreaM2 > 0 ? [
        { material: "Clearing and Grubbing", quantity: round(roadAreaM2 / 10000), unit: "ha", payItem: "Item 100" },
        { material: "Gravel Sub-base (300mm compacted)", quantity: subbaseM3, unit: "m³", payItem: "Item 200", qtoFormula: `${roadLengthM}m × ${roadWidthM}m × 0.30m = ${subbaseM3}m³` },
        { material: "Crushed Aggregate Base Course (150mm)", quantity: baseCourseM3, unit: "m³", payItem: "Item 201", qtoFormula: `${roadLengthM}m × ${roadWidthM}m × 0.15m = ${baseCourseM3}m³` },
        { material: "Portland Cement (PCC pavement)", quantity: pccBags, unit: "bags", payItem: "Item 311" },
        { material: "12mm Deformed Bar (road slab rebar)", quantity: pccRebar, unit: "pcs", payItem: "Item 404" },
        { material: "Curb and Gutter (precast or cast-in-place)", quantity: curbAndGutterM, unit: "meters", payItem: "Item 311.1", qtoFormula: `${roadLengthM}m × 2 sides = ${curbAndGutterM}m` },
        { material: "Road Pavement Markings", quantity: pavementMarkingsM2, unit: "m²", payItem: "Item 612" },
      ] : []),
    ];

    // Attach DPWH pay item codes to all rows that don't already have one
    return items.map((item) => {
      if (!item.payItem) {
        const m = (item.material || "").toLowerCase();
        if ((m.includes("waterline") || (m.includes("pvc") && m.includes("pipe"))) && !m.includes("drainage")) {
          return { ...item, payItem: "Item 800" };
        }
        if (m.includes("gi pipe") || m.includes("gi coupling")) {
          return { ...item, payItem: "Item 800.1" }; // GI service connections
        }
        if (m.includes("drainage") || m.includes("rcp")) {
          return { ...item, payItem: "Item 500" };
        }
        if (m.includes("coupling") || m.includes("elbow") || m.includes("tee") || m.includes("reducer")) {
          return { ...item, payItem: "Item 801" };
        }
        if (m.includes("gate valve") || m.includes("hydrant") || m.includes("blow-off") || m.includes("valve box")) {
          return { ...item, payItem: "Item 802" };
        }
        if (m.includes("manhole") || m.includes("catch basin")) {
          return { ...item, payItem: "Item 500.1" }; // Drainage structures
        }
        if (m.includes("thrust block")) {
          return { ...item, payItem: "Item 500.2" }; // Thrust blocks / anchorage
        }
        if (m.includes("gravel bedding")) {
          return { ...item, payItem: "Item 108.1" }; // Granular pipe bedding
        }
        if (m.includes("sand") && (m.includes("bedding") || m.includes("backfill"))) {
          return { ...item, payItem: "Item 108.2" }; // Pipe trench backfill
        }
        if (m.includes("portland cement") && m.includes("structure")) {
          return { ...item, payItem: "Item 500" };
        }
        if (m.includes("deformed bar") && !m.includes("road")) {
          return { ...item, payItem: "Item 500" }; // Rebar for structures
        }
        if (m.includes("primer") || m.includes("solvent cement") || m.includes("lubricant") || m.includes("teflon")) {
          return { ...item, payItem: "Item 800" }; // Pipe consumables under waterline pay item
        }
        if (m.includes("safety") || m.includes("barricade") || m.includes("cone") || m.includes("hard hat") || m.includes("vest")) {
          return { ...item, payItem: "SPL-01" };
        }
      }
      return item;
    });
  },
  labor(area, prompt = "") {
    const pipeLen = parseCivilPipeLength(prompt || "");
    const roadLengthM = parseTotalRoadLength(prompt || "");
    const excavDays = Math.ceil(pipeLen / 80);    // 80 lm/day excavation crew
    const pipeDays = Math.ceil(pipeLen / 60);     // 60 lm/day pipe laying crew
    const structDays = Math.ceil(pipeLen / 200);  // structures (MH, CB, thrust blocks)
    const testDays = Math.ceil(pipeLen / 500);    // pressure testing
    const roadDays = roadLengthM > 0 ? Math.ceil(roadLengthM / 30) : 0; // road paving crew
    return [
      { material: "Mobilization and Demobilization", quantity: 1, unit: "lot", unitPrice: round(pipeLen * 85 + roadLengthM * 60), payItem: "SPL-02",
        remarks: "Equipment transport, site office setup, temporary facilities" },
      { material: "Excavation & Trenching Labor", quantity: excavDays, unit: "days", unitPrice: 9500, payItem: "Item 103" },
      { material: "Pipe Laying & Jointing Labor", quantity: pipeDays, unit: "days", unitPrice: 8500, payItem: "Item 800" },
      { material: "Structures Labor (MH, CB, thrust blocks)", quantity: Math.max(3, structDays), unit: "days", unitPrice: 9000, payItem: "Item 500" },
      { material: "Pressure Testing & Commissioning Labor", quantity: Math.max(2, testDays), unit: "days", unitPrice: 7500, payItem: "Item 800" },
      { material: "Backfilling & Compaction Labor", quantity: Math.ceil(excavDays * 0.7), unit: "days", unitPrice: 8000, payItem: "Item 108" },
      ...(roadDays > 0 ? [
        { material: "Road Sub-base & Base Course Labor", quantity: roadDays, unit: "days", unitPrice: 11000, payItem: "Item 200" },
        { material: "PCC Pavement Pouring & Finishing Labor", quantity: Math.ceil(roadDays * 0.6), unit: "days", unitPrice: 13500, payItem: "Item 311" },
        { material: "Curb and Gutter Installation Labor", quantity: Math.ceil(roadLengthM / 50), unit: "days", unitPrice: 9000, payItem: "Item 500" },
      ] : []),
      { material: "Licensed Civil Engineer Supervision", quantity: 1, unit: "lot", unitPrice: round((pipeLen + roadLengthM) * 28), payItem: "SPL-03" },
    ];
  },
  equipment(area, prompt = "") {
    const pipeLen = parseCivilPipeLength(prompt || "");
    const roadLengthM = parseTotalRoadLength(prompt || "");
    const excavDays = Math.ceil(pipeLen / 80);
    const roadDays = roadLengthM > 0 ? Math.ceil(roadLengthM / 30) : 0;
    return [
      { material: "Excavator Rental (backhoe)", quantity: excavDays, unit: "days", unitPrice: 18000, payItem: "Item 103" },
      { material: "Dump Truck Rental (spoils hauling)", quantity: Math.ceil(excavDays * 0.6), unit: "days", unitPrice: 13500, payItem: "Item 103" },
      { material: "Plate Compactor Rental", quantity: Math.ceil(excavDays * 0.5), unit: "days", unitPrice: 2500, payItem: "Item 108" },
      { material: "Concrete Mixer Rental (structures)", quantity: Math.max(3, Math.ceil(pipeLen / 400)), unit: "days", unitPrice: 6000, payItem: "Item 500" },
      { material: "Pressure Test Pump Rental", quantity: Math.max(2, Math.ceil(pipeLen / 500)), unit: "days", unitPrice: 3500, payItem: "Item 800" },
      { material: "Water Truck Rental (pipe flushing)", quantity: Math.max(1, Math.ceil(pipeLen / 1000)), unit: "days", unitPrice: 8500, payItem: "Item 800" },
      ...(roadDays > 0 ? [
        { material: "Motor Grader Rental", quantity: roadDays, unit: "days", unitPrice: 22000, payItem: "Item 200" },
        { material: "Road Roller / Compactor Rental", quantity: roadDays, unit: "days", unitPrice: 16000, payItem: "Item 200" },
        { material: "Concrete Paver / Screeder Rental", quantity: Math.ceil(roadDays * 0.6), unit: "days", unitPrice: 14000, payItem: "Item 311" },
      ] : []),
    ];
  }
};

const detectProfile = (prompt, disciplineOverride) => {
  if (disciplineOverride === "civil") {
    return PROFILE_LIBRARY.civil;
  }

  if (disciplineOverride && PROFILE_LIBRARY[disciplineOverride]) {
    return PROFILE_LIBRARY[disciplineOverride];
  }

  const value = normalize(prompt);

  if (/(waterline|waterline layout|drainage layout|road pavement|rcp pipe|catch basin|manhole|total road length|fire hydrant|gate valve|civil works|site development|subdivision)/.test(value)) {
    return PROFILE_LIBRARY.civil;
  }

  if (/(fire protection|fire pro|sprinkler|suppression|nfpa|bfp)/.test(value)) {
    return PROFILE_LIBRARY.firePro;
  }

  if (/(high.?rise|highrise|tower|multi.?story|curtain wall|post.?tension)/.test(value)) {
    return PROFILE_LIBRARY.highrise;
  }

  if (/(prefab|precast|prestressed|hollow core|sandwich panel)/.test(value)) {
    return PROFILE_LIBRARY.prefab;
  }

  if (/(structural|footing|column|beam|slab|shear wall|rebar|reinforced concrete)/.test(value)) {
    return PROFILE_LIBRARY.structural;
  }

  if (/(architectural|tiles|paint|ceiling|door|window|waterproof|fascia|gutter)/.test(value)) {
    return PROFILE_LIBRARY.architectural;
  }

  if (/(electrical|wiring|conduit|panel board|circuit|outlet|lighting)/.test(value)) {
    return PROFILE_LIBRARY.electrical;
  }

  if (/(plumbing|drainage|sanitary|water supply|fixture|valve|trap)/.test(value)) {
    return PROFILE_LIBRARY.plumbing;
  }

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

  if (DEFAULT_PRICE_BOOK[normalizedName]) {
    return DEFAULT_PRICE_BOOK[normalizedName];
  }

  // Partial match: find the first price book key that appears in the material name
  for (const [key, price] of Object.entries(DEFAULT_PRICE_BOOK)) {
    if (normalizedName.includes(key)) return price;
  }

  return 100;
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

export const generateEstimate = ({ prompt, materials, template, discipline }) => {
  const area = parseArea(prompt);
  const location = parseLocation(prompt);
  const profile = detectProfile(prompt, discipline || "");
  const context = extractPromptContext(prompt);
  const isCivil = profile.key === "civil";

  // Civil profile methods accept (area, prompt) so they can parse pipe lengths/counts from the prompt.
  // Skip the residential tuning filters — they don't apply to civil works.
  const resolvedMaterials = (isCivil
    ? profile.materials(area, prompt)
    : tuneMaterialItems(profile.materials(area), context)
  ).map((item) => ({
    ...item,
    category: "Materials",
    unitPrice: resolveMaterialPrice(materials, item.material)
  }));

  const laborItems = (isCivil
    ? profile.labor(area, prompt)
    : tuneLaborItems(profile.labor(area), area, context)
  ).map((item) => ({
    ...item,
    category: "Labor"
  }));

  const equipmentItems = (isCivil
    ? profile.equipment(area, prompt)
    : tuneEquipmentItems(profile.equipment(area), context)
  ).map((item) => ({
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

// BOQ completeness checker — returns missing scope items with severity and suggested fix
export const checkBoqCompleteness = ({ items = [], discipline = "", prompt = "" }) => {
  const flags = [];
  const mat = items.map((i) => (i.material || "").toLowerCase());
  const hasAny = (...keywords) => keywords.some((kw) => mat.some((m) => m.includes(kw)));

  const isCivil = discipline === "civil" ||
    /(waterline|drainage|road|rcp|manhole|catch basin|hydrant|gate valve|civil works|site development)/i.test(prompt);

  const isResidential = discipline === "residential" || discipline === "" &&
    /(house|bungalow|residential|bedroom|bathroom)/i.test(prompt);

  const isElectrical = discipline === "electrical" ||
    /(electrical|wiring|panel|circuit|outlet)/i.test(prompt);

  const isPlumbing = discipline === "plumbing" ||
    /(plumbing|water supply|sanitary|fixture)/i.test(prompt);

  if (isCivil) {
    const hasWaterline = hasAny("waterline", "pvc pipe", "gi pipe", "hdpe");
    const hasDrainage = hasAny("drainage", "rcp", "catch basin", "manhole");
    const hasRoad = hasAny("sub-base", "base course", "pcc", "pavement", "clearing");
    const hasMobilization = hasAny("mobilization", "demobilization");
    const hasTesting = hasAny("testing", "commissioning", "pressure test", "disinfection");
    const hasTrafficMgmt = hasAny("traffic", "barricade", "safety cone", "safety sign");
    const hasBedding = hasAny("bedding", "gravel bedding", "sand bedding");
    const hasExcavation = hasAny("excavat", "trenching", "excavator");
    const hasBackfill = hasAny("backfill", "compaction");
    const hasAsBuilt = hasAny("as-built", "as built", "survey", "staking");

    if (hasWaterline && !hasTesting) {
      flags.push({
        severity: "high",
        category: "Missing Scope",
        issue: "No pressure testing or disinfection item",
        suggestion: "Add: Hydrostatic Pressure Testing & Chlorine Disinfection (lot) — required by LWUA before commissioning. Typical: PHP 45,000–80,000/lot.",
        payItem: "SPL-04"
      });
    }
    if (hasWaterline && !hasBedding) {
      flags.push({
        severity: "high",
        category: "Missing Material",
        issue: "No pipe bedding material",
        suggestion: "Add: Gravel Bedding (pipe trench) — 0.08 m³ per linear meter of pipe. Protects pipe from point loading.",
        payItem: "Item 108.1"
      });
    }
    if ((hasWaterline || hasDrainage) && !hasExcavation) {
      flags.push({
        severity: "high",
        category: "Missing Labor/Equipment",
        issue: "No excavation or trenching in BOQ",
        suggestion: "Add: Excavator Rental (backhoe) and Excavation & Trenching Labor — typically 1 excavator-day per 80 linear meters.",
        payItem: "Item 103"
      });
    }
    if ((hasWaterline || hasDrainage) && !hasBackfill) {
      flags.push({
        severity: "medium",
        category: "Missing Labor",
        issue: "No backfilling or compaction labor",
        suggestion: "Add: Backfilling & Compaction Labor — typically 70% of excavation crew-days. DPWH Item 108.",
        payItem: "Item 108"
      });
    }
    if (!hasMobilization) {
      flags.push({
        severity: "medium",
        category: "Missing Item",
        issue: "No mobilization / demobilization item",
        suggestion: "Add: Mobilization and Demobilization (1 lot) — includes equipment transport, site office, temporary facilities. DPWH SPL-02.",
        payItem: "SPL-02"
      });
    }
    if ((hasWaterline || hasDrainage) && !hasTrafficMgmt) {
      flags.push({
        severity: "medium",
        category: "Missing Safety",
        issue: "No traffic management / safety items",
        suggestion: "Add: Barricades, safety cones, traffic signs — required under RA 11058 for road-crossing works. DPWH SPL-01.",
        payItem: "SPL-01"
      });
    }
    if (hasRoad && !hasAny("marking", "paint")) {
      flags.push({
        severity: "low",
        category: "Incomplete Road Scope",
        issue: "Road pavement has no lane markings",
        suggestion: "Add: Road Pavement Markings (m²) — thermoplastic paint for centerline and edge lines. DPWH Item 612.",
        payItem: "Item 612"
      });
    }
    if (!hasAsBuilt && (hasWaterline || hasDrainage || hasRoad)) {
      flags.push({
        severity: "low",
        category: "Post-Construction",
        issue: "No as-built survey or staking item",
        suggestion: "Add: As-Built Survey / Geodetic Engineering Services (lot) — required for DPWH project closeout documentation.",
        payItem: "SPL-05"
      });
    }
  }

  if (isResidential || (!isCivil && items.length > 0)) {
    const hasStructural = hasAny("cement", "rebar", "chb", "concrete", "footing", "column");
    const hasElec = hasAny("electrical", "wire", "outlet", "lighting", "panel");
    const hasPlumbing = hasAny("plumbing", "pvc pipe", "fixture", "water");
    const hasPainting = hasAny("paint", "primer");
    const hasRoofing = hasAny("roof", "purlins", "truss");
    const hasFlooring = hasAny("floor", "tiles", "vinyl");

    if (!isElectrical && !hasElec && hasStructural) {
      flags.push({
        severity: "medium",
        category: "Missing Scope",
        issue: "No electrical works in BOQ",
        suggestion: "If electrical is in scope, add wiring, outlets, panel board, and lighting fixtures. Typical: PHP 600–900/sqm."
      });
    }
    if (!isPlumbing && !hasPlumbing && hasStructural) {
      flags.push({
        severity: "medium",
        category: "Missing Scope",
        issue: "No plumbing works in BOQ",
        suggestion: "If plumbing is in scope, add supply lines, sanitary lines, and fixtures. Typical: PHP 500–800/sqm."
      });
    }
    if (!hasPainting && hasStructural) {
      flags.push({
        severity: "low",
        category: "Missing Scope",
        issue: "No painting works in BOQ",
        suggestion: "Add primer and finish coat. Typical consumption: 0.42 gallons primer + 0.55 gallons finish per sqm."
      });
    }
    if (!hasRoofing && hasStructural) {
      flags.push({
        severity: "low",
        category: "Missing Scope",
        issue: "No roofing materials in BOQ",
        suggestion: "Add roofing sheets, purlins, and ridge cap if roofing is in scope."
      });
    }
    if (!hasFlooring && hasStructural) {
      flags.push({
        severity: "low",
        category: "Missing Scope",
        issue: "No flooring materials in BOQ",
        suggestion: "Add floor tiles, vinyl plank, or concrete hardener depending on finish level."
      });
    }
  }

  const highCount = flags.filter((f) => f.severity === "high").length;
  const medCount = flags.filter((f) => f.severity === "medium").length;
  const score = items.length === 0 ? 0 : Math.max(0, 100 - highCount * 20 - medCount * 8);

  return {
    flags,
    score,
    highCount,
    medCount,
    lowCount: flags.filter((f) => f.severity === "low").length,
    summary: flags.length === 0
      ? "BOQ appears complete. No obvious missing scope items detected."
      : `Found ${flags.length} potential gap${flags.length !== 1 ? "s" : ""}: ${highCount} critical, ${medCount} medium.`
  };
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

const scoreDocumentConfidence = (text) => {
  let score = 0;
  if (/(\d+(?:\.\d+)?)\s*(sqm|sq\.?\s?m|m2)/i.test(text)) score += 2;
  if (/\bin\s+[a-zA-Z0-9,\s-]+/i.test(text)) score += 1;
  if (/(house|bungalow|residential|fit.?out|office|warehouse|electrical|plumbing|structural|architectural|fire|highrise|prefab)/i.test(text)) score += 2;
  if (/(premium|standard|basic|economy|shell only)/i.test(text)) score += 1;
  if (text.trim().split(/\s+/).length > 20) score += 1;
  if (score >= 5) return "High";
  if (score >= 3) return "Medium";
  return "Low";
};

const detectDisciplineFromInstruction = (value) => {
  if (/(civil|waterline|drainage|road|subdivision|rcp|manhole|catch basin|hydrant|gate valve|pipe laying)/.test(value)) return "civil";
  if (/(electrical|wiring|panel|circuit|outlet)/.test(value)) return "electrical";
  if (/(plumbing|drainage|water supply|fixture|sanitary)/.test(value)) return "plumbing";
  if (/(fire|sprinkler|nfpa|bfp|suppression)/.test(value)) return "firePro";
  if (/(structural|footing|column|beam|slab|shear wall)/.test(value)) return "structural";
  if (/(architectural|tile|paint|ceiling|door|window|waterproof)/.test(value)) return "architectural";
  if (/(fit.?out|office|partition|gypsum|tenant)/.test(value)) return "fitout";
  if (/(warehouse|industrial|storage|depot)/.test(value)) return "warehouse";
  if (/(highrise|high.?rise|tower|curtain wall|post.?tension)/.test(value)) return "highrise";
  if (/(prefab|precast|prestressed|hollow core)/.test(value)) return "prefab";
  return "";
};

export const analyzeDocumentForBOQ = ({ text, materials, template, discipline }) => {
  const result = generateEstimate({ prompt: text, materials, template, discipline: discipline || "" });
  const aiConfidence = scoreDocumentConfidence(text);
  const items = result.items.map((item) => ({ ...item, _aiSuggested: true }));
  return { ...result, items, aiConfidence };
};

// Material substitution profiles for what-if analysis
const MATERIAL_SUBS = {
  aac: {
    detect: /(aac|autoclaved aerated|autoclave aerated|aac block)/i,
    replaces: /(chb|concrete hollow block|hollow block|cmu|masonry block)/i,
    label: "AAC Block",
    adhesiveLabel: "AAC Block Adhesive",
    laborLabel: "AAC Block Wall Installation",
    unitPrice: 52,           // AAC block per piece (PHP estimate)
    adhesiveUnitPrice: 280,  // per bag
    laborUnitPrice: 95,      // per piece installed
    explanation:
      "AAC (Autoclaved Aerated Concrete) blocks replace conventional CHB/hollow blocks. " +
      "AAC is lighter (~600 kg/m³ vs CHB ~1,600 kg/m³), provides better thermal and acoustic insulation, " +
      "and is faster to lay — but costs more per unit. Cement mortar is replaced with thin-bed AAC adhesive. " +
      "Labor rates change because AAC requires minimal mortar and can be cut with hand tools. " +
      "Expect a 15–30% cost increase on the masonry scope, offset partly by faster installation."
  },
  steel: {
    detect: /(steel frame|light gauge steel|lgs|cold.?formed steel)/i,
    replaces: /(chb|concrete hollow block|hollow block|timber frame|wood frame)/i,
    label: "Light Gauge Steel Framing",
    adhesiveLabel: null,
    laborLabel: "Steel Frame Assembly",
    unitPrice: 0,
    adhesiveUnitPrice: 0,
    laborUnitPrice: 0,
    explanation:
      "Light Gauge Steel (LGS) framing replaces masonry or timber wall systems. " +
      "LGS is non-combustible, termite-proof, dimensionally stable, and faster to erect. " +
      "It requires specialized labor and different finishing trades (gypsum board vs plaster). " +
      "Material cost is typically higher, but overall build time is shorter."
  }
};

const detectMaterialSub = (value) => {
  for (const [key, profile] of Object.entries(MATERIAL_SUBS)) {
    if (profile.detect.test(value)) return { key, profile };
  }
  return null;
};

export const refineEstimateBOQ = ({ items, instruction, materials, areaHint = 60 }) => {
  const value = normalize(instruction);
  const currentArea = Number(areaHint) || 60;

  // What-if material substitution
  const isWhatIf = /(what if|what would happen|if we use|if we switch|switch to|replace with|use aac|use lgs|use steel frame)/i.test(instruction);
  if (isWhatIf) {
    const sub = detectMaterialSub(instruction);
    if (sub) {
      const { profile } = sub;
      // Find items that will be replaced
      const replaced = items.filter((item) => profile.replaces.test(item.material));
      const kept = items.filter((item) => !profile.replaces.test(item.material));
      // Also replace matching labor lines
      const replacedLabor = kept.filter((item) =>
        item.category === "Labor" && /(chb|hollow block|masonry|block lay)/i.test(item.material)
      );
      const keptFinal = kept.filter((item) =>
        !(item.category === "Labor" && /(chb|hollow block|masonry|block lay)/i.test(item.material))
      );

      // Build replacement items based on quantities of what was replaced
      const totalBlocks = replaced.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || Math.round(currentArea * 10);
      const newItems = [
        {
          _rowId: `aac-block-${Date.now()}`,
          material: profile.label,
          quantity: totalBlocks,
          unit: "pcs",
          unitPrice: profile.unitPrice,
          category: "Materials",
          _aiSuggested: true
        },
        ...(profile.adhesiveLabel ? [{
          _rowId: `aac-adhesive-${Date.now()}`,
          material: profile.adhesiveLabel,
          quantity: Math.ceil(totalBlocks / 25),
          unit: "bag",
          unitPrice: profile.adhesiveUnitPrice,
          category: "Materials",
          _aiSuggested: true
        }] : []),
        {
          _rowId: `aac-labor-${Date.now()}`,
          material: profile.laborLabel,
          quantity: Math.ceil(totalBlocks / 10),
          unit: "lot",
          unitPrice: profile.laborUnitPrice * 10,
          category: "Labor",
          _aiSuggested: true
        }
      ];

      const finalItems = [...keptFinal, ...newItems];
      return {
        items: finalItems,
        addedCount: newItems.length,
        removedCount: replaced.length + replacedLabor.length,
        refinedCount: 0,
        explanation: profile.explanation,
        isWhatIf: true
      };
    }
    // What-if but no recognized substitution — return no-op with explanation
    return {
      items,
      addedCount: 0,
      removedCount: 0,
      refinedCount: 0,
      explanation: "This what-if scenario wasn't recognized as a known material substitution. Try specifying the material explicitly, e.g. 'What if we use AAC block instead of CHB?'",
      isWhatIf: true
    };
  }

  const rescaleMatch = instruction.match(/(\d+(?:\.\d+)?)\s*(sqm|sq\.?\s?m|m2)/i);
  if (rescaleMatch && /(change|scale|resize|set|update|now|use)\s|\bto\s+\d/.test(value)) {
    const newArea = Number(rescaleMatch[1]);
    const factor = newArea / currentArea;
    const scaled = items.map((item) => ({
      ...item,
      quantity: String(item.unit).toLowerCase() === "lot" ? item.quantity : round(Number(item.quantity) * factor),
      _aiSuggested: true
    }));
    return { items: scaled, addedCount: 0, removedCount: 0, refinedCount: scaled.length, explanation: `Quantities scaled from ${currentArea} sqm to ${newArea} sqm (factor: ${round(factor, 2)}×).`, isWhatIf: false };
  }

  const removeMatch = /(remove|exclude|without|delete)\s+(\w[\w\s]{2,30})/i.exec(instruction);
  if (removeMatch) {
    const scope = normalize(removeMatch[2]).split(" ")[0];
    const before = items.length;
    const filtered = items.filter((item) => !normalize(item.material).includes(scope));
    return { items: filtered, addedCount: 0, removedCount: before - filtered.length, refinedCount: 0, explanation: `Removed ${before - filtered.length} line item(s) matching "${removeMatch[2].trim()}".`, isWhatIf: false };
  }

  const addMatch = /(add|include|append)\s+(\w[\w\s]{2,40})/i.exec(instruction);
  if (addMatch) {
    const scopeText = normalize(addMatch[2]);
    const disciplineKey = detectDisciplineFromInstruction(scopeText) || detectDisciplineFromInstruction(value);
    if (disciplineKey && PROFILE_LIBRARY[disciplineKey]) {
      const profile = PROFILE_LIBRARY[disciplineKey];
      const newMats = profile.materials(currentArea).map((item) => ({
        ...item, category: "Materials", unitPrice: resolveMaterialPrice(materials, item.material), _aiSuggested: true
      }));
      const newLabor = profile.labor(currentArea).map((item) => ({ ...item, category: "Labor", _aiSuggested: true }));
      const newEquip = profile.equipment(currentArea).map((item) => ({ ...item, category: "Equipment", _aiSuggested: true }));
      const newItems = [...newMats, ...newLabor, ...newEquip];
      return { items: [...items, ...newItems], addedCount: newItems.length, removedCount: 0, refinedCount: 0, explanation: `Added ${newItems.length} line items for ${addMatch[2].trim()}.`, isWhatIf: false };
    }
  }

  const reduceMatch = /(reduce|lower|decrease|cut)\s+.*?(\d+)\s*%/i.exec(instruction);
  if (reduceMatch) {
    const factor = 1 - Number(reduceMatch[2]) / 100;
    const adjusted = items.map((item) => ({ ...item, unitPrice: round(Number(item.unitPrice) * factor), _aiSuggested: true }));
    return { items: adjusted, addedCount: 0, removedCount: 0, refinedCount: adjusted.length, explanation: `Unit prices reduced by ${reduceMatch[2]}% across all ${adjusted.length} line items.`, isWhatIf: false };
  }

  return { items, addedCount: 0, removedCount: 0, refinedCount: 0, explanation: "No matching transformation found. Try: 'Add electrical works', 'Remove plumbing', 'Reduce by 10%', or 'What if we use AAC block?'", isWhatIf: false };
};
