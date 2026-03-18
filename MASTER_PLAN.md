# BuildIntel Master Plan

## 1. Product Direction

### Product Name

BuildIntel

### Public Positioning

AI construction estimating and costing platform for contractors, estimators, and small construction companies.

### Internal Product Strategy

Reusable estimating platform core with construction as the first and deepest vertical.

### Product Goal

Reduce construction estimate preparation time from hours to minutes while improving pricing accuracy, consistency, collaboration, and proposal quality.

## 2. Problem Statement

Construction estimating is often fragmented across spreadsheets, supplier calls, manual takeoffs, email threads, and disconnected documents. This creates:

- slow turnaround time
- pricing inconsistency
- missed scope items
- poor revision control
- difficulty collaborating
- weak visibility into margin and risk

## 3. Product Vision

BuildIntel should function as an AI-powered construction estimating assistant that can:

- understand project descriptions
- analyze plan files and scope documents
- produce BOQ and estimate drafts
- compare supplier pricing
- calculate labor, equipment, overhead, contingency, and profit
- generate client-ready proposals

## 4. Product Principles

- Construction-first, platform-ready
- AI assists, users stay in control
- Spreadsheet-speed editing
- Minimal clicks for common actions
- Estimates must be transparent and editable
- Pricing data must show source and freshness
- Multi-tenant isolation by default
- Professional outputs must be export-ready

## 5. Target Customers

### Primary Customers

- Small construction companies
- General contractors
- Specialty contractors
- Independent estimators

### Secondary Customers

- Builders
- Fit-out contractors
- Procurement-heavy construction teams
- Preconstruction teams in growing firms

## 6. User Personas

### 6.1 Company Owner

Needs:

- team access control
- estimate visibility
- pricing and profitability oversight
- subscription and billing control

### 6.2 Admin

Needs:

- manage users
- maintain templates
- maintain pricing catalog
- configure branding

### 6.3 Estimator

Needs:

- fast project intake
- document analysis
- editable estimates
- live pricing comparison
- quick proposal export

### 6.4 Viewer

Needs:

- read-only access to projects and estimates
- exported documents
- estimate summary review

## 7. Core Use Cases

### 7.1 Create a New Project

The user creates a project, enters location and description, uploads relevant documents, and chooses a template.

### 7.2 Generate Estimate From Prompt

The user enters a natural-language instruction and receives a draft estimate with BOQ, labor, equipment, and totals.

### 7.3 Generate Estimate From Blueprint

The user uploads plan files and receives extracted measurements and BOQ suggestions.

### 7.4 Research Market Prices

The user searches for a material and sees supplier comparisons, pricing stats, and vendor options.

### 7.5 Adjust Margin Strategy

The user changes overhead, contingency, and profit and immediately sees final contract price updates.

### 7.6 Export Proposal

The user turns an estimate into a branded PDF proposal with signature and pricing breakdown sections.

## 8. Functional Scope

### 8.1 Authentication

Required:

- registration
- login
- logout
- password reset
- invite flow
- session/token management

### 8.2 Role System

Roles:

- `Admin`
- `Estimator`
- `Viewer`

Role responsibilities:

- `Admin`: company settings, team, templates, pricing, billing
- `Estimator`: projects, estimates, proposals, pricing workflows
- `Viewer`: read-only review

### 8.3 Multi-Tenant SaaS

Each tenant should have:

- company profile
- owner/admin users
- project records
- estimate records
- pricing data
- templates
- branding
- subscription record

### 8.4 Project Management

Capabilities:

- create project
- edit project
- archive project
- duplicate project
- upload files
- track status
- store assumptions and notes

### 8.5 Estimate Generator

Capabilities:

- prompt-based estimate generation
- template-based estimate generation
- BOQ generation
- labor costing
- equipment costing
- waste factor support
- overhead/profit/contingency handling

### 8.6 Blueprint and Document Analyzer

Capabilities:

- upload PDF/image plans
- OCR and text extraction
- dimension extraction
- structural element detection
- BOQ suggestion
- review and correction workflow

### 8.7 Estimate Workspace

Capabilities:

- spreadsheet-style editing
- inline quantity editing
- editable units and pricing
- line item add/remove/reorder
- category grouping
- notes and assumptions
- live totals

### 8.8 Pricing Engine

Capabilities:

- supplier lookup
- normalized units
- lowest price
- average price
- recommended estimate price
- freshness timestamp
- location-aware supplier ranking

### 8.9 Material Intelligence Database

Capabilities:

- canonical materials list
- supplier mapping
- price history
- trend detection
- unit management

### 8.10 Profit Optimization

Capabilities:

- adjust direct cost assumptions
- modify overhead
- modify contingency
- modify profit
- save scenarios
- compare scenarios

### 8.11 Proposal Generator

Capabilities:

- branded PDF
- summary mode
- detailed mode
- print-ready output
- signature sections
- cover page support later

### 8.12 Dashboard

Should display:

- total projects
- total estimates
- average project value
- recent activity
- material price alerts
- estimate performance summaries

### 8.13 Billing and Subscription

Capabilities:

- Starter, Pro, Enterprise plans
- usage limits
- upgrade path
- billing records
- feature gates

## 9. Construction-Specific Scope

BuildIntel should be strongest in the following construction workflows:

- residential estimating
- small commercial estimating
- fit-out and renovation
- structural BOQ starter generation
- supplier price comparison for common materials

Construction-specific examples:

- cement
- rebar
- CHB
- sand
- gravel
- roofing
- finishing materials

## 10. Future Expansion Scope

The platform should be architected for future vertical packs:

- maintenance and field service
- fabrication
- interiors and fit-out
- specialty trade estimating

This is not launch scope, but should influence data modeling and service boundaries.

## 11. User Flows

### 11.1 New Company Flow

1. User registers company
2. Company owner account is created
3. Owner lands in onboarding
4. Owner creates first project
5. Owner generates first estimate

### 11.2 Estimator Daily Flow

1. Open dashboard
2. Create or open project
3. Upload documents or enter prompt
4. Review AI-generated estimate
5. Edit line items
6. Run pricing research
7. Adjust margins
8. Export proposal

### 11.3 Team Collaboration Flow

1. Admin invites estimator/viewer
2. Team member joins workspace
3. Estimator creates or edits estimate
4. Viewer reviews final output
5. Admin exports proposal or tracks activity

## 12. Information Architecture

Top-level product areas:

- Auth
- Dashboard
- Projects
- Estimates
- Pricing
- Materials
- Templates
- Team
- Billing
- Settings

## 13. Data Model

### Core Entities

- Company
- User
- Membership or role assignment
- Subscription
- Project
- ProjectDocument
- Estimate
- EstimateVersion
- EstimateItem
- EstimateTemplate
- Material
- Supplier
- SupplierPrice
- PriceAlert
- Proposal
- AuditLog

### Recommended Entity Notes

#### Company

- id
- name
- slug
- branding
- plan
- ownerId
- createdAt
- updatedAt

#### User

- id
- companyId
- name
- email
- passwordHash
- role
- status
- lastLoginAt
- createdAt
- updatedAt

#### Project

- id
- companyId
- name
- location
- description
- status
- projectType
- areaSqm
- assumptions
- createdBy
- createdAt
- updatedAt

#### ProjectDocument

- id
- projectId
- companyId
- fileName
- fileType
- storageUrl
- documentKind
- ocrStatus
- parsedOutput
- uploadedBy
- createdAt

#### Estimate

- id
- companyId
- projectId
- templateId
- currentVersionId
- status
- prompt
- createdBy
- createdAt
- updatedAt

#### EstimateVersion

- id
- estimateId
- companyId
- versionNumber
- prompt
- directCost
- laborCost
- equipmentCost
- wasteFactorPercent
- overheadPercent
- contingencyPercent
- profitPercent
- finalContractPrice
- assumptions
- aiMetadata
- createdBy
- createdAt

#### EstimateItem

- id
- estimateVersionId
- category
- itemType
- name
- description
- quantity
- unit
- unitPrice
- totalPrice
- sourceType
- supplierId
- notes
- sortOrder

#### Material

- id
- companyId
- name
- category
- unit
- defaultWasteFactor
- averagePrice
- trend
- lastUpdatedAt

#### Supplier

- id
- companyId nullable
- name
- region
- address
- deliverySupported
- contactInfo

#### SupplierPrice

- id
- supplierId
- materialId nullable
- materialNameRaw
- normalizedUnit
- price
- location
- sourceUrl
- checkedAt

#### Proposal

- id
- companyId
- estimateVersionId
- fileUrl
- format
- generatedBy
- createdAt

#### AuditLog

- id
- companyId
- userId
- action
- entityType
- entityId
- metadata
- createdAt

## 14. API Surface

### Auth APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/invite`

### Bootstrap and Dashboard

- `GET /api/bootstrap`
- `GET /api/dashboard`

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`
- `POST /api/projects/:id/archive`
- `POST /api/projects/:id/duplicate`

### Documents

- `POST /api/projects/:id/documents`
- `GET /api/projects/:id/documents`
- `POST /api/documents/:id/analyze`
- `GET /api/documents/:id/results`

### Estimates

- `GET /api/estimates`
- `POST /api/estimates`
- `GET /api/estimates/:id`
- `PATCH /api/estimates/:id`
- `POST /api/estimates/:id/generate`
- `POST /api/estimates/:id/simulate`
- `POST /api/estimates/:id/duplicate`
- `GET /api/estimates/:id/versions`

### Pricing

- `POST /api/pricing/research`
- `POST /api/pricing/suppliers`
- `GET /api/materials`
- `POST /api/materials`
- `PATCH /api/materials/:id`

### Templates

- `GET /api/templates`
- `POST /api/templates`
- `PATCH /api/templates/:id`

### Proposals

- `POST /api/proposals`
- `GET /api/proposals/:id`
- `GET /api/estimates/:id/pdf`

### Team and Settings

- `GET /api/team`
- `POST /api/team/invite`
- `PATCH /api/team/:id`
- `GET /api/settings/company`
- `PATCH /api/settings/company`

### Billing

- `GET /api/billing/subscription`
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`

## 15. Frontend Application Structure

### Screens

- Landing / login
- Registration
- Password reset
- Dashboard
- Projects list
- Project details
- Upload and document review
- Estimate workspace
- Pricing research view
- Materials database
- Templates
- Team management
- Billing and subscription
- Settings

### Shared UI Components

- App shell
- Data table
- Form components
- Metric cards
- Alert banners
- Modal dialogs
- File upload widget
- Estimate editor table
- Scenario summary cards

## 16. AI Architecture

### AI Responsibilities

- interpret estimating prompts
- transform extracted document data into estimate suggestions
- generate BOQ starter drafts
- suggest assumptions and line items

### AI Should Not Do Alone

- final irreversible totals without review
- silent data changes
- unsupported supplier or pricing claims without traceability

### AI Output Requirements

- structured JSON-compatible response shape
- confidence signals where possible
- explainable assumptions
- editable output in the UI

## 17. OCR and Document Processing

### Required Capabilities

- OCR text extraction
- metadata extraction
- dimension or scope field extraction
- blueprint-specific parsing for construction documents

### Processing Model

- upload file
- store securely
- enqueue background job
- parse OCR
- extract structured output
- show review UI
- confirm into estimate

## 18. Pricing Research Architecture

### Pricing Data Sources

- direct supplier sources
- e-commerce sources
- manually curated admin entries
- future partner integrations

### Pricing Requirements

- normalize units
- preserve raw source values
- store checked timestamp
- store source link where possible
- calculate average and lowest
- mark stale data

## 19. Security Requirements

### Auth and Access

- hashed passwords
- secure reset tokens
- JWT or secure session strategy
- role-based authorization
- tenant isolation on every query

### Data Protection

- secure file storage
- upload size limits
- content validation
- audit logs for sensitive changes

### App Security

- CORS control
- input validation
- output escaping
- rate limiting
- request logging
- dependency updates

## 20. Compliance and Legal Considerations

- Terms of service
- Privacy policy
- file retention policy
- acceptable use policy
- billing terms
- AI disclaimer language for estimate assistance

## 21. Performance Requirements

- fast dashboard load
- responsive estimate editing
- non-blocking document analysis via background jobs
- cached pricing results where appropriate
- efficient pagination for projects and estimates

## 22. Reliability Requirements

- automated backups
- retry handling for background jobs
- graceful failure for third-party services
- health checks
- error monitoring
- admin-safe recovery paths

## 23. Analytics Requirements

Track:

- signups
- activated workspaces
- project creation rate
- estimate generation rate
- proposal export rate
- AI feature usage
- pricing research usage
- plan conversion
- churn signals

## 24. Support and Admin Operations

Internal tools needed:

- tenant lookup
- user lookup
- estimate debug view
- failed OCR job view
- failed pricing job view
- billing status view

## 25. Notifications

Should support:

- invite emails
- password reset emails
- billing emails
- material price alerts
- completed document analysis alerts

## 26. Search and Filtering

Users should be able to search and filter:

- projects
- estimates
- materials
- supplier prices
- team members

## 27. Versioning and Auditability

Critical records that need versioning or history:

- estimates
- proposal exports
- pricing data snapshots
- project assumptions
- templates

## 28. Billing Strategy

### Starter

- limited projects
- basic estimate generation
- limited team size

### Pro

- unlimited projects
- AI estimate generation
- pricing comparison
- collaboration

### Enterprise

- advanced permissions
- API access
- onboarding support
- higher usage limits

## 29. Monetization Assumptions

Revenue sources:

- subscriptions
- per-seat pricing later
- enterprise onboarding later
- API or usage billing later

## 30. Launch Scope

### MVP Must Include

- multi-tenant auth
- role system
- PostgreSQL persistence
- project creation
- estimate generation
- document upload
- assisted estimate review
- pricing comparison
- profit simulation
- PDF export
- subscription plan gating

### MVP Should Exclude

- public API
- mobile apps
- deep accounting integrations
- advanced enterprise workflow automation

## 31. Post-MVP Expansion

- deeper blueprint takeoff
- richer supplier integrations
- more estimate templates
- advanced reporting
- enterprise controls
- future vertical packs

## 32. Technical Architecture

### Frontend

- React
- Tailwind CSS
- modular feature folders
- form validation
- route protection

### Backend

- Node.js
- Express
- modular services
- auth middleware
- background job support

### Database

- PostgreSQL
- migrations
- seed scripts
- tenant-safe query patterns

### Storage

- object storage for documents and proposals

### Async Processing

- OCR jobs
- AI jobs
- price refresh jobs
- notification jobs

## 33. Recommended Build Order

### Phase 1: Foundation

- PostgreSQL
- auth
- roles
- tenant isolation
- base data model

### Phase 2: Estimating Core

- projects
- templates
- estimates
- editable estimate table
- proposal export

### Phase 3: AI and Documents

- document upload
- OCR workflow
- estimate assistance

### Phase 4: Pricing Intelligence

- materials catalog
- supplier research
- supplier finder
- price alerts

### Phase 5: SaaS Hardening

- billing
- analytics
- support tooling
- tests
- launch operations

## 34. Testing Strategy

### Unit Tests

- pricing calculations
- estimate calculations
- auth utilities
- role checks

### Integration Tests

- auth flow
- project creation
- estimate persistence
- tenant isolation
- PDF generation

### End-to-End Tests

- register and onboard company
- create project and estimate
- upload file and review output
- export proposal

## 35. Launch Checklist

- database migrations ready
- production environment configured
- secrets configured
- email provider connected
- file storage configured
- billing configured
- analytics configured
- monitoring configured
- backups configured
- legal pages published
- support contact defined

## 36. Success Metrics

### Product Metrics

- time to first estimate
- time to export proposal
- estimate completion rate
- estimate revision rate
- AI acceptance rate

### Business Metrics

- activation rate
- paid conversion
- expansion from Starter to Pro
- churn rate
- monthly recurring revenue

## 37. Final Product Definition

BuildIntel is a construction-first AI estimating and costing web application that combines:

- prompt-based estimating
- blueprint and document analysis
- pricing intelligence
- spreadsheet-style editing
- margin optimization
- proposal generation
- multi-tenant SaaS controls

It should launch as a focused construction product and be architected as a reusable estimating core for future growth.
