# MVP Scope

## Objective

Ship a launchable SaaS MVP that delivers real value to contractors and estimators by helping them create construction estimates faster with AI-assisted workflows and pricing research.

## MVP Outcome

A company can:

1. create an account
2. invite team members
3. create a project
4. upload plan files or scope documents
5. generate a draft estimate
6. compare material pricing
7. adjust margins
8. export a client-ready PDF proposal

## Must-Have Features

### 1. Multi-Tenant Workspace

- Company account creation
- Company-scoped data
- Team member roles

### 2. Authentication

- Register
- Login
- Password reset
- Invite teammate flow

### 3. Roles

- `Admin`
- `Estimator`
- `Viewer`

### 4. Project Management

- Create project
- Save project details
- View project list
- Project status tracking

### 5. Estimate Generator

- Prompt-based estimate generation
- BOQ draft
- Labor and equipment costing
- Waste factor support
- Save estimate

### 6. Blueprint and Document Upload with Assisted Parsing

- Upload PDF/image plan files
- OCR-assisted extraction
- Manual review and correction

### 7. Market Price Research

- Supplier comparison
- Lowest price
- Average price
- Recommended estimate price

### 8. Supplier Finder

- Nearby supplier suggestions
- Distance
- Delivery availability

### 9. Profit Simulation

- Overhead input
- Profit input
- Contingency input
- Live final contract price update

### 10. Proposal Export

- Branded PDF
- Project details
- Itemized estimate
- Signature section

### 11. Subscription Enforcement

- Starter / Pro / Enterprise display
- Project or feature limits

## MVP Technical Requirements

- PostgreSQL persistence
- Secure API auth
- Tenant-safe queries
- File storage for uploads
- Background job support for OCR and pricing refresh
- Logging and monitoring basics

## MVP Acceptance Criteria

- A new company can sign up and access only its own data.
- An admin can invite users and assign roles.
- An estimator can create a project and generate an estimate from a prompt.
- A user can upload a plan file and receive AI-assisted takeoff output.
- The system can show supplier price comparison for at least a few target suppliers.
- The estimate totals update when overhead, profit, or contingency changes.
- A PDF proposal can be exported successfully.
- Starter and Pro limits are visibly enforced.

## Not Required for MVP

- Enterprise API access
- Deep procurement management
- Full accounting integration
- Native mobile app
- Advanced analytics dashboards beyond core summary metrics

## Launch Readiness Checklist

- Core auth flows tested
- Tenant isolation tested
- Estimate creation tested end to end
- File upload tested
- PDF export tested
- Pricing comparison tested
- Error states handled
- Monitoring enabled
- Seed demo workspace available

## MVP Positioning

The MVP should be construction-first in messaging and sales, with a reusable platform core underneath. That means:

- public-facing product language should stay construction-specific
- architecture should remain reusable for future verticals
- construction should remain the flagship demo and launch workflow
