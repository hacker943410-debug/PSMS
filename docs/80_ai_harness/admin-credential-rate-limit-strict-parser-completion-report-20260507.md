# Admin Credential Rate Limit Strict Parser Completion Report - 2026-05-07

## 1. Summary

- Scope: Admin credential mutation rate-limit persistence hardening.
- Result: Completed.
- Main outcome: `admin-credential-rate-limit` now matches the public credential limiter's strict fail-closed persistence posture, and both limiters reject unexpected top-level persisted fields.
- Final subagent result: Security and QA reviewers approved with no blocking findings.

## 2. Work Decomposition

| Task                                            | Before | After | Change |
| ----------------------------------------------- | -----: | ----: | -----: |
| Admin malformed/tampered state behavior         |    40% |  100% |  +60pp |
| Admin bucket key validation                     |     0% |  100% | +100pp |
| Admin bucket exact-shape validation             |    40% |  100% |  +60pp |
| Admin top-level persisted-state shape guard     |     0% |  100% | +100pp |
| Admin production placeholder/weak secret guard  |    40% |  100% |  +60pp |
| Admin corrupt limiter route smoke               |    70% |  100% |  +30pp |
| Public limiter top-level state shape parity     |     0% |  100% | +100pp |
| Rate-limit parser unit coverage across limiters |    78% |  100% |  +22pp |

## 3. Subagent Delegation

| Subagent | Role / Model                     | Reason                                                                 | Result                                                                        |
| -------- | -------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Noether  | security_reviewer / GPT-5.5 high | Admin credential mutation is auth/security-sensitive.                  | Required fail-closed quarantine, strict key/value/top-level validation.       |
| Sartre   | backend_agent / GPT-5.5 high     | Needed API-compatible backend implementation guidance.                 | Confirmed exports and route behavior should remain stable.                    |
| Mendel   | qa_agent / GPT-5.5 high          | Needed edge-case coverage for signed state parsing and route behavior. | Found valid-MAC unexpected key gap; final QA pass approved after added tests. |

Spark was not used because the work touched `apps/api` auth/rate-limit/secret logic, which is Spark-forbidden by project routing. Mini was not used because the task required security judgment rather than simple mapping.

## 4. Changed Files

| File                                                                                         | Change                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/auth/admin-credential-rate-limit.ts`                                           | Added strict state error handling, signed corrupt-state quarantine, bucket key validation, exact bucket shape validation, top-level shape validation, and weak secret rejection. |
| `apps/api/src/auth/credential-token-rate-limit.ts`                                           | Added matching top-level persisted-state shape validation for public limiter parity.                                                                                             |
| `test/unit/admin-credential-rate-limit.test.ts`                                              | Expanded to 16 tests: malformed JSON, invalid shape, bad MAC, unexpected key with valid MAC, top-level raw fields, bucket extra fields, invalid bucket values, weak secrets.     |
| `test/unit/credential-token-rate-limit.test.ts`                                              | Expanded to 18 tests with public top-level raw-field and valid-MAC unexpected-key coverage.                                                                                      |
| `test/smoke/api-credential-token-inject-smoke.ts`                                            | Added admin corrupt rate-limit file smoke: route returns 429 before token issue/delivery, with Retry-After and audit evidence.                                                   |
| `docs/80_ai_harness/admin-credential-rate-limit-strict-parser-completion-report-20260507.md` | This completion report.                                                                                                                                                          |

## 5. Validation

| Command                                                                                  | Result                         |
| ---------------------------------------------------------------------------------------- | ------------------------------ |
| `codex mcp list`                                                                         | Passed; MCP surface confirmed. |
| `pnpm --filter @psms/api typecheck`                                                      | Passed.                        |
| `pnpm test:unit:admin-credential-rate-limit`                                             | Passed; 16 tests.              |
| `pnpm test:unit:credential-token-rate-limit`                                             | Passed; 18 tests.              |
| `pnpm --filter @psms/api exec tsx ../../test/smoke/api-credential-token-inject-smoke.ts` | Passed.                        |
| `pnpm --filter @psms/api test:inject`                                                    | Passed.                        |
| `pnpm lint`                                                                              | Passed.                        |
| `pnpm db:validate`                                                                       | Passed.                        |
| `git diff --check`                                                                       | Passed.                        |
| `pnpm format:check`                                                                      | Passed.                        |
| `pnpm test`                                                                              | Passed.                        |
| `pnpm build`                                                                             | Passed.                        |

Note: Prisma unique-constraint messages inside the DB contract test are expected because that test asserts those rejections.

## 6. Phase / Task Progress

| Area                                        | Before | After | Change |
| ------------------------------------------- | -----: | ----: | -----: |
| Overall Web/API MVP readiness               |    64% |   65% |   +1pp |
| Phase 1 - UI/design reference gates         |   100% |  100% |    0pp |
| Phase 2 - API/DB/auth foundation            |    99% |   99% |    0pp |
| Phase 3 - Credential token backend/security |    91% |   94% |   +3pp |
| Phase 4 - Token-holder Web UX               |     0% |    0% |    0pp |
| Phase 5 - Electron release readiness        |    10% |   10% |    0pp |

## 7. Auth / DB / API Contract

| Area          | Changed | Note                                                                    |
| ------------- | ------: | ----------------------------------------------------------------------- |
| Auth/security |     Yes | Rate-limit persistence now fails closed on corrupt or suspicious state. |
| DB schema     |      No | No Prisma schema/migration changes.                                     |
| API contract  |      No | Route response shape and exported limiter APIs were preserved.          |
| UI            |      No | No Web UI changes.                                                      |

## 8. Risks / Follow-ups

- Login rate-limit persistence still has older parsing semantics and should receive the same strict parser review in a future slice.
- Operational rollout needs clear guidance: corrupt state blocks credential issue/revoke until the 15-minute window expires or the file is intentionally reset by an operator.
- The package still emits Node `MODULE_TYPELESS_PACKAGE_JSON` warnings in node test runs; it is non-blocking but noisy.

## 9. Next 3-Step Preview

| Step | Owner / Subagent                                          | Detail                                                                                                                    |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | security_reviewer + backend_agent + qa_agent              | Apply strict signed-state parsing parity to `login-rate-limit.ts`, including top-level/bucket extra field tests.          |
| 2    | frontend_agent + security_reviewer + ui_runtime_validator | Build public token-holder verify/complete Web flow for activation and password reset with no-store pages and safe errors. |
| 3    | qa_agent + ui_runtime_validator + visual_ui_reviewer      | Add browser/E2E validation for token-holder UX: invalid, expired, rate-limited, success, and design-density states.       |
