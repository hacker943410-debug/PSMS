# Public Credential Rate Limit Alignment Completion Report - 2026-05-07

## 1. Summary

- Scope: Public credential token verify/complete rate-limit hardening.
- Result: Completed.
- Main outcome: Public credential-token limiter now uses file locking, signed persisted state, pending reservations, success reservation release, fail-closed corrupt-state quarantine, strict bucket parsing, and production weak-secret rejection.
- Final reviewer result: Security reviewer approved the latest limiter and unit tests with no blocking findings.

## 2. Work Decomposition

| Task                                     | Before | After | Change |
| ---------------------------------------- | -----: | ----: | -----: |
| Parallel check-before-record protection  |     0% |  100% | +100pp |
| Corrupt/tampered persistence handling    |    40% |  100% |  +60pp |
| Raw token/IP persistence guard           |    70% |  100% |  +30pp |
| Successful request pending release       |     0% |  100% | +100pp |
| Production placeholder/weak secret guard |    40% |  100% |  +60pp |
| Unit coverage for limiter edge cases     |    45% |  100% |  +55pp |
| API smoke coverage for pre-service 429   |    45% |   95% |  +50pp |

## 3. Subagent Delegation

| Subagent  | Role / Model                     | Reason                                                  | Result                                                                                                                       |
| --------- | -------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Noether   | security_reviewer / GPT-5.5 high | Public auth/rate-limit security requires strict review. | Identified parallel check-before-record and tamper recovery risks.                                                           |
| Sartre    | backend_agent / GPT-5.5 high     | Backend limiter design and API compatibility review.    | Recommended pending reservation while preserving exported API shape.                                                         |
| Helmholtz | qa_agent / GPT-5.5 high          | QA coverage and smoke evidence review.                  | Requested valid-token pre-service 429 proof and weak-secret tests.                                                           |
| Halley    | security_reviewer / GPT-5.5 high | Final security review after implementation.             | Found and drove fixes for fail-open corrupt state, invalid bucket entry, and extra raw field injection; final pass approved. |

Spark was not used because auth, token, secret, and rate-limit logic are Spark-forbidden in the project model rules. Mini was not used because the slice required security-sensitive reasoning rather than simple mapping or docs-only edits.

## 4. Changed Files

| File                                                                                      | Change                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/auth/credential-token-rate-limit.ts`                                        | Added pending reservation, success release, strict signed state parsing, corrupt-state quarantine, file lock protection, placeholder/weak production secret rejection.                                       |
| `apps/api/src/routes/credential-token.routes.ts`                                          | Releases pending reservation on successful verify/complete; failed requests still convert reservation into failure counters.                                                                                 |
| `test/unit/credential-token-rate-limit.test.ts`                                           | Added 17 edge tests covering persistence secrecy, pending reservation, success release, fail-closed malformed/tampered state, invalid bucket/key/extra-field injection, window reset, and production guards. |
| `test/smoke/api-credential-token-inject-smoke.ts`                                         | Added public 429 route evidence, concurrent invalid request pressure, and valid-token complete pre-service DB/session/audit immutability proof.                                                              |
| `docs/80_ai_harness/public-credential-rate-limit-alignment-completion-report-20260507.md` | This completion report.                                                                                                                                                                                      |

## 5. Validation

| Command                                                                                  | Result                         |
| ---------------------------------------------------------------------------------------- | ------------------------------ |
| `codex mcp list`                                                                         | Passed; MCP surface confirmed. |
| `pnpm --filter @psms/api typecheck`                                                      | Passed.                        |
| `pnpm test:unit:credential-token-rate-limit`                                             | Passed; 17 tests.              |
| `pnpm --filter @psms/api exec tsx ../../test/smoke/api-credential-token-inject-smoke.ts` | Passed.                        |
| `pnpm --filter @psms/api test:inject`                                                    | Passed.                        |
| `pnpm lint`                                                                              | Passed.                        |
| `pnpm db:validate`                                                                       | Passed.                        |
| `git diff --check`                                                                       | Passed.                        |
| `pnpm test`                                                                              | Passed.                        |
| `pnpm build`                                                                             | Passed.                        |
| `pnpm format:check`                                                                      | Passed.                        |

Note: Prisma unique-constraint messages are expected inside the DB contract test because the test asserts those rejections.

## 6. Phase / Task Progress

| Area                                        | Before | After | Change |
| ------------------------------------------- | -----: | ----: | -----: |
| Overall Web/API MVP readiness               |    62% |   64% |   +2pp |
| Phase 1 - UI/design reference gates         |   100% |  100% |    0pp |
| Phase 2 - API/DB/auth foundation            |    98% |   99% |   +1pp |
| Phase 3 - Credential token backend/security |    84% |   91% |   +7pp |
| Phase 4 - Token-holder Web UX               |     0% |    0% |    0pp |
| Phase 5 - Electron release readiness        |    10% |   10% |    0pp |

## 7. Risks / Follow-ups

- Admin credential mutation limiter still has older malformed/tampered recovery semantics in its existing tests. It should receive the same strict fail-closed parser treatment in a separate security slice.
- Public credential Web pages are still not implemented; current work is API/backend hardening.
- Production deployment still needs operational decisions for rate-limit file location, secret provisioning, backup, and observability.

## 8. Next 3-Step Preview

| Step | Owner / Subagent                                          | Detail                                                                                                                                    |
| ---- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | backend_agent + security_reviewer                         | Apply strict fail-closed signed-state parsing parity to `admin-credential-rate-limit.ts`, including invalid bucket key/extra field tests. |
| 2    | frontend_agent + security_reviewer + ui_runtime_validator | Build token-holder verify/complete Web flow for activation and password reset, using no-store public pages and no secret leakage.         |
| 3    | qa_agent + ui_runtime_validator + visual_ui_reviewer      | Add browser/E2E validation for credential token UX, including expired/invalid/rate-limited states and design-density checks.              |
