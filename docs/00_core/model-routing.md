# Model Routing

작성일: 2026-05-01

## Principle

PSMS는 휴대폰 매장 운영 시스템이다. 인증, 권한, 금액, 재고, 수납, 정책, 감사 로그의 정합성이 UI 속도보다 중요하다. 판단이 애매하면 더 강한 모델과 더 좁은 변경 범위를 선택한다.

## GPT-5.5

다음 작업은 GPT-5.5 수준의 설계/검토가 필요하다.

- workspace 구조와 Web/API/Desktop 경계 변경
- Fastify API contract, shared Zod schema, `ActionResult` 변경
- auth/session/RBAC/password/cookie
- Prisma schema, migration, seed, index
- 판매 등록 transaction
- 수납 등록/취소와 receivable balance 계산
- 재고 상태 전환과 S/N unique 보장
- 정책 계산, 정책 활성화, 정책 충돌 검증
- Export 권한, Audit Log
- Electron userData DB, preload IPC, renderer isolation
- 보안/개인정보/권한 리뷰
- 릴리즈 전 최종 리뷰

## Codex Spark

Spark는 빠른 UI 반복과 기계적 정리에만 사용한다.

사용 가능:

- `apps/web` presentational component skeleton
- Tailwind class 정리
- 정적 table, empty/loading/error state markup
- 기준 PNG 기반 spacing/color 1차 보정
- demo/dummy data 화면 구성
- 문서 포맷 정리
- 반복 import 정리

사용 금지:

- `apps/api`
- `packages/db`
- `packages/shared`의 auth/session/password/token/rule 파일
- Web auth/session Server Action adapter
- Electron runtime/packaging
- auth/session/RBAC
- Fastify API contract
- Prisma schema/migration/seed
- DB transaction
- 판매/미수금/수납/재고/정책 계산
- Export 권한/Audit Log
- CI, release, secret, env 정책

## Mini

Mini는 작고 위험도가 낮은 보조 작업에 사용한다.

- 코드베이스 구조 매핑
- 문서 요약
- 변경 파일 목록화
- 작업 완료 보고 초안
- 단순 helper/test scaffold
- Playwright screenshot 수집 보조

Mini는 auth, DB, API contract, money/inventory/payment/policy 변경에 사용하지 않는다.

## Codex Code Review

`gpt-5.3-codex` code review profile은 diff 기반 리뷰에 사용한다.

- 큰 구조 변경 이후 회귀 확인
- Web/API contract 연결 오류 확인
- 테스트 누락, build 위험, import/path 오류 확인
- 릴리즈 전 read-only 코드 리뷰

## Priority

1. 보안, DB, 권한, 금액, 재고, 수납, 정책, API contract가 있으면 GPT-5.5
2. route-aware frontend나 API adapter가 있으면 GPT-5.5 frontend 경로
3. 순수 UI markup이면 Spark
4. 스크린샷/콘솔/네트워크 수집이면 UI validation 경로
5. 문서/요약/파일 매핑이면 Mini
6. 릴리즈/Electron이면 GPT-5.5 release 경로

## Spark Escalation

Spark 작업 중 아래 영역이 보이면 즉시 상위 경로로 전환한다.

| 조건                           | 전환 대상                              |
| ------------------------------ | -------------------------------------- |
| auth/session/RBAC 변경         | `security_reviewer`                    |
| DB schema/migration/seed       | `db_reviewer`                          |
| API contract 변경              | `architect_reviewer`                   |
| Fastify route/service 구현     | `backend_agent`                        |
| Web Server Action adapter 변경 | `frontend_agent` + `backend_agent`     |
| 판매/미수금/재고/정책 로직     | `backend_agent` + `architect_reviewer` |
| Electron runtime/packaging     | `desktop_release_agent`                |
| 릴리즈/env/port 정책           | `devops_sre_reviewer`                  |
