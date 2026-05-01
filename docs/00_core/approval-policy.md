# Approval Policy

작성일: 2026-05-01

## AI 단독 가능

| 작업                               | 승인 필요 |
| ---------------------------------- | --------: |
| 문서 초안 작성                     |    아니오 |
| 문서 포맷 정리                     |    아니오 |
| 화면 skeleton 작성                 |    아니오 |
| 순수 presentational component 작성 |    아니오 |
| 작은 Tailwind 레이아웃 조정        |    상황별 |
| 테스트 케이스 초안 작성            |    아니오 |
| 보고서 정리                        |    아니오 |

## 사용자 확인 또는 상위 리뷰 필요

| 작업                            | 필요 조치                          | 필수 산출물                 |
| ------------------------------- | ---------------------------------- | --------------------------- |
| 인증/권한 로직 변경             | 사용자 확인 + `security_reviewer`  | Security review             |
| DB schema/migration 변경        | 사용자 확인 + `db_reviewer`        | Migration/rollback note     |
| Fastify API contract 변경       | 사용자 확인 + `architect_reviewer` | API contract note           |
| 판매/수납/재고 transaction 변경 | GPT-5.5 review                     | Test plan                   |
| 정책 계산/활성화 변경           | GPT-5.5 review                     | Conflict validation note    |
| Export 권한/Audit Log 변경      | GPT-5.5 review                     | Permission/audit note       |
| Electron runtime/packaging 변경 | GPT-5.5 review                     | Release/smoke checklist     |
| 배포/CI/secret/env 정책 변경    | 사용자 확인                        | Operation note              |
| 디자인 기준 PNG 변경            | 사용자 확인                        | Design reference change log |

## 금지 기본값

사용자가 명시적으로 요청하지 않는 한 다음은 변경하지 않는다.

- 인증 방식
- DB provider와 schema
- Fastify API contract
- `ActionResult` 공통 응답 형식
- RBAC 정책
- 운영 데이터 삭제 정책
- Web `5273`, API `4273` 포트 정책
- Electron renderer 보안 정책

## Spark 제한

Spark는 UI/단순 작업에만 사용한다.

Spark가 다음 파일 또는 영역을 수정해야 하는 상황이면 즉시 중단한다.

- `apps/api`
- `packages/db`
- `packages/shared`의 auth/session/password/token/rule 파일
- `apps/web/src/server/actions/auth.actions.ts`
- `apps/web/src/lib/auth`
- `apps/web/src/lib/api-client.ts`의 API contract 변경
- `apps/desktop`
- auth/session/RBAC
- Fastify API contract
- payment/receivable/sale transaction
- policy calculation
- Audit Log
- export permission
- release/env/port 정책
