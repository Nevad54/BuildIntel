# Directive: Discipline-Aware Prompt Refinement and Estimate Generation

## Goal

Enable users to select a construction discipline (e.g. Electrical, Plumbing, Fire Protection) in the Prompt Library and Generate Draft workflow. The system then:

1. Shows the relevant Philippine and international standards for that discipline
2. Offers a one-click "Refine Prompt" that injects discipline-specific, standards-referenced scope language into the user's prompt
3. Passes the discipline to the generator so the correct BOQ profile (materials, labor, equipment) is used

## Inputs

- `prompt` — the user's natural-language project brief
- `discipline` — one of the predefined discipline keys (see list below)
- `projectId` — optional linked project
- `templateId` — optional estimate template (overhead %, profit %, contingency %)

## Discipline Keys and Profiles

| Key | Label | Profile in ai.js | Primary Standards |
|-----|-------|-----------------|------------------|
| `residential` | Residential | residential | NBC RA 6541, NSCP 2015 |
| `structural` | Structural | structural | NSCP 2015, ACI 318, ASTM A615 |
| `architectural` | Architectural | architectural | NBC RA 6541, DPWH Blue Book |
| `electrical` | Electrical | electrical | PEC 2017, IEC 60364, RA 7920 |
| `plumbing` | Plumbing | plumbing | NPCP 1999, RA 1378 |
| `firePro` | Fire Protection | firePro | RA 9514, NFPA 13, NFPA 72 |
| `highrise` | High-rise | highrise | NSCP 2015 Vol.1, ASHRAE 90.1, CTBUH |
| `prefab` | Prefabrication | prefab | PCI Design Handbook, ACI 318, AWS D1.1 |
| `fitout` | Fit-out / Office | fitout | NBC RA 6541, DPWH specs |
| `warehouse` | Warehouse / Industrial | warehouse | NBC RA 6541, NSCP 2015 |

## Execution

### Step 1 — Client-side prompt refinement (`client/src/lib/disciplines.js`)

The user selects a discipline and clicks "Refine Prompt". The function `refinePromptWithStandards(prompt, disciplineKey)` appends:
- The discipline label
- Applicable standard codes
- Discipline-specific scope hints

This enriches the prompt before it is sent to the generator.

### Step 2 — Server-side profile selection (`server/src/ai.js`)

`generateEstimate({ prompt, materials, template, discipline })` calls `detectProfile(prompt, discipline)`.

- If `discipline` is provided and matches a profile key, that profile is used directly — no regex needed.
- If `discipline` is absent or unknown, falls back to regex-based detection from the prompt text.

### Step 3 — BOQ generation

The selected profile's `materials(area)`, `labor(area)`, and `equipment(area)` functions produce discipline-specific line items. These are tuned further by `extractPromptContext` (floors, finish level, exclusions).

## Outputs

- A refined prompt string (stored as the estimate's `prompt` field)
- A complete BOQ with materials, labor, and equipment rows specific to the discipline
- The estimate is saved with the standard recalculation (waste, overhead, profit, contingency, final price)

## Edge Cases and Notes

- If the user refines the prompt but then manually edits it after, the refinement language is still embedded — this is intentional.
- `firePro` estimates always include a fixed BFP permit assistance line item (₱15,000) regardless of area — it's a flat compliance cost.
- `highrise` estimates include elevator and BMS as unit lot items — quantities don't scale linearly with area.
- `prefab` has the lowest waste factor (4%) since factory-made components have tight tolerances.
- `electrical` and `plumbing` require licensed professionals per RA 7920 / RA 1378 — labor items always include a supervision line.
- When `discipline` is passed to the server, it overrides regex detection. Never pass an empty string as discipline — omit the field entirely if no discipline is selected.

## Future improvements

- Add a `GET /api/standards?discipline=electrical` endpoint to serve standards data dynamically (useful if standards need to be updated without a frontend deploy)
- Allow multiple disciplines in one estimate (e.g. Electrical + Plumbing as combined MEP)
- Store the discipline on the saved estimate record for better filtering and reporting
