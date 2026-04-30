# AGENTS.md

## Project Overview

PSMS is a desktop-first phone shop operations console. It will manage sales, receivables, customers, schedules, inventory, staff, base information, policies, reports, export, and audit logs.

The implementation project is currently in an early bootstrap state. The authoritative rebuild documentation is stored at `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs`.

## Must Read First

Before any substantive work, read the relevant local project state and harness rules:

1. `docs/00_system/project-current-state.md`
2. `docs/00_core/orchestrator-rules.md`
3. `docs/00_core/model-routing.md`
4. `docs/00_core/approval-policy.md`
5. `docs/10_agents/agent-map.md`
6. `docs/20_execution/task-execution-rule.md`
7. `docs/20_execution/task-report-format.md`

For architecture, auth, DB, API, and domain work, also check:

- `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs\README.md`
- `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs\docs\02_INFORMATION_ARCHITECTURE_ROUTES_RBAC.md`
- `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs\docs\06_BACKEND_ARCHITECTURE.md`
- `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs\docs\07_DOMAIN_MODEL_DATABASE_SPEC.md`
- `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs\docs\08_SERVER_ACTIONS_AND_API_CONTRACTS.md`
- `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs\prisma\schema.draft.prisma`

## Tech Stack

- Framework: Next.js App Router
- Runtime: React
- Language: TypeScript strict
- Styling: Tailwind CSS
- ORM: Prisma
- Development DB: SQLite
- Production DB: PostgreSQL recommended
- Auth: Credentials-based session or Auth.js family
- Validation: Zod
- Date: date-fns
- Tests: Vitest, React Testing Library, Playwright
- Package manager: pnpm

## Architecture Rules

- Keep the planned structure: `src/app`, `src/components`, `src/server`, `src/lib`, `src/types`, `test`.
- Frontend uses Server Components for session checks, permission checks, search param parsing, and data fetching.
- Client Components handle drawers, modals, filters, charts, form interaction, wizard steps, and toasts.
- Backend is the Next.js server area acting as BFF.
- Read operations live in `server/queries`.
- Mutations start in `server/actions`.
- Business use cases and transactions live in `server/services`.
- Prisma access lives in `server/repositories`.
- Repositories must not contain permission checks or business rules.
- Do not create generic REST CRUD under `/api`.
- Route Handlers are only for export, file download, external webhook, or cases that Server Actions cannot handle.

## Auth And RBAC Rules

- Every workspace page must pass session checks.
- Every Server Action must follow: session check, permission check, Zod validation, business rule validation, transaction when needed, audit log when needed, revalidate, `ActionResult`.
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

- Server Actions return the documented `ActionResult` shape.
- Export APIs must perform permission checks and Audit Log writes.
- Use documented error codes such as `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `POLICY_CONFLICT`.
- Do not change API contracts casually. Escalate to GPT-5.5 architecture review first.

## UI Rules

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
