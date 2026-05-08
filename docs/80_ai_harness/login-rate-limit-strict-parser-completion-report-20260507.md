# Login Rate Limit Strict Parser Completion Report - 2026-05-07

## 1. Summary

- Scope: Login rate-limit persistence hardening.
- Result: Completed.
- Main outcome: `login-rate-limit` now uses signed persisted state, strict parser validation, file locking, pending reservations, fail-closed corrupt-state quarantine, and production weak-secret rejection.
- Final subagent result: Security and QA reviewers approved with no blocking findings.

## 2. Work Decomposition

| Task                                            | Before | After | Change |
| ----------------------------------------------- | -----: | ----: | -----: |
| Login persisted-state MAC                       |     0% |  100% | +100pp |
| Malformed/tampered state fail-closed quarantine |    35% |  100% |  +65pp |
| Strict top-level state shape validation         |     0% |  100% | +100pp |
| Strict bucket key and exact bucket validation   |     0% |  100% | +100pp |
| Pending reservation race guard                  |     0% |  100% | +100pp |
| Production placeholder/weak secret guard        |    40% |  100% |  +60pp |
| Corrupt login limiter route smoke               |     0% |  100% | +100pp |
| API smoke rate-limit file isolation             |    60% |  100% |  +40pp |
| Login limiter unit edge coverage                |    35% |  100% |  +65pp |

## 3. Subagent Delegation

| Subagent | Role / Model                     | Reason                                                    | Result                                                                 |
| -------- | -------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Noether  | security_reviewer / GPT-5.5 high | Login auth/rate-limit persistence is security-sensitive.  | Required signed state, fail-closed quarantine, strict parser checks.   |
| Sartre   | backend_agent / GPT-5.5 high     | Needed API-compatible backend implementation guidance.    | Confirmed exported limiter APIs and route response contract to keep.   |
| Mendel   | qa_agent / GPT-5.5 high          | Needed regression matrix for tampered state and 429 flow. | Requested array/null/missing/non-integer value coverage; final passed. |

Spark was not used because the work touched auth, secret, and rate-limit logic, which is Spark-forbidden by project routing. Mini was not used because the slice required security-sensitive judgment and fail-closed behavior review.

## 4. Changed Files

| File                                                                              | Change                                                                                                                      |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/auth/login-rate-limit.ts`                                           | Added signed state MAC, strict parser, corrupt sentinel quarantine, file lock, pending reservations, weak-secret rejection. |
| `test/unit/login-rate-limit.test.ts`                                              | Expanded login limiter coverage to 22 tests, including MAC, bad state, bad MAC, invalid keys/fields/values, weak secrets.   |
| `test/smoke/api-auth-inject-smoke.ts`                                             | Added corrupt-state `/auth/login` 429 smoke with no session, no cookie, no password/loginId/IP leak, and audit evidence.    |
| `test/smoke/api-admin-guard-inject-smoke.ts`                                      | Isolated login rate-limit file per smoke run.                                                                               |
| `test/smoke/api-admin-read-inject-smoke.ts`                                       | Isolated login rate-limit file per smoke run.                                                                               |
| `test/smoke/api-admin-staff-mutation-inject-smoke.ts`                             | Isolated login rate-limit file per smoke run.                                                                               |
| `docs/80_ai_harness/login-rate-limit-strict-parser-completion-report-20260507.md` | This completion report.                                                                                                     |

## 5. Validation

| Command                               | Result                         |
| ------------------------------------- | ------------------------------ |
| `codex mcp list`                      | Passed; MCP surface confirmed. |
| `pnpm --filter @psms/api typecheck`   | Passed.                        |
| `pnpm test:unit:login-rate-limit`     | Passed; 22 tests.              |
| `pnpm --filter @psms/api test:inject` | Passed.                        |
| `pnpm db:validate`                    | Passed.                        |
| `git diff --check`                    | Passed.                        |
| `pnpm format:check`                   | Passed.                        |
| `pnpm lint`                           | Passed.                        |
| `pnpm test`                           | Passed.                        |
| `pnpm build`                          | Passed.                        |

Note: Prisma unique-constraint messages inside the DB contract test are expected because that test asserts those rejections.

## 6. Phase / Task Progress

| Area                                        | Before | After | Change |
| ------------------------------------------- | -----: | ----: | -----: |
| Overall Web/API MVP readiness               |    65% |   66% |   +1pp |
| Phase 1 - UI/design reference gates         |   100% |  100% |    0pp |
| Phase 2 - API/DB/auth foundation            |    99% |  100% |   +1pp |
| Phase 3 - Credential token backend/security |    94% |   94% |    0pp |
| Phase 4 - Token-holder Web UX               |     0% |    0% |    0pp |
| Phase 5 - Electron release readiness        |    10% |   10% |    0pp |

## 7. Auth / DB / API Contract

| Area          | Changed | Note                                                                                |
| ------------- | ------: | ----------------------------------------------------------------------------------- |
| Auth/security |     Yes | Login limiter persistence now fails closed on corrupt, legacy, or suspicious state. |
| DB schema     |      No | No Prisma schema/migration changes.                                                 |
| API contract  |      No | `/auth/login` still returns the existing `RATE_LIMITED` shape and `Retry-After`.    |
| UI            |      No | No Web UI changes.                                                                  |

## 8. Risks / Follow-ups

- Existing unsigned `login-rate-limit.json` files now fail closed. Operators should remove/reset only the intended runtime limiter file if a legacy state blocks login.
- Local smoke tests now isolate login limiter state; this prevents default runtime state from leaking across scripts.
- Node still emits `MODULE_TYPELESS_PACKAGE_JSON` warnings in node test runs. It is noisy but non-blocking.

## 9. Next 3-Step Preview

| Step | Owner / Subagent                                          | Detail                                                                                                                    |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | frontend_agent + security_reviewer + ui_runtime_validator | Build public token-holder verify/complete Web flow for activation and password reset with no-store pages and safe errors. |
| 2    | backend_agent + qa_agent + security_reviewer              | Add operational docs and API smoke cases for credential token delivery/retry failure paths and limiter reset guidance.    |
| 3    | qa_agent + ui_runtime_validator + visual_ui_reviewer      | Add browser/E2E validation for token-holder UX: invalid, expired, rate-limited, success, and design-density states.       |
