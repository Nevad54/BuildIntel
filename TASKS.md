# Execution Tasks

## Priority Legend

- `P0`: must ship for MVP
- `P1`: should ship soon after MVP if not finished in time
- `P2`: later enhancement

## Epic 1: Platform Foundation

- `P0` Set up PostgreSQL connection layer
- `P0` Add migrations for companies, users, projects, estimates, materials, templates, subscriptions
- `P0` Replace JSON runtime store with database repositories
- `P0` Add environment validation
- `P0` Add centralized error handling and request logging
- `P1` Add health checks and operational metrics
- `P1` Add CI pipeline for lint, build, and tests

## Epic 2: Authentication and Access Control

- `P0` Implement persistent registration flow
- `P0` Implement secure login flow
- `P0` Implement secure password reset token flow
- `P0` Add invite-user flow
- `P0` Enforce `Admin`, `Estimator`, and `Viewer` API permissions
- `P0` Add frontend route guards by role
- `P1` Add email verification

## Epic 3: Multi-Tenant Workspace

- `P0` Ensure every core table is scoped to company
- `P0` Add company profile management
- `P0` Add team management page
- `P0` Add ownership and deactivation rules
- `P1` Add branding configuration for proposals

## Epic 4: Project Management

- `P0` Build create-project form with location, type, area, description
- `P0` Build project list and detail screens
- `P0` Add project status tracking
- `P1` Add project duplication
- `P1` Add assumptions and notes panel

## Epic 5: Estimate Templates and Assemblies

- `P0` Persist company estimate templates
- `P0` Attach default overhead/profit/contingency to template
- `P1` Add industry or vertical template support
- `P1` Build reusable assemblies library
- `P1` Build labor and equipment presets

## Epic 6: AI Estimate Generator

- `P0` Replace current heuristic endpoint with structured estimate service abstraction
- `P0` Separate core estimate engine from construction-specific estimating rules
- `P0` Save estimate versions and prompts
- `P0` Show AI output, assumptions, and editable items in UI
- `P0` Add regenerate estimate action
- `P1` Add confidence scoring
- `P1` Add estimate comparison view

## Epic 7: Blueprint and Document Analyzer

- `P0` Add upload API and file storage integration
- `P0` Add OCR parsing job pipeline
- `P0` Save extracted plan metadata and BOQ suggestions
- `P0` Build review screen for extracted measurements and scope fields
- `P1` Add manual dimension markup tools

## Epic 8: Spreadsheet Workspace

- `P0` Build editable estimate table
- `P0` Add live totals recalculation
- `P0` Support add/remove/edit line items
- `P1` Support grouping and sorting
- `P1` Support formulas and reusable rows

## Epic 9: Material Intelligence Database

- `P0` Persist canonical materials catalog
- `P0` Add unit and category fields
- `P0` Store average and historical pricing
- `P1` Add supplier SKU mapping
- `P1` Add trend analytics

## Epic 9A: Future Verticalization Layer

- `P1` Define platform-level schema for future universal estimates
- `P1` Add vertical configuration model for construction, service, fabrication, and maintenance
- `P1` Add vertical-specific prompt templates and estimate presets
- `P1` Add admin controls for enabling vertical packs per tenant
- `P1` Add industry-specific dashboard widgets

## Epic 10: Market Price Research

- `P0` Create supplier-source abstraction
- `P0` Build normalized price result model
- `P0` Add material price comparison API
- `P0` Show lowest, average, recommended estimate price in UI
- `P1` Add scheduled refresh jobs
- `P1` Add stale-price warnings

## Epic 11: Supplier Finder

- `P0` Add supplier ranking by project location
- `P0` Show delivery status and distance
- `P1` Allow line-item supplier selection
- `P1` Save preferred supplier choices

## Epic 12: Profit Optimization

- `P0` Persist pricing scenarios
- `P0` Add overhead/profit/contingency controls to estimate screen
- `P0` Recompute summary totals live
- `P1` Add side-by-side scenario comparison

## Epic 13: Proposal Export

- `P0` Build branded PDF template
- `P0` Include project details, company info, line items, totals, signatures
- `P0` Add export action in estimate screen
- `P1` Add summary and detailed proposal modes
- `P1` Add CSV/Excel export

## Epic 14: Dashboard and Alerts

- `P0` Show total projects, estimates, and average project value
- `P0` Show price alert widgets
- `P1` Add pipeline and usage charts
- `P1` Add configurable alert thresholds

## Epic 15: Billing and Monetization

- `P0` Add subscription entity and plan enforcement
- `P0` Gate features by plan
- `P1` Integrate billing provider
- `P1` Add invoice and billing history page

## Epic 16: Quality, Security, and Launch

- `P0` Add API integration tests for auth and tenant isolation
- `P0` Add end-to-end tests for core estimate flow
- `P0` Secure file uploads and limits
- `P0` Add audit logging for sensitive actions
- `P0` Add staging deployment path
- `P1` Add monitoring dashboards and alerting

## Suggested Delivery Order

1. Foundation and auth
2. Multi-tenant workspace
3. Project and estimate core
4. Blueprint upload and review
5. Price research and supplier finder
6. Profit simulation and proposal export
7. Billing, alerts, and launch hardening
8. Future verticalization layer

## First Build Slice

If execution starts immediately, the first implementation slice should be:

1. PostgreSQL and migrations
2. Auth and role enforcement
3. Tenant-safe project persistence
4. Saved estimates in database
5. Editable estimate table
6. PDF export tied to saved estimate
7. Core estimate engine abstraction for future verticals
