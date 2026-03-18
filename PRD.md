# Product Requirements Document

## Product Name

BuildIntel

Public positioning:

- AI Construction Estimating and Costing Platform

Internal platform strategy:

- Universal estimating engine with construction as the first vertical

## Product Summary

BuildIntel is a full-stack SaaS web application for contractors, estimators, and small construction companies. It combines AI automation, estimating workflows, blueprint and document analysis, pricing research, and proposal generation to produce construction estimates faster and more accurately.

Internally, the platform should be designed so the same estimating engine can later support additional industries without changing the product’s initial market focus.

The system acts like an AI construction assistant that helps users:

- read project descriptions
- analyze uploaded blueprints, plans, and scope documents
- generate bill of quantities and cost breakdowns
- research supplier pricing
- calculate total project cost
- optimize profit margins
- generate proposal-ready estimate outputs

## Problem

Construction estimating is slow, repetitive, and highly manual. Many contractors and estimators still prepare quotes using spreadsheets, supplier calls, manual takeoffs, and inconsistent templates. This creates:

- slow turnaround time
- inconsistent pricing
- estimation errors
- poor version control
- limited collaboration across teams

## Goal

Reduce estimate preparation time from hours to minutes while improving pricing visibility, consistency, and decision support.

## Target Users

### Primary Users

- Contractors
- Estimators
- Small construction companies
- Builders and specialty trades

### Secondary Users

- Company owners
- Project managers
- Procurement staff
- Finance reviewers

## Core Product Goals

1. Enable fast estimate generation from a prompt or uploaded plans.
2. Support multi-tenant SaaS usage for multiple companies.
3. Give teams accurate and editable BOQ, labor, equipment, and cost breakdowns.
4. Surface current market price comparisons from multiple suppliers.
5. Allow margin simulation with overhead, profit, and contingency controls.
6. Produce professional proposal outputs for clients.

## Functional Requirements

### 1. Multi-Tenant SaaS

Each company must have:

- an account owner
- team members
- project database
- pricing database
- estimate templates
- company branding

### 2. Authentication and Roles

Support:

- user registration
- login
- password reset
- invited team members
- role-based access

Roles:

- `Admin`
- `Estimator`
- `Viewer`

### 3. Project Management

Users can:

- create projects
- add project location and details
- attach files and plans
- track project status
- reopen previous estimates and revisions

### 4. Blueprint and Document Analyzer

Users can upload:

- floor plans
- blueprints
- site drawings
- PDF construction plans
- scope documents

The system should extract:

- room dimensions
- wall lengths
- floor areas
- structural elements
- scope details
- structured estimating inputs

The output should generate a draft estimate breakdown, with blueprint-driven BOQ output as a core construction workflow.

### 5. Smart Estimate Generator

Users can prompt the system with plain language such as:

`Generate estimate for a 60sqm bungalow house in Quezon City`

The system should estimate:

- materials
- labor
- equipment
- waste factors
- direct cost
- total contract price

### 6. Market Price Research Engine

The system should research prices from sources such as:

- Wilcon Depot
- CW Home Depot
- Handyman Do It Best
- Shopee
- Lazada

The supplier layer should be extensible so future industries can plug in their own vendor sources later.

The system should show:

- supplier
- material
- current price
- unit
- checked date
- lowest price
- average price
- recommended estimate price

### 7. Supplier Finder

The system should suggest suppliers near the project location with:

- distance
- price
- delivery availability

### 8. Profit Optimization

Users should be able to adjust:

- overhead percentage
- profit percentage
- contingency percentage

The system should update:

- direct cost
- overhead value
- profit value
- contingency value
- final contract price

### 9. Material Intelligence Database

Store:

- material name
- unit type
- average market price
- supplier list
- last period price
- price trend

### 10. Proposal Generator

Generate professional estimate outputs containing:

- company branding
- project details
- itemized cost table
- total contract price
- signature section

Export options:

- PDF
- print-ready layout
- spreadsheet export later

### 11. Dashboard

The dashboard should show:

- total projects
- total estimates
- average project value
- material price alerts
- supplier and market insights

### 12. SaaS Monetization

Support plans such as:

- Starter
- Pro
- Enterprise

Starter:

- 5 projects
- basic estimates

Pro:

- unlimited projects
- AI estimates
- supplier comparison

Enterprise:

- team collaboration
- API access
- advanced support

## Non-Functional Requirements

- Fast and responsive UI
- Spreadsheet-style editing experience
- Real-time recalculation
- Tenant data isolation
- Secure auth and file handling
- Background jobs for OCR, AI, and price research
- Scalable architecture for future API and enterprise features

## Success Metrics

- Time to first estimate
- Average estimate creation time
- Estimate revision count
- User retention by company
- AI estimate adoption rate
- Proposal export usage
- Paid conversion from Starter to Pro

## MVP Scope

The MVP should include:

- multi-tenant auth and roles
- PostgreSQL persistence
- project creation
- AI estimate generation
- blueprint and document upload with assisted extraction
- market price comparison
- supplier finder
- profit simulation
- PDF proposal export
- subscription plan enforcement

## Out of Scope for MVP

- Full ERP integration
- Native mobile apps
- Real-time bidding marketplace
- Advanced procurement workflows
- Public API for third parties

## Tech Stack

- Frontend: React + Tailwind CSS
- Backend: Node.js + Express
- Database: PostgreSQL
- AI Integration: LLM API
- OCR: document parsing service
- Price Research: scraping or supplier ingestion service

## Architecture Strategy

The product should be construction-first in market positioning and universal at the platform layer.

Public product:

- construction estimating and costing platform

Internal architecture:

- auth
- tenant isolation
- estimating engine
- pricing engine
- document analysis
- proposal generation
- subscriptions

Future expansion:

- construction remains the first and deepest workflow
- the architecture should support reusable vertical templates and industry-specific modules later

## End-State Vision

The final product should function as a trusted AI-powered estimating assistant for construction companies first, while preserving an architecture that can expand into other estimating-heavy industries later.
