// Discipline types, Philippine/international standards per discipline,
// and client-side prompt refinement function.
// Server-side profile selection lives in server/src/ai.js.

export const DISCIPLINES = [
  { key: "", label: "General / Auto-detect", description: "Let the system infer the discipline from the prompt" },
  { key: "residential", label: "Residential", description: "Bungalows, houses, townhouses, duplex" },
  { key: "structural", label: "Structural", description: "Structural works only — foundations, columns, beams, slabs" },
  { key: "architectural", label: "Architectural", description: "Finishes — tiles, paint, doors, windows, ceilings" },
  { key: "electrical", label: "Electrical", description: "Complete electrical system per PEC 2017" },
  { key: "plumbing", label: "Plumbing", description: "Water supply, drainage, fixtures per NPCP" },
  { key: "firePro", label: "Fire Protection", description: "Sprinklers, alarms, suppression per RA 9514 / NFPA" },
  { key: "highrise", label: "High-rise", description: "Multi-story towers — structural, MEP, curtain wall" },
  { key: "prefab", label: "Prefabrication", description: "Precast concrete and prefabricated systems" },
  { key: "fitout", label: "Fit-out / Office", description: "Interior tenant improvement and office renovation" },
  { key: "warehouse", label: "Warehouse / Industrial", description: "Storage facilities and industrial buildings" },
  { key: "civil", label: "Civil / Site Works", description: "Waterline, drainage, road pavement, subdivision infrastructure" }
];

export const STANDARDS = {
  residential: {
    label: "Residential",
    standards: [
      { code: "NBC RA 6541", name: "National Building Code of the Philippines", scope: "Building permits, occupancy, fire exits, structural requirements" },
      { code: "NSCP 2015", name: "National Structural Code of the Philippines", scope: "Loads, reinforced concrete, masonry, timber framing" },
      { code: "DPWH Blue Book", name: "DPWH Standard Specifications", scope: "Materials and construction methods for government and private works" }
    ],
    scopeHints: [
      "complete structural works (footings, columns, beams, slabs)",
      "masonry walls (CHB)",
      "roof framing and roofing",
      "architectural finishes (tiles, paint, ceilings)",
      "doors and windows",
      "basic electrical and plumbing"
    ]
  },
  structural: {
    label: "Structural",
    standards: [
      { code: "NSCP 2015 Vol. 1", name: "National Structural Code of the Philippines, 7th Edition", scope: "Seismic design, wind loads, concrete, steel, masonry design" },
      { code: "ACI 318-19", name: "Building Code Requirements for Structural Concrete (ACI)", scope: "Reinforced concrete member design, detailing, construction" },
      { code: "ASTM A615 / A706", name: "Standard Specification for Deformed Steel Bars", scope: "Rebar grade, tensile strength, and bend test requirements" },
      { code: "DPWH Blue Book Vol. 2", name: "DPWH Standard Specs — Structural Works", scope: "Concrete mix design, formworks, rebar installation methods" }
    ],
    scopeHints: [
      "reinforced concrete footings and grade beams",
      "RC columns and shear walls",
      "RC beams and girders",
      "two-way slab or one-way slab system",
      "roof framing (steel trusses or RC)",
      "formworks and shoring",
      "concrete curing and quality control"
    ]
  },
  architectural: {
    label: "Architectural",
    standards: [
      { code: "NBC RA 6541 + PD 1096 IRR", name: "National Building Code — Architectural Provisions", scope: "Minimum room sizes, ceiling heights, ventilation, exits" },
      { code: "ASTM C627", name: "Evaluating Ceramic Floor Tile Installation Systems", scope: "Tile load class selection and adhesive bond strength" },
      { code: "DPWH Blue Book Vol. 3", name: "DPWH Architectural Specifications", scope: "Paint, tiles, doors, windows, waterproofing standards" },
      { code: "AISC / AAMA 501", name: "Aluminum Association Standards", scope: "Aluminum window and curtain wall performance" }
    ],
    scopeHints: [
      "ceramic / granite floor and wall tiles",
      "interior and exterior painting",
      "suspended ceiling system (T-runner + fiber cement board)",
      "metal door frames and panel doors",
      "aluminum windows (awning, casement, sliding)",
      "waterproofing (bathroom floors, roof deck)",
      "fascia, gutters, and downspouts"
    ]
  },
  electrical: {
    label: "Electrical",
    standards: [
      { code: "PEC 2017", name: "Philippine Electrical Code, 2017 Edition", scope: "Branch circuits, panel boards, grounding, service entrance, GFCI requirements" },
      { code: "IEC 60364", name: "Low-Voltage Electrical Installations", scope: "International wiring methods, protection, isolation" },
      { code: "RA 7920", name: "New Electrical Engineering Law of the Philippines", scope: "Licensed Master Electrician required for all installations" },
      { code: "NFPA 70 (NEC)", name: "National Electrical Code (reference)", scope: "Applied for complex or industrial installations" }
    ],
    scopeHints: [
      "branch circuit rough-in wiring (THWN in PVC conduit)",
      "GFCI outlets in wet areas (kitchen, bathrooms) per PEC Art. 210",
      "panel board sizing and circuit schedule per PEC Art. 220",
      "grounding and bonding system per PEC Art. 250",
      "lighting layout and load calculation",
      "convenience outlets at NEC/PEC spacing",
      "testing and commissioning — insulation resistance and continuity tests",
      "As-built electrical plan signed by licensed Master Electrician"
    ]
  },
  plumbing: {
    label: "Plumbing",
    standards: [
      { code: "NPCP 1999", name: "National Plumbing Code of the Philippines", scope: "Pipe sizing, venting, trap requirements, fixture units, drainage" },
      { code: "RA 1378", name: "Philippine Plumbing Law", scope: "Licensed Master Plumber required for all plumbing work" },
      { code: "ASSE 1002", name: "Performance Requirements for Water Closet Flush Tanks", scope: "Toilet and flush valve standards" },
      { code: "ASTM D2466 / D2665", name: "PVC Fittings and Drain Pipe Standards", scope: "Pipe and fitting pressure rating and material quality" }
    ],
    scopeHints: [
      "domestic cold water supply system (GI or CPVC)",
      "sanitary drainage system (PVC SCH 40) with proper grades",
      "vent stack and re-venting per NPCP",
      "grease trap sizing per fixture count",
      "overhead water tank and pressure pump",
      "pressure testing at 1.5× working pressure for 2 hours",
      "As-built plumbing plan signed by licensed Master Plumber"
    ]
  },
  firePro: {
    label: "Fire Protection",
    standards: [
      { code: "RA 9514", name: "Fire Code of the Philippines 2008 + 2019 IRR", scope: "Mandatory fire safety systems, BFP permits, occupancy loads" },
      { code: "NFPA 13", name: "Standard for the Installation of Sprinkler Systems", scope: "Hydraulic design, pipe sizing, sprinkler head spacing, coverage" },
      { code: "NFPA 72", name: "National Fire Alarm and Signaling Code", scope: "Detector placement, alarm zones, notification appliance spacing" },
      { code: "NFPA 10", name: "Standard for Portable Fire Extinguishers", scope: "Extinguisher type, size, and placement frequency" }
    ],
    scopeHints: [
      "wet pipe sprinkler system designed to NFPA 13 (one head per 9–12 m²)",
      "smoke detectors (photoelectric) per NFPA 72 spacing",
      "heat detectors in kitchen and mechanical rooms",
      "addressable fire alarm control panel",
      "manual pull stations at all exits",
      "horn-strobe notification appliances",
      "fire hose cabinet every 30 m of floor area per RA 9514",
      "fire extinguishers per occupancy class per RA 9514",
      "BFP permit application and fire safety inspection",
      "hydrostatic test at 200 psi for 2 hours"
    ]
  },
  highrise: {
    label: "High-rise",
    standards: [
      { code: "NSCP 2015 Vol. 1 — High-rise", name: "NSCP Seismic and Wind Provisions for Tall Buildings", scope: "Dynamic analysis, drift limits, post-tensioning, core wall design" },
      { code: "ASHRAE 90.1-2019", name: "Energy Standard for Buildings Except Low-Rise Residential", scope: "Envelope performance, HVAC efficiency, lighting power density" },
      { code: "CTBUH Guidelines", name: "Council on Tall Buildings and Urban Habitat Best Practices", scope: "Structural systems, facade, vertical transportation, egress" },
      { code: "RA 9514 High-rise Provisions", name: "Fire Code — High-rise Requirements", scope: "Compartmentalization every 3 floors, sprinklers throughout, pressurized stairs" },
      { code: "ASME A17.1", name: "Safety Code for Elevators and Escalators", scope: "Elevator design, cab speed, load, and safety devices" }
    ],
    scopeHints: [
      "post-tensioned flat plate or flat slab floor system",
      "RC shear core walls and outrigger beams",
      "unitized or stick-built aluminum curtain wall system",
      "passenger elevators (count per ASME A17.1 occupant load)",
      "pressurized fire exit stairwells per RA 9514",
      "full MEP (mechanical, electrical, plumbing) coordination",
      "building management system (BMS) integration",
      "transfer floor and podium levels",
      "structural peer review by SEOR"
    ]
  },
  prefab: {
    label: "Prefabrication",
    standards: [
      { code: "PCI Design Handbook, 8th Ed.", name: "Precast and Prestressed Concrete — PCI", scope: "Precast member design, connections, tolerance, erection sequence" },
      { code: "ACI 318-19 Chapter 26", name: "ACI Construction Documents and Inspection", scope: "Precast concrete quality control, mix design, curing, testing" },
      { code: "AWS D1.1", name: "Structural Welding Code — Steel (AWS)", scope: "Welded connections for embedded plates and steel inserts" },
      { code: "AISC 360-16", name: "Specification for Structural Steel Buildings", scope: "Steel connection plate and anchor bolt design at joints" }
    ],
    scopeHints: [
      "precast RC columns with corbels for beam bearing",
      "precast inverted-T or rectangular beams",
      "hollow core precast slab (200mm or 265mm depth)",
      "insulated precast wall panels (sandwich panels)",
      "moment-resisting or pinned connections with bolted plates",
      "non-shrink grout at column bases and beam pockets",
      "erection sequence plan and temporary bracing design",
      "manufacturing tolerances: ±6mm on dimensions, ±3mm on insert location",
      "BIM/3D model clash check before fabrication"
    ]
  },
  fitout: {
    label: "Fit-out / Office",
    standards: [
      { code: "NBC RA 6541", name: "National Building Code", scope: "Occupancy change permits, fire exits, ventilation for offices" },
      { code: "PEC 2017 (Tenant)", name: "PEC — Tenant Electrical Fit-out", scope: "Sub-panel installation, branch wiring, GFCI in pantry/restrooms" },
      { code: "AISC / AAMA", name: "Partition and Glazing Standards", scope: "Demountable partition and glass partition performance" },
      { code: "DPWH Specs Vol. 3", name: "Architectural and Fit-out Specifications", scope: "Paint, flooring, ceiling, partition material standards" }
    ],
    scopeHints: [
      "demountable metal stud and gypsum board partitions",
      "suspended ceiling (T-runner with acoustic or fiber cement tiles)",
      "vinyl plank or raised access flooring",
      "tenant sub-panel and branch circuit wiring",
      "GFCI outlets in pantry and restrooms per PEC",
      "data and telecom cabling (Cat6 or fiber)",
      "split-type or centralized HVAC (fan coil units)",
      "fire detection and sprinkler tie-in per RA 9514"
    ]
  },
  warehouse: {
    label: "Warehouse / Industrial",
    standards: [
      { code: "NBC RA 6541 (Industrial)", name: "National Building Code — Industrial Occupancy", scope: "Setbacks, floor area ratio, fire exit spacing for storage occupancy" },
      { code: "NSCP 2015 — Steel", name: "NSCP Chapter 5: Steel Structures", scope: "Steel portal frame and purlin design for industrial buildings" },
      { code: "RA 9514 (Storage)", name: "Fire Code Storage Occupancy Provisions", scope: "Aisle width, sprinkler requirements for rack storage" },
      { code: "ACI 360R", name: "Guide to Design and Construction of Concrete Floors", scope: "Industrial floor slab thickness, reinforcement, hardener application" }
    ],
    scopeHints: [
      "steel portal frame structure (wide-span, column-free interior)",
      "rib-type or long-span roofing with steel purlins",
      "reinforced concrete floor slab with hardener topping",
      "roll-up doors and personnel doors",
      "concrete hollow block perimeter wall or metal cladding",
      "rainwater gutters and downspouts",
      "basic lighting (high-bay LED) and power for operations",
      "fire extinguishers per RA 9514 storage class"
    ]
  },
  civil: {
    label: "Civil / Site Works",
    standards: [
      { code: "DPWH Blue Book Vol. 4", name: "DPWH Standard Specifications — Roads and Pavements", scope: "Sub-base, base course, PCC pavement, curb and gutter, road markings" },
      { code: "DPWH Blue Book Vol. 5", name: "DPWH Standard Specifications — Water Supply and Drainage", scope: "Waterline pipe installation, jointing, thrust blocks, pressure testing" },
      { code: "LWUA Technical Standards", name: "Local Water Utilities Administration Standards", scope: "Water system design, materials, service connections, valve spacing" },
      { code: "RA 9275", name: "Philippine Clean Water Act", scope: "Drainage discharge requirements, sewage management, environmental compliance" },
      { code: "ASTM D3034 / AWWA C900", name: "PVC Pipe for Gravity Sewer and Pressure Water Mains", scope: "PVC pipe class selection, fittings, jointing method per intended use" }
    ],
    scopeHints: [
      "waterline pipe installation (PVC or HDPE per LWUA standards) with pressure testing",
      "PVC couplings (1 per 6m), elbows (1 per 40m), tees at branches, reducers at transitions",
      "gate valves at 300m intervals or as shown, gate valve box covers",
      "fire hydrants with marker posts, blow-off valves at low points",
      "concrete thrust blocks at all fittings and changes in direction",
      "gravel bedding (0.08 m³/m) and sand backfill in pipe trenches",
      "drainage pipes (RCP or HDPE) with manholes every 50–80m, catch basins at low points",
      "gravel sub-base (300mm compacted) + crushed aggregate base course (150mm)",
      "Portland cement concrete (PCC) pavement at 150–200mm thickness",
      "curb and gutter (precast or cast-in-place) on both sides of road",
      "pavement markings (centerline, edge lines) upon completion",
      "safety provisions: traffic barricades (1 set per 50m), safety vests, hard hats, cones"
    ]
  }
};

/**
 * Refines a basic user prompt by injecting discipline-specific
 * standards references and scope hints. The enriched prompt is then
 * passed to the estimate generator so the correct BOQ profile is used.
 *
 * @param {string} prompt - The user's original brief
 * @param {string} disciplineKey - Key from DISCIPLINES (e.g. "electrical")
 * @returns {string} - The refined prompt string
 */
export function refinePromptWithStandards(prompt, disciplineKey) {
  const discipline = STANDARDS[disciplineKey];
  if (!discipline || !disciplineKey) return prompt;

  const codeList = discipline.standards.map((s) => s.code).join(", ");
  const scopeList = discipline.scopeHints.join("; ");

  return `${prompt.trim()}

Discipline: ${discipline.label}.
Applicable standards: ${codeList}.
Required scope: ${scopeList}.`;
}
