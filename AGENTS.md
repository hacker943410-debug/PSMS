# AGENTS.md

## Project Overview

PSMS is a desktop-first phone shop operations console. It will manage sales, receivables, customers, schedules, inventory, staff, base information, policies, reports, export, and audit logs.

The implementation project is currently in an early bootstrap state. The authoritative rebuild documentation and design references are stored at `C:\Project\PSMS_Tech`.

## Must Read First

Before any substantive work, read the relevant local project state and harness rules:

1. `docs/00_system/project-current-state.md`
2. `docs/00_system/development-flow.md`
3. `docs/00_core/orchestrator-rules.md`
4. `docs/00_core/model-routing.md`
5. `docs/00_core/approval-policy.md`
6. `docs/10_agents/agent-map.md`
7. `docs/20_execution/task-execution-rule.md`
8. `docs/20_execution/task-report-format.md`
9. `docs/00_system/design-implementation-gates.md`
10. `docs/30_validation/testing-policy.md`
11. `docs/30_validation/ui-validation.md`
12. `docs/60_release/electron-release-checklist.md`

For architecture, auth, DB, API, and domain work, also check:

- `C:\Project\PSMS_Tech\README.md`
- `C:\Project\PSMS_Tech\docs\02_INFORMATION_ARCHITECTURE_ROUTES_RBAC.md`
- `C:\Project\PSMS_Tech\docs\03_UI_UX_DESIGN_SYSTEM.md`
- `C:\Project\PSMS_Tech\docs\04_COMPONENT_ARCHITECTURE.md`
- `C:\Project\PSMS_Tech\docs\05_FRONTEND_ARCHITECTURE.md`
- `C:\Project\PSMS_Tech\docs\06_BACKEND_ARCHITECTURE.md`
- `C:\Project\PSMS_Tech\docs\07_DOMAIN_MODEL_DATABASE_SPEC.md`
- `C:\Project\PSMS_Tech\docs\08_SERVER_ACTIONS_AND_API_CONTRACTS.md`
- `C:\Project\PSMS_Tech\prisma\schema.draft.prisma`
- `C:\Project\PSMS_Tech\design-reference\README.md`

## Tech Stack

- Framework: Next.js App Router
- Runtime: React
- Language: TypeScript strict
- Styling: Tailwind CSS
- ORM: Prisma
- Development DB: SQLite
- Production DB: PostgreSQL recommended
- API: Fastify + Zod
- Desktop release target: Electron local app after Web/API MVP gates
- Auth: Credentials-based session or Auth.js family
- Validation: Zod
- Date: date-fns
- Tests: Vitest, React Testing Library, Playwright
- Package manager: pnpm

## Local Ports

- PSMS Web/App: `http://127.0.0.1:5273`
- PSMS API: `http://127.0.0.1:4273`
- Do not use `5173` or `4173`; those ports are reserved by another local project.
- The Web app calls the local Fastify API for auth/session and future domain operations.

## Workspace Layout

- `apps/web`: Next.js App Router UI on port `5273`.
- `apps/api`: Fastify API on port `4273`.
- `apps/desktop`: Electron shell placeholder for the release phase.
- `packages/shared`: shared Zod schemas, result/session types, auth token helpers, format/rule helpers.
- `packages/db`: Prisma schema, migrations, generated client, seed, DB bootstrap.

## Architecture Rules

- Keep the planned workspace structure: `apps/web`, `apps/api`, `apps/desktop`, `packages/shared`, `packages/db`, `test`.
- Frontend uses Server Components for session checks, permission checks, search param parsing, and data fetching.
- Client Components handle drawers, modals, filters, charts, form interaction, wizard steps, and toasts.
- Backend domain ownership lives in `apps/api`.
- Web server actions are thin adapters that call `apps/api`; they must not become the source of business logic.
- Read operations live in API query modules or route handlers.
- Mutations start at API routes.
- Business use cases and transactions live in API services.
- Prisma access lives in API repositories and `packages/db`.
- Repositories must not contain permission checks or business rules.
- Do not create generic CRUD routes without a screen/use-case contract.
- Next.js Route Handlers are only for Web-specific needs; domain APIs belong in `apps/api`.

## Auth And RBAC Rules

- Every workspace page must pass session checks.
- Every API mutation must follow: session check, permission check, Zod validation, business rule validation, transaction when needed, audit log when needed, `ActionResult`.
- Every Web Server Action must validate its input shape, call the API adapter, then update Web cookies/navigation/revalidation only.
- Roles are `ADMIN` and `STAFF`.
- STAFF cannot access staff management, base information, policy management, backup, or restore.
- If STAFF permission is ambiguous, choose the more restrictive behavior.
- Passwords must be hashed.
- Session cookies must follow httpOnly, secure, sameSite principles.
- Spark and mini agents must not modify auth, session, RBAC, password, cookie, or permission guard code.

## DB And Transaction Rules

- Start from `schema.draft.prisma`.
- Development DB is SQLite; production DB should be PostgreSQL.
- Sale creation must handle customer upsert, inventory availability, sale creation, add-ons, inventory status update, receivable creation, schedule creation, and audit log in one transaction.
- Payment registration and cancellation must recalculate receivable balance and status in a transaction.
- Policy activation must validate date/condition conflicts and write audit history.
- Prefer status changes over physical deletion for operational data.
- DB schema, migration, seed strategy, indexes, and transaction behavior require GPT-5.5 review.

## API Contract Rules

- Fastify API routes and Web adapter actions use the documented `ActionResult` shape.
- Web Server Actions are adapter glue only: validate Web input shape, call the API, then update cookies/navigation/revalidation.
- Export APIs must perform permission checks and Audit Log writes.
- Use documented error codes such as `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `POLICY_CONFLICT`.
- Do not change API contracts casually. Escalate to GPT-5.5 architecture review first.

## UI Rules

- The design reference PNGs in `C:\Project\PSMS_Tech\design-reference` are the visual source of truth.
- Each screen must pass its design gate before it is considered complete.
- Preserve the left sidebar plus right workspace structure.
- List filters must sync with URL Search Params.
- Use right-side Drawer for detail views.
- Use Modal or Drawer for simple create/edit.
- Use a dedicated page and stepper for complex sales entry.
- Do not use browser-native `alert` or `confirm`.
- Status must include text, not color alone.
- Spark may create UI skeletons, presentational components, static tables, Tailwind layout, and documentation formatting only.

## Model Use Rules

- GPT-5.5: architecture, auth, DB, API contract, transactions, policy, security, final review.
- Spark: UI skeleton, presentational components, Tailwind layout, static tables, simple docs, mechanical repetitive edits.
- mini: codebase mapping, docs cleanup, report drafting, simple helper/test scaffolding.

Spark is forbidden for auth, DB, Prisma migration, API contract, transactions, RBAC, receivable balance, policy activation, payment logic, export permission, and Audit Log.

## Safety Rules

- Do not damage existing structure or move files without a specific reason.
- Do not modify auth, DB, or API contracts unless the user explicitly requested that change.
- When docs and implementation conflict, report the conflict and follow the safer interpretation.
- Unclear rules involving permissions, money, inventory, payment, receivables, or policy must not be relaxed.
- Every completion report must include changed files, validation, risks, and next steps.
