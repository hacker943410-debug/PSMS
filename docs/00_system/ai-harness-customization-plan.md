# AI Harness Customization Plan

작성일: 2026-04-30

## 0. 목적

이 문서는 `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs`의 기술문서와 `docs/00_system/project-current-state.md`를 기반으로, 현재 `C:\Projects\Active\PSMS` 프로젝트에 AI 하네스 설정을 안전하게 적용하기 위한 계획 보고서다.

핵심 원칙은 다음과 같다.

- 기존 프로젝트 구조를 깨지 않는다.
- 인증, DB, API contract는 보수적으로 유지한다.
- Spark는 UI, 문서, 단순 반복 작업에만 제한한다.
- 필요 없는 subagent는 제거하고, 실제 사용할 agent만 남긴다.
- 현재 프로젝트는 초기화 전 상태이므로 하네스는 "미래 구현을 통제하는 규칙"으로 먼저 적용한다.

## 1. 현재 프로젝트 구조 분석 요약

### 1.1 현재 파일 구조

현재 실제 작업 디렉터리는 `C:\Projects\Active\PSMS`이며, 애플리케이션 코드는 아직 없다.

```txt
C:\Projects\Active\PSMS
└─ docs
   └─ 00_system
      ├─ project-current-state.md
      └─ ai-harness-customization-plan.md
```

참고 기술문서는 별도 경로에 있다.

```txt
C:\Projects\PSMS_Tech\phoneshop_rebuild_docs
├─ README.md
├─ PHONESHOP_REBUILD_MASTER_SPEC.md
├─ docs
├─ prisma
│  └─ schema.draft.prisma
├─ prompts
├─ source
└─ design-reference
```

### 1.2 시스템 구조

| 영역     | 문서 기준 구조                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS. Server Component 중심 조회, Client Component 중심 상호작용   |
| Backend  | Next.js 서버 영역을 BFF로 사용. `server/queries`, `server/actions`, `server/services`, `server/repositories` 계층 |
| DB       | Prisma ORM. 개발 SQLite, 운영 PostgreSQL 권장                                                                     |

계획된 애플리케이션 구조는 다음과 같다.

```txt
src
├─ app
│  ├─ (auth)
│  └─ (workspace)
├─ components
├─ server
│  ├─ actions
│  ├─ queries
│  ├─ services
│  └─ repositories
├─ lib
├─ types
└─ test
```

### 1.3 인증 방식

문서 기준 인증은 Credentials 기반 세션 또는 Auth.js 계열이다.

- `User.email`, `User.passwordHash`, `User.role`, `User.status`, `User.storeId` 사용
- `ADMIN`, `STAFF` 2단계 RBAC
- 미인증 사용자는 `/login`으로 redirect
- STAFF는 직원 관리, 기초정보, 정책 관리, 백업/복원 접근 불가
- 세션 쿠키는 `httpOnly`, `secure`, `sameSite` 원칙 유지
- 서버 액션은 반드시 session 확인, 권한 확인, Zod 검증 후 실행

### 1.4 API 구조

문서 기준 CRUD는 REST API가 아니라 Server Action 중심이다.

| 유형          | 기준                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| 조회          | `server/queries`에서 페이지 단위 데이터 구성                              |
| 변경          | `server/actions`에서 세션, 권한, 입력 검증, service 호출, revalidate 수행 |
| 도메인 처리   | `server/services`에서 transaction 및 비즈니스 규칙 처리                   |
| DB 접근       | `server/repositories`에서 Prisma 접근만 담당                              |
| Route Handler | Export, 파일 다운로드, 외부 webhook 등 예외 용도                          |

공통 응답 계약은 `ActionResult`다.

```ts
export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string; redirectTo?: string }
  | {
      ok: false;
      code?: string;
      message: string;
      fieldErrors?: Record<string, string>;
    };
```

### 1.5 주요 기능 상태

현재 실제 구현된 기능은 없다. 문서상 구현 대상은 다음과 같다.

| 기능                          | 상태   |
| ----------------------------- | ------ |
| 프로젝트 초기화               | 미구현 |
| 로그인/RBAC                   | 미구현 |
| Workspace Shell/Sidebar       | 미구현 |
| 대시보드                      | 미구현 |
| 판매 관리/판매 등록 Wizard    | 미구현 |
| 미수금/수납/취소              | 미구현 |
| 고객/상담 메모                | 미구현 |
| 일정/공휴일 규칙              | 미구현 |
| 재고/SN unique/Model No. 포맷 | 미구현 |
| 직원/기초정보/정책            | 미구현 |
| Export/Audit Log              | 미구현 |
| 테스트/배포                   | 미구현 |

## 2. 하네스 적용 시 충돌 가능성 분석

### 2.1 기존 구조 vs 하네스 규칙 충돌 포인트

| 충돌 포인트   | 기존 문서 기준                           | 하네스에서 제한할 규칙                          |
| ------------- | ---------------------------------------- | ----------------------------------------------- |
| API 생성 방식 | Server Action 중심, Route Handler는 예외 | agent가 임의 REST CRUD API를 만들지 못하게 금지 |
| 인증          | Credentials/Auth.js 계열, RBAC 보수적    | auth 변경은 GPT-5.5 검토 필수, Spark 금지       |
| DB            | Prisma schema 초안 기반                  | DB schema 변경은 DB agent + GPT-5.5 검토 필수   |
| 트랜잭션      | 판매/수납/정책은 transaction 필수        | service 계층 우회 금지                          |
| Repository    | Prisma 접근만 담당                       | repository에 권한/비즈니스 로직 삽입 금지       |
| STAFF 권한    | 일부 범위가 "제한 가능"으로 남음         | 불명확한 권한은 더 보수적인 쪽으로 적용         |
| Export        | 권한 확인과 Audit Log 필수               | 단순 다운로드 API로 구현 금지                   |
| UI 상태       | URL Search Params 기반 필터              | 로컬 상태만으로 필터 보존 금지                  |
| 삭제 정책     | 운영 데이터 물리 삭제 지양               | hard delete 구현 금지                           |

### 2.2 위험 요소

#### Auth

- STAFF 권한 범위가 일부 미정이다.
- 판매 취소, 수납 취소, Export 범위는 보수적으로 ADMIN 또는 소속 매장 제한을 기본값으로 둬야 한다.
- 로그인/세션 구현을 빠르게 처리하려고 임시 토큰, localStorage 세션, 평문 비밀번호를 쓰면 안 된다.

대응:

- auth 작업은 `auth-security-agent`가 담당한다.
- Spark는 로그인 UI의 정적 마크업까지만 가능하다.
- 세션, 쿠키, password hash, RBAC guard는 GPT-5.5 검토 후 적용한다.

#### DB

- 개발 SQLite와 운영 PostgreSQL 간 동시성 차이가 있다.
- 판매 등록 시 재고 중복 판매 방지가 transaction에 의존한다.
- 정책을 `ruleJson`으로 시작하면 충돌 검증과 테스트가 느슨해질 수 있다.

대응:

- Prisma schema 변경은 `db-prisma-agent`만 담당한다.
- 판매, 수납, 정책 transaction은 `backend-domain-agent`와 함께 설계한다.
- 운영 전 PostgreSQL 기준 migration/transaction 검증을 별도 단계로 둔다.

#### API Contract

- 문서 기준은 Server Action 중심인데, 일반 REST CRUD 생성 agent가 `/api/*`를 남발할 수 있다.
- `ActionResult` 형식이 깨지면 UI, validation, error handling 일관성이 무너진다.
- Export API는 예외적으로 Route Handler를 쓰지만 권한/Audit Log가 반드시 필요하다.

대응:

- `server/actions`의 모든 변경은 `ActionResult` 준수.
- Export 외 일반 CRUD Route Handler 생성 금지.
- API contract 변경은 GPT-5.5 승인 대상.

## 3. 하네스 커스터마이징 결과

이 섹션은 최종 적용할 파일의 수정본 제안이다.

### 3.1 AGENTS.md 수정본

적용 위치: `C:\Projects\Active\PSMS\AGENTS.md`

```md
# AGENTS.md

## Project Overview

PSMS는 휴대폰 매장 운영 콘솔이다. 판매, 미수금, 고객, 일정, 재고, 직원, 기초정보, 정책 관리를 하나의 데스크톱 우선 업무 화면에서 제공한다.

현재 구현 프로젝트는 초기화 전 상태이며, 기준 문서는 `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs`에 있다.

## Authoritative Docs

작업 전 다음 문서를 우선 확인한다.

- `docs/00_system/project-current-state.md`
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
- Dev DB: SQLite
- Production DB: PostgreSQL 권장
- Auth: Credentials 기반 세션 또는 Auth.js 계열
- Validation: Zod
- Tests: Vitest, React Testing Library, Playwright
- Package Manager: pnpm

## Architecture Rules

- Frontend는 Server Component 중심 조회와 Client Component 중심 상호작용으로 분리한다.
- Backend는 Next.js 서버 영역을 BFF로 사용한다.
- 조회는 `server/queries`에 둔다.
- 변경 작업은 `server/actions`에서 시작한다.
- 비즈니스 유스케이스와 transaction은 `server/services`에 둔다.
- Prisma 접근은 `server/repositories`로 제한한다.
- Repository에는 권한 판단과 비즈니스 로직을 넣지 않는다.
- 일반 CRUD를 위해 `/api/*` Route Handler를 만들지 않는다.
- Route Handler는 Export, 파일 다운로드, 외부 webhook 등 예외 상황에만 사용한다.

## Auth and RBAC Rules

- 모든 workspace page는 session 확인을 거친다.
- 모든 server action은 session 확인, 권한 확인, Zod 검증, service 호출 순서를 지킨다.
- ADMIN은 전체 메뉴 접근 가능하다.
- STAFF는 직원 관리, 기초정보, 정책 관리, 백업/복원 접근이 불가하다.
- STAFF 권한이 애매한 기능은 더 보수적인 권한으로 처리한다.
- password는 반드시 hash로 저장한다.
- session cookie는 httpOnly, secure, sameSite 원칙을 따른다.
- Spark는 auth, session, RBAC, password, cookie 구현을 수정할 수 없다.

## DB and Transaction Rules

- Prisma schema는 `schema.draft.prisma`를 기준으로 출발한다.
- 판매 등록은 customer upsert, inventory check, sale create, add-ons create, inventory update, receivable create, schedule create, audit log를 하나의 transaction으로 처리한다.
- 수납 등록/취소는 receivable balance와 status를 transaction 안에서 재계산한다.
- 정책 활성화는 기간/조건 충돌을 검증하고 Audit Log를 남긴다.
- 운영 데이터는 물리 삭제보다 상태 변경을 우선한다.
- DB schema, migration, transaction 변경은 GPT-5.5 검토 대상이다.

## API Contract Rules

- Server Action은 공통 `ActionResult`를 반환한다.
- Export API는 권한 확인과 Audit Log를 반드시 수행한다.
- Error code는 문서의 `AUTH_REQUIRED`, `FORBIDDEN`, `VALIDATION_FAILED`, `POLICY_CONFLICT` 등과 맞춘다.
- API contract 변경은 사전 설계 없이 진행하지 않는다.

## UI Rules

- 좌측 sidebar + 우측 workspace 구조를 유지한다.
- 목록 필터는 URL Search Params와 동기화한다.
- 상세는 우측 Drawer를 우선한다.
- 단순 등록/수정은 Modal 또는 Drawer를 사용한다.
- 판매 등록처럼 복잡한 흐름은 별도 page와 stepper를 사용한다.
- 브라우저 기본 alert/confirm은 사용하지 않는다.
- 상태는 색상만으로 표현하지 않고 텍스트/칩을 함께 사용한다.

## Model Use Rules

- GPT-5.5: architecture, auth, DB, API contract, transaction, policy, final review
- Spark: UI presentational components, Tailwind layout, static tables, simple docs, mechanical repetitive edits
- mini: 문서 정리, 단순 타입/formatter, 작은 테스트 보강, 낮은 위험의 리팩터

Spark는 auth, DB, Prisma migration, API contract, transaction, RBAC, payment, receivable balance, policy activation 작업에 사용하지 않는다.

## Safety Rules

- 기존 구조를 깨는 대규모 재배치는 금지한다.
- 문서와 구현이 충돌하면 먼저 보고하고 보수적인 쪽을 따른다.
- 불명확한 권한/돈/재고/수납 규칙은 임의로 완화하지 않는다.
- 변경 후 관련 테스트 또는 최소 검증 명령을 실행한다.
```

### 3.2 model-routing.md 수정본

적용 위치: `C:\Projects\Active\PSMS\docs\00_system\model-routing.md`

```md
# Model Routing

## 기본 원칙

PSMS는 인증, DB transaction, 수납/재고/정책 정합성이 중요한 업무 시스템이다. 모델 라우팅은 속도보다 구조 보존과 데이터 정합성을 우선한다.

## GPT-5.5 사용 기준

다음 작업은 GPT-5.5를 사용한다.

- 시스템 아키텍처 결정
- 인증, 세션, RBAC
- Prisma schema, migration, seed 전략
- 판매 등록 transaction
- 수납 등록/취소 및 미수금 잔액 재계산
- 정책 활성화, 정책 충돌 검증
- API contract 및 `ActionResult` 변경
- Export 권한, Audit Log
- 보안/권한 리뷰
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
- Prisma schema/migration
- DB transaction
- Server Action contract
- 수납/미수금 계산
- 재고 중복 판매 방지
- 정책 계산/활성화
- Export 권한/Audit Log

## mini 사용 기준

mini는 작고 낮은 위험의 보조 작업에 사용한다.

- 문서 요약
- 단순 타입 정리
- formatter/helper 함수 초안
- 테스트 케이스 목록화
- 파일 목록/변경 요약 작성

mini도 auth, DB, API contract 변경에는 사용하지 않는다.

## 라우팅 우선순위

1. 보안/돈/DB/권한이 있으면 GPT-5.5
2. UI 마크업만 있으면 Spark
3. 문서/작은 보조 작업이면 mini
4. 판단이 애매하면 GPT-5.5
```

### 3.3 agent-map.md

적용 위치: `C:\Projects\Active\PSMS\docs\00_system\agent-map.md`

```md
# Agent Map

## 사용할 subagent

| Agent                      | Model   | 책임 범위                                          | 사용 조건                           |
| -------------------------- | ------- | -------------------------------------------------- | ----------------------------------- |
| `architecture-agent`       | GPT-5.5 | 구조 결정, 문서-구현 정합성, 작업 분해             | 기능 시작 전 설계 또는 충돌 판단    |
| `auth-security-agent`      | GPT-5.5 | 로그인, 세션, RBAC, 권한 차단, 보안 검토           | auth/session/role 관련 변경         |
| `db-prisma-agent`          | GPT-5.5 | Prisma schema, migration, seed, index, DB 정합성   | DB model 또는 migration 변경        |
| `backend-domain-agent`     | GPT-5.5 | Server Action, service, transaction, business rule | 판매/수납/정책/재고 도메인 변경     |
| `frontend-workspace-agent` | Spark   | workspace UI, 공통 컴포넌트, 화면 마크업           | auth/DB/API를 건드리지 않는 UI 작업 |
| `qa-agent`                 | GPT-5.5 | 테스트 전략, e2e 흐름, 회귀 위험 검토              | 기능 완료 전 검증                   |
| `docs-agent`               | mini    | 문서 정리, 변경 요약, 작업 완료 보고               | 구현 결과 문서화                    |

## 사용하지 않을 subagent

아래 agent는 현재 PSMS MVP 범위와 맞지 않으므로 제거한다.

- mobile-agent: 모바일 전용 UX는 초기 MVP 제외
- payment-gateway-agent: PG 실시간 결제 연동은 초기 MVP 제외
- external-carrier-api-agent: 외부 통신사 API 실시간 연동은 초기 MVP 제외
- notification-agent: 문자/알림톡 실제 발송은 초기 MVP 제외
- accounting-agent: 복잡한 회계 시스템 연동은 초기 MVP 제외
- ml-agent: 추천/예측/ML 기능은 현재 범위 아님
- infra-scale-agent: 초기에는 Next.js + DB 중심 배포만 다룸

## Agent 경계

- `frontend-workspace-agent`는 `server`, `prisma`, auth 관련 파일을 수정하지 않는다.
- `db-prisma-agent`는 UI 컴포넌트를 수정하지 않는다.
- `auth-security-agent`는 UI 마크업보다 guard, session, role check를 우선한다.
- `backend-domain-agent`는 repository에 비즈니스 로직을 넣지 않는다.
- `docs-agent`는 구현 파일을 수정하지 않는다.
```

### 3.4 task-execution-rule.md

적용 위치: `C:\Projects\Active\PSMS\docs\00_system\task-execution-rule.md`

```md
# Task Execution Rule

## 기본 실행 흐름

1. 작업 요청을 기능, 위험도, 영향 범위로 분류한다.
2. 관련 기준 문서를 확인한다.
3. 작업을 독립 가능한 단위로 분해한다.
4. 위험도가 높은 영역은 GPT-5.5 agent에 배정한다.
5. UI/반복/문서성 작업만 Spark 또는 mini에 배정한다.
6. 병렬 작업은 파일 소유 범위가 겹치지 않을 때만 진행한다.
7. 통합 후 테스트 또는 최소 검증을 실행한다.
8. 변경 파일, 검증 결과, 남은 위험을 보고한다.

## 자동 subagent 위임 기준

다음 조건이면 subagent 위임을 자동 고려한다.

- 작업이 2개 이상의 독립 영역으로 나뉜다.
- UI와 backend가 분리되어 병렬 진행 가능하다.
- DB schema 검토와 화면 구현이 동시에 필요하다.
- 문서 정리와 구현 검증을 분리할 수 있다.

단, 다음 작업은 단일 GPT-5.5 경로로 먼저 설계한다.

- auth/session/RBAC
- Prisma migration
- 판매 등록 transaction
- 수납 취소
- 정책 활성화
- API contract 변경

## 작업 분해 기준

| 작업 유형   | 분해 방식                                                                |
| ----------- | ------------------------------------------------------------------------ |
| 화면 구현   | layout, filter, table, drawer, form으로 분해                             |
| 도메인 구현 | schema, validation, service, action, query, test로 분해                  |
| DB 변경     | model, relation, index, migration, seed, regression check로 분해         |
| 인증        | user model, password hash, session, route guard, menu RBAC, tests로 분해 |
| Export      | query, permission, file generation, audit log, e2e로 분해                |

## Spark 사용 범위

Spark 사용 가능:

- 화면 skeleton
- Tailwind 스타일링
- 공통 presentational 컴포넌트
- 정적 컬럼 정의
- Story/demo/dummy data
- 문서 포맷 정리

Spark 사용 금지:

- `src/server`
- `prisma`
- auth/session/RBAC
- Server Action contract
- payment/receivable/sale transaction
- policy calculation
- Audit Log

## 병렬 작업 금지 조건

- 같은 파일을 여러 agent가 수정해야 하는 경우
- DB schema와 service가 동시에 확정되지 않은 경우
- API contract가 아직 미정인 경우
- 권한 정책이 불명확한 경우

## 완료 기준

- 변경이 기준 문서와 충돌하지 않는다.
- 관련 권한 검사가 포함되어 있다.
- 서버 입력은 Zod 검증을 통과한다.
- 금액/재고/수납/정책 변경은 테스트가 있다.
- 변경 후 실행한 검증 명령을 보고한다.
```

## 4. Subagent 구성 최적화

### 4.1 사용할 agent

| Agent                      | Model   | 이유                                                       |
| -------------------------- | ------- | ---------------------------------------------------------- |
| `architecture-agent`       | GPT-5.5 | 초기 구조가 아직 없으므로 기준 구조를 지키는 판단자가 필요 |
| `auth-security-agent`      | GPT-5.5 | 인증/RBAC는 보수적으로 관리해야 함                         |
| `db-prisma-agent`          | GPT-5.5 | Prisma schema, migration, transaction 위험이 큼            |
| `backend-domain-agent`     | GPT-5.5 | 판매/수납/정책은 돈과 재고 정합성에 직접 영향              |
| `frontend-workspace-agent` | Spark   | UI 컴포넌트와 화면 골격은 빠르게 분리 가능                 |
| `qa-agent`                 | GPT-5.5 | 비즈니스 규칙과 e2e 흐름 검증 필요                         |
| `docs-agent`               | mini    | 변경 요약과 문서 정리용                                    |

### 4.2 제거할 agent

| 제거 대상                  | 제거 이유                       |
| -------------------------- | ------------------------------- |
| mobile-agent               | 모바일 전용 UX는 MVP 제외       |
| payment-gateway-agent      | PG 실시간 결제 연동 제외        |
| external-carrier-api-agent | 외부 통신사 API 연동 제외       |
| notification-agent         | 문자/알림톡 실제 발송 제외      |
| accounting-agent           | 회계 시스템 연동 제외           |
| ml-agent                   | ML 기능 범위 없음               |
| infra-scale-agent          | 현재는 초기 구현/로컬 개발 우선 |

## 5. 모델 라우팅 전략

| 모델    | 사용 기준                                             | 금지/주의                       |
| ------- | ----------------------------------------------------- | ------------------------------- |
| GPT-5.5 | 설계, auth, DB, API contract, transaction, policy, QA | 비용/속도보다 정확성 우선 영역  |
| Spark   | UI, Tailwind, 정적 컴포넌트, 단순 반복 작업           | auth, DB, API, transaction 금지 |
| mini    | 문서, 단순 정리, 작은 helper/test 초안                | 핵심 로직 최종 판단 금지        |

Spark 사용 가능 영역은 `src/components`, 화면 presentational component, 정적 UI 상태, 문서 포맷에 한정한다. Spark가 만든 UI가 server action 또는 DB contract를 요구하면 GPT-5.5가 후속 설계를 담당한다.

## 6. 작업 실행 정책

### 6.1 자동 subagent 위임 구조

```txt
요청 분석
→ 위험도 분류
→ 기준 문서 확인
→ agent-map 기준으로 작업 분해
→ 독립 파일 범위가 있으면 병렬 위임
→ GPT-5.5 통합 검토
→ 테스트/검증
→ 완료 보고
```

### 6.2 작업 분해 기준

작업은 다음 기준 중 하나라도 해당하면 분해한다.

- UI와 도메인 로직이 함께 포함된다.
- DB schema와 화면 구현이 함께 포함된다.
- 권한 정책과 데이터 조회가 함께 포함된다.
- 테스트와 구현을 병렬로 준비할 수 있다.
- 문서 업데이트가 구현과 분리 가능하다.

작업을 분해하지 않는 경우:

- 작은 문서 수정
- 단일 presentational component 수정
- 하나의 formatter/helper 수정
- auth/DB/API contract의 핵심 결정이 아직 내려지지 않은 상태

## 7. 최종 적용 방법

### 7.1 수정/생성할 파일

| 순서 | 파일                                      | 작업                          |
| ---- | ----------------------------------------- | ----------------------------- |
| 1    | `AGENTS.md`                               | 프로젝트 공통 AI 규칙 생성    |
| 2    | `docs/00_system/model-routing.md`         | 모델 라우팅 기준 생성         |
| 3    | `docs/00_system/agent-map.md`             | 사용할 subagent만 정리        |
| 4    | `docs/00_system/task-execution-rule.md`   | 작업 분해/위임/검증 규칙 생성 |
| 5    | `docs/00_system/project-current-state.md` | 프로젝트 초기화 후 상태 갱신  |

### 7.2 적용 순서

1. 현재 계획서를 검토한다.
2. `AGENTS.md`를 먼저 생성해 모든 AI 작업의 최상위 규칙으로 둔다.
3. `model-routing.md`를 생성해 모델 선택 기준을 고정한다.
4. `agent-map.md`를 생성해 subagent 수를 제한한다.
5. `task-execution-rule.md`를 생성해 자동 위임 기준과 Spark 제한을 명확히 한다.
6. Next.js 프로젝트 초기화 후 `project-current-state.md`를 업데이트한다.
7. 첫 구현 작업은 `WorkspaceShell`, `Sidebar`, `PageIntro`, `Panel`, `MetricCard`, `TonePill`, `DataTable` 순서로 시작한다.
8. auth, DB, API contract는 UI skeleton 이후 GPT-5.5 설계 검토를 거쳐 구현한다.

## 8. 보고 형식

### 8.1 작업 예정 subagent 분해 표

| 작업                    | Agent                      | Model   | 파일 범위                         | 완료 기준                        |
| ----------------------- | -------------------------- | ------- | --------------------------------- | -------------------------------- |
| 프로젝트 초기 구조 생성 | `architecture-agent`       | GPT-5.5 | `package.json`, `src/app`, config | `pnpm dev`, `pnpm lint` 가능     |
| 공통 UI skeleton        | `frontend-workspace-agent` | Spark   | `src/components/workspace`        | 기준 UI 컴포넌트 렌더링          |
| Prisma schema 적용      | `db-prisma-agent`          | GPT-5.5 | `prisma/schema.prisma`, seed      | migration/generate 성공          |
| 로그인/RBAC             | `auth-security-agent`      | GPT-5.5 | `src/lib/auth`, `src/app/(auth)`  | ADMIN/STAFF 접근 제어            |
| 판매 도메인 transaction | `backend-domain-agent`     | GPT-5.5 | `src/server/actions`, `services`  | Sale/Inventory/Receivable 정합성 |
| 테스트 전략/회귀 검증   | `qa-agent`                 | GPT-5.5 | `test`, `tests/e2e`               | 핵심 시나리오 통과               |
| 문서 업데이트           | `docs-agent`               | mini    | `docs/00_system`                  | 상태/변경 요약 최신화            |

### 8.2 작업 완료 보고 예시

```md
## 완료 보고

작업: 판매 등록 Wizard 1차 구현

### 사용 agent

| Agent                    | Model   | 담당                             |
| ------------------------ | ------- | -------------------------------- |
| backend-domain-agent     | GPT-5.5 | 판매 생성 transaction, 금액 검증 |
| frontend-workspace-agent | Spark   | Wizard UI, Stepper, Summary Card |
| qa-agent                 | GPT-5.5 | 회귀 위험 검토, 테스트 케이스    |

### 변경 파일

- `src/app/(workspace)/sales/new/page.tsx`
- `src/components/domain/sales/sales-entry-stepper.tsx`
- `src/server/actions/sales.actions.ts`
- `src/server/services/sales.service.ts`
- `src/lib/validation/sales.schema.ts`
- `test/sales.service.test.ts`

### 검증

- `pnpm lint` 통과
- `pnpm test -- sales.service` 통과
- 판매 등록 성공 시 Sale, Inventory, Receivable 갱신 확인

### 남은 위험

- SQLite 기준 transaction 검증만 완료됨
- PostgreSQL 환경 동시성 테스트 필요
- STAFF 판매 취소 권한 정책은 아직 확정 필요
```

## 9. 결론

현재 PSMS는 구현 초기화 전 상태이므로, AI 하네스는 "코드 생성 속도"보다 "구조 보존과 위험 차단"을 우선해야 한다.

권장 적용안은 root `AGENTS.md`로 전체 규칙을 고정하고, `model-routing.md`, `agent-map.md`, `task-execution-rule.md`로 모델과 subagent 사용 범위를 제한하는 방식이다. Spark는 UI/단순 작업으로만 제한하고, auth, DB, API contract, transaction, 정책 계산은 GPT-5.5 경로로 고정한다.
