# BuildIntel

AI construction estimating and costing platform, built on a reusable estimating core for future vertical expansion.

## Positioning

BuildIntel should be presented publicly as a construction-first product.

External message:

- AI construction estimating and costing platform
- built for contractors, estimators, and small construction companies

Internal product strategy:

- universal estimating engine
- construction as the first vertical pack
- future expansion into service, fabrication, maintenance, and specialty trades

## What is included

- Multi-tenant company workspace with `Admin`, `Estimator`, and `Viewer` roles in the data model
- Authentication flows for registration, login, and demo password reset
- AI-style blueprint analyzer that generates BOQ starter quantities from uploaded plan metadata
- Smart estimate generator for materials, labor, equipment, waste factors, and contract pricing
- Market price research and supplier finder flows with supplier comparison cards
- Profit optimization simulator for overhead, profit, and contingency adjustments
- Material intelligence database and subscription plan dashboard
- PDF proposal export endpoint for estimate handoff
- PostgreSQL-ready schema at [server/db/schema.sql](/d:/Web%20App/BuildIntel/server/db/schema.sql)

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database target: PostgreSQL schema provided, demo runtime uses seeded JSON storage so the app runs without external services

## Run locally

```bash
npm install
npm run seed
npm run dev
```

Frontend runs at `http://localhost:5173` and the API runs at `http://localhost:4000`.

## PostgreSQL Mode

The app still boots in demo mode by default so the workspace stays runnable without external services.

To run Phase 1 against PostgreSQL instead:

```bash
cp .env.example .env
# set DEMO_MODE=false and DATABASE_URL to your database
npm run migrate
npm run seed
npm run dev
```

## OpenAI Estimate Provider

The app still defaults to the local demo estimate engine. To route estimate generation through OpenAI instead:

```bash
cp .env.example .env
# keep your existing settings, then set:
# AI_PROVIDER=openai
# OPENAI_API_KEY=your_key_here
# OPENAI_MODEL=gpt-4.1-mini
npm run dev
```

When `AI_PROVIDER=openai`, the `/api/ai/estimate` route uses the official OpenAI Node SDK and the Responses API, then validates the returned JSON before saving the estimate.

The same provider setting is also used for document extraction:

- `/api/ai/blueprint`
- `/api/projects/:id/documents`

For text-like uploads such as `.txt`, `.md`, `.csv`, and `.json`, the server forwards extracted text context to OpenAI. If the OpenAI extraction call fails, the app automatically falls back to the local heuristic analyzer so the workflow remains usable.

## GitHub Models Provider

If you want a cloud AI option without using the OpenAI API billing path, the app can also use GitHub Models.

```bash
cp .env.example .env
# keep your existing settings, then set:
# AI_PROVIDER=github-models
# GITHUB_MODELS_TOKEN=your_github_pat_with_models_scope
# GITHUB_MODELS_MODEL=openai/gpt-4.1
npm run dev
```

When `AI_PROVIDER=github-models`, the app sends estimate-generation and document-extraction requests to GitHub Models using the chat completions inference endpoint.

## Deployment Path

The production server can now serve the built React app directly from the Express process after `npm run build`.

For a basic staging stack with PostgreSQL:

```bash
docker compose up --build
```

That stack:

- builds the client and server into one container
- runs PostgreSQL alongside the app
- applies migrations before the server boots
- serves the UI and API from `http://localhost:4000`

## CI

This repo now includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs:

- `npm ci`
- `npm run seed`
- `npm run build`
- `npm run test`
- `npm run test:e2e`

## End-to-End Smoke Test

Playwright is configured at `playwright.config.js` to boot the app in a production-style mode and validate the main UI flow.

Run it locally with:

```bash
npx playwright install chromium
npm run test:e2e
```

## Demo login

- Email: `admin@northforge.dev`
- Password: `buildintel123`

## Notes

- The current price research layer ships with seeded supplier data to keep the app runnable in this workspace.
- `DEMO_MODE` is enabled by default. Add a real persistence layer behind the existing service endpoints when connecting PostgreSQL.
