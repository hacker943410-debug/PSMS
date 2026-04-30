# Model Routing

## 기본 원칙

PSMS는 인증, DB transaction, 수납/재고/정책 정합성이 중요한 업무 시스템이다. 모델 라우팅은 속도보다 구조 보존과 데이터 정합성을 우선한다.

판단이 애매하면 GPT-5.5를 사용한다.

## GPT-5.5 사용 기준

다음 작업은 GPT-5.5를 사용한다.

- 시스템 아키텍처 결정
- 인증, 세션, RBAC
- Prisma schema, migration, seed 전략
- 판매 등록 transaction
- 수납 등록/취소 및 미수금 잔액 재계산
- 재고 상태 전환과 중복 판매 방지
- 정책 활성화, 정책 충돌 검증
- API contract 및 `ActionResult` 변경
- Export 권한, Audit Log
- 보안/개인정보/권한 리뷰
- 최종 통합 리뷰

## Spark 사용 기준

Spark는 빠른 UI/단순 작업 전용이다.

사용 가능:

- WorkspaceShell, Sidebar, PageIntro 등 presentational UI 초안
- Tailwind class 정리
- 정적 table, empty/loading/error state 마크업
- 디자인 reference 기반 spacing/color 보정
- 문서 포맷 정리
- 반복적인 import 정리
- 낮은 위험의 story/demo/dummy data 작성

사용 금지:

- auth/session/RBAC
- password hash/cookie
- Prisma schema/migration/seed
- DB transaction
- Server Action contract
- 수납/미수금 계산
- 재고 중복 판매 방지
- 정책 계산/활성화
- Export 권한/Audit Log
- 배포, CI, secret, env 정책

## mini 사용 기준

mini는 작고 낮은 위험의 보조 작업에 사용한다.

- 코드베이스 구조 매핑
- 문서 요약
- 변경 파일 목록화
- 작업 완료 보고 초안
- 단순 helper/test scaffold

mini도 auth, DB, API contract 변경에는 사용하지 않는다.

## 라우팅 우선순위

1. 보안/돈/DB/권한이 있으면 GPT-5.5
2. route-aware frontend나 URL Search Params 흐름이 있으면 GPT-5.5 frontend
3. 순수 UI 마크업만 있으면 Spark
4. 문서/작은 보조 작업이면 mini
5. 판단이 애매하면 GPT-5.5

## Spark Escalation

Spark 작업 중 아래 영역이 보이면 즉시 중단하고 상위 agent로 전환한다.

| 조건                       | Escalation 대상                        |
| -------------------------- | -------------------------------------- |
| 인증/권한 변경             | `security_reviewer`                    |
| DB schema/migration/seed   | `db_reviewer`                          |
| API contract 변경          | `architect_reviewer`                   |
| Server Action 변경         | `backend_agent`                        |
| 수납/미수금/재고/정책 로직 | `backend_agent` + `architect_reviewer` |
| 보안 민감 파일             | `security_reviewer`                    |
