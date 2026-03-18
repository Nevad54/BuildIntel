# BuildIntel Roadmap

## Vision

Build a production-ready multi-tenant SaaS platform for contractors, estimators, and small construction companies that can:

- read project descriptions
- analyze uploaded blueprints, plans, scope files, and documents
- generate BOQ and cost breakdowns
- research current market prices
- calculate direct cost, overhead, contingency, profit, and final contract price
- generate professional proposals and estimate outputs

The end goal is to reduce estimating time from hours to minutes while keeping estimators in control. Construction remains the launch market, while the platform core stays reusable for future vertical expansion.

## 12-Week Roadmap

### Weeks 1-2: Foundation

1. Replace demo JSON storage with PostgreSQL.
2. Add migrations, seed data, and tenant-safe data access.
3. Refactor backend into modules: auth, projects, estimates, materials, pricing, subscriptions.
4. Add environment validation, logging, error handling, and API request validation.

### Weeks 3-4: Auth and Multi-Tenant SaaS

1. Implement production auth: registration, login, secure password reset, invite flow.
2. Enforce role permissions for `Admin`, `Estimator`, and `Viewer`.
3. Add company workspace management, team members, and ownership rules.
4. Add subscription-plan enforcement for Starter, Pro, and Enterprise.

### Weeks 5-6: Estimating Core

1. Build a proper project creation workflow with project details, location, and templates.
2. Upgrade the estimate generator into a structured BOQ + labor + equipment engine.
3. Add editable line items, waste factors, overhead, contingency, and profit controls.
4. Add estimate saving, revision history, and side-by-side comparison.

### Weeks 7-8: Blueprint and File Intelligence

1. Add real file uploads for PDF plans and drawings.
2. Integrate OCR and document parsing for plan text and measurements.
3. Build blueprint analysis review screens so users can verify extracted quantities.
4. Convert extracted dimensions into takeoff rules that feed the estimate engine.

### Weeks 9-10: Market Pricing and Supplier Intelligence

1. Build supplier ingestion and scraping or research pipelines.
2. Normalize material names, units, and pack sizes into a shared catalog.
3. Add current pricing comparison, lowest price, average price, and estimate recommendation.
4. Add supplier-by-location suggestions, delivery availability, and price trend storage.
5. Add dashboard alerts such as `Rebar prices increased 8% this month`.

### Weeks 11-12: Proposal, Billing, and Launch Readiness

1. Build branded PDF proposal generation with signature section and print-ready layouts.
2. Add billing integration, plan upgrades, trials, and usage limits.
3. Add end-to-end tests, security hardening, audit logging, and deployment pipeline.
4. Prepare staging and production environments, backups, monitoring, and launch checklist.

## Milestones

- End of Week 2: Production-ready backend foundation
- End of Week 4: Real SaaS tenant and auth system
- End of Week 6: Usable estimating product
- End of Week 8: Working blueprint upload and AI-assisted takeoff
- End of Week 10: Live market pricing and supplier comparison
- End of Week 12: Launchable SaaS MVP

## Backlog

### Epic 1: Platform Foundation

- Story: As a developer, I need PostgreSQL wired into the app so tenant data is persisted reliably.
- Story: As a developer, I need migrations and seed scripts so environments can be created consistently.
- Story: As an operator, I need structured logs and error handling so failures are diagnosable.
- Story: As a developer, I need environment validation so startup fails safely on bad config.
- Story: As a team, we need CI checks for build and tests so regressions are caught early.

### Epic 2: Authentication and Access Control

- Story: As a company owner, I can register a company account and become its first admin.
- Story: As a user, I can log in securely with email and password.
- Story: As a user, I can request and complete a password reset.
- Story: As an admin, I can invite team members by email.
- Story: As an admin, I can assign `Admin`, `Estimator`, and `Viewer` roles.
- Story: As a viewer, I can read estimates without editing them.
- Story: As the system, I enforce role permissions on every API route and UI action.

### Epic 3: Multi-Tenant Company Workspace

- Story: As an admin, I can manage my company profile and branding.
- Story: As an admin, I can view all users, projects, templates, and pricing data for my company only.
- Story: As the system, I isolate tenant data so one company cannot access another company’s records.
- Story: As an admin, I can deactivate a teammate without deleting company history.
- Story: As an owner, I can transfer company ownership safely.

### Epic 4: Project Intake

- Story: As an estimator, I can create a project with name, location, type, and description.
- Story: As an estimator, I can attach plans, PDFs, and drawings to a project.
- Story: As an estimator, I can store project assumptions and notes.
- Story: As an estimator, I can browse past projects and duplicate one as a starting point.
- Story: As a team, we can track project status such as `Estimating`, `Submitted`, and `Won/Lost`.

### Epic 5: Estimate Templates and Assemblies

- Story: As an admin, I can create company estimate templates with default overhead, profit, and contingency.
- Story: As an estimator, I can start from a residential or commercial template.
- Story: As an estimator, I can save reusable assemblies for walls, slabs, roofing, and finishes.
- Story: As an estimator, I can reuse company-standard labor and equipment presets.
- Story: As an admin, I can maintain company estimating standards centrally.

### Epic 6: AI Estimate Generator

- Story: As an estimator, I can enter a natural-language prompt to generate a draft estimate.
- Story: As the system, I generate BOQ, labor, and equipment suggestions from the prompt.
- Story: As the system, I apply waste factors and default cost assumptions.
- Story: As an estimator, I can review AI assumptions before saving the estimate.
- Story: As an estimator, I can regenerate the estimate with updated prompts.
- Story: As a manager, I can compare multiple estimate versions for the same project.

### Epic 7: Blueprint Analyzer

- Story: As an estimator, I can upload blueprint PDFs and floor plans.
- Story: As the system, I extract room dimensions, wall lengths, floor areas, and structural elements.
- Story: As the system, I convert extracted data into BOQ suggestions.
- Story: As an estimator, I can manually correct extracted quantities and dimensions.
- Story: As the system, I preserve both raw extracted data and reviewed final values.
- Story: As an estimator, I can see which items came from AI and which were manually edited.

### Epic 8: Spreadsheet-Style Estimating Workspace

- Story: As an estimator, I can edit estimate line items inline without leaving the page.
- Story: As an estimator, I can add, remove, reorder, and group line items.
- Story: As an estimator, I can adjust quantities, units, waste, markups, and notes.
- Story: As an estimator, I can filter by materials, labor, and equipment.
- Story: As an estimator, I can see totals update instantly as I edit values.
- Story: As a viewer, I can inspect estimate details in read-only mode.

### Epic 9: Material Intelligence Database

- Story: As an admin, I can maintain a catalog of materials with units and categories.
- Story: As the system, I store average price, last-month price, and trend per material.
- Story: As an estimator, I can search and reuse catalog materials while building estimates.
- Story: As an admin, I can map supplier SKUs to canonical material records.
- Story: As the system, I track historical price changes for trend analysis.

### Epic 10: Market Price Research Engine

- Story: As an estimator, I can search current prices for a material by location.
- Story: As the system, I collect prices from supplier sources and normalize units.
- Story: As the system, I calculate lowest, average, and recommended estimate prices.
- Story: As an estimator, I can view source supplier, price, unit, and check date.
- Story: As a manager, I can set rules for preferred suppliers or risk-adjusted pricing.
- Story: As the system, I flag stale or low-confidence price data.

### Epic 11: Supplier Finder

- Story: As an estimator, I can find suppliers near the project location.
- Story: As the system, I rank suppliers by distance, price, and delivery availability.
- Story: As an estimator, I can compare nearby supplier options on one screen.
- Story: As the system, I attach supplier choices back to estimate line items.
- Story: As an estimator, I can override supplier recommendations manually.

### Epic 12: Profit Optimization

- Story: As an estimator, I can adjust overhead, contingency, and profit percentages.
- Story: As the system, I recalculate direct cost, markup amounts, and final contract price instantly.
- Story: As a manager, I can save pricing scenarios for negotiation or internal review.
- Story: As an estimator, I can see recommended selling price ranges based on company rules.
- Story: As a viewer, I can review the breakdown without editing it.

### Epic 13: Proposal and Export

- Story: As an estimator, I can generate a branded PDF proposal from an estimate.
- Story: As the system, I include company branding, project details, itemized costs, totals, and signatures.
- Story: As an estimator, I can choose summary or detailed proposal formats.
- Story: As a user, I can print proposals in a clean print-ready layout.
- Story: As a user, I can export estimate data to CSV or Excel.
- Story: As a manager, I can store proposal versions tied to estimate revisions.

### Epic 14: Dashboard and Alerts

- Story: As a user, I can see total projects, total estimates, and average project value on the dashboard.
- Story: As a user, I can see alerts for material price movement and estimate risks.
- Story: As a manager, I can view estimate throughput and project pipeline metrics.
- Story: As the system, I surface alerts such as `Rebar prices increased 8% this month`.
- Story: As an admin, I can configure alert thresholds for key materials.

### Epic 15: Billing and SaaS Monetization

- Story: As a company owner, I can subscribe to Starter, Pro, or Enterprise.
- Story: As the system, I enforce plan limits such as projects, AI usage, and team seats.
- Story: As an owner, I can upgrade or downgrade my subscription.
- Story: As an owner, I can view invoices and billing history.
- Story: As the system, I warn users before they hit usage caps.
- Story: As sales or admin, I can provision Enterprise features manually when needed.

### Epic 16: Quality, Security, and Launch

- Story: As a developer, I need automated tests for auth, tenant isolation, and estimating flows.
- Story: As an operator, I need monitoring and health checks in production.
- Story: As the system, I scan uploaded files and store them securely.
- Story: As a company, we need audit logs for important actions like user invites and estimate approvals.
- Story: As a team, we need backups and restore procedures before launch.
- Story: As stakeholders, we need a staging environment for final QA.

## Suggested Sprint Order

1. Sprint 1: Epics 1-3
2. Sprint 2: Epics 4-6
3. Sprint 3: Epics 7-8
4. Sprint 4: Epics 9-11
5. Sprint 5: Epics 12-14
6. Sprint 6: Epics 15-16

## MVP Definition of Done

- Real auth and multi-tenant access control
- Persistent project and estimate storage in PostgreSQL
- AI draft estimate generation
- Blueprint upload with assisted extraction
- Supplier price comparison and pricing recommendation
- Profit simulation
- PDF proposal export
- Subscription plan enforcement
- Basic tests and production deployment path
