# Task Report Format

## 작업 예정 보고

```md
# 작업 예정 보고

## 목표

-

## 현재 프로젝트 구조 분석 요약

| 항목           | 내용 |
| -------------- | ---- |
| Frontend       |      |
| Backend        |      |
| DB             |      |
| 인증           |      |
| API 구조       |      |
| 주요 기능 상태 |      |

## 충돌 가능성 분석

| 영역         | 충돌 가능성 | 대응 |
| ------------ | ----------- | ---- |
| Auth         |             |      |
| DB           |             |      |
| API contract |             |      |
| UI/라우팅    |             |      |

## Subagent 배정

| 세부 작업 | Subagent | Model | Reasoning | 권한 | 파일 범위 | 산출물 | 배정 이유 |
| --------- | -------- | ----- | --------- | ---- | --------- | ------ | --------- |

## Spark 정책

| 항목              | 값                              |
| ----------------- | ------------------------------- |
| Spark 사용 여부   | Yes / No                        |
| Spark 담당 범위   |                                 |
| GPT-5.5 추가 리뷰 | OFF_BY_POLICY / ESCALATED / N/A |
| Escalation 조건   |                                 |

## 예상 검증

| 검증 | 도구/명령 | 담당 |
| ---- | --------- | ---- |
```

## 작업 결과 보고

```md
# 작업 결과 보고

## 요약

-

## 전체 진행률 요약

| 기준               | 현재 완료율 | 판단 근거 |
| ------------------ | ----------: | --------- |
| 전체 준비 포함     |             |           |
| 실제 MVP 업무 기능 |             |           |
| Frontend shell     |             |           |
| Backend/domain     |             |           |
| DB 기반 구축       |             |           |

## Phase별 완료율 재산정

| Phase | 원본 목표              | 현재 상태 | 완료율 |
| ----: | ---------------------- | --------- | -----: |
|     0 | 프로젝트 초기화        |           |        |
|     1 | 디자인 시스템/레이아웃 |           |        |
|     2 | 인증/RBAC              |           |        |
|     3 | 데이터 모델/Seed       |           |        |
|     4 | 대시보드/리포트        |           |        |
|     5 | 판매 관리/판매 등록    |           |        |
|     6 | 미수금/고객            |           |        |
|     7 | 일정/재고              |           |        |
|     8 | 관리자 설정            |           |        |
|     9 | Export/QA/운영 보강    |           |        |

## Phase별 완료율 예시

| Phase | 원본 목표              | 현재 상태                                                                                | 완료율 |
| ----: | ---------------------- | ---------------------------------------------------------------------------------------- | -----: |
|     0 | 프로젝트 초기화        | Next/TS/Tailwind/Prisma/SQLite/검증 스크립트 대부분 완료. README, test script 부족       |    80% |
|     1 | 디자인 시스템/레이아웃 | Shell, Sidebar, PageIntro, Panel, MetricCard, DataTable, TonePill 완료. Drawer 등 미구현 |    35% |
|     2 | 인증/RBAC              | User/Session schema, login UI skeleton 있음. 실제 login/hash/session/guard/RBAC 없음     |    20% |
|     3 | 데이터 모델/Seed       | Prisma schema, migration, dev DB 적용 완료. seed script/data 없음                        |    45% |
|     4 | 대시보드/리포트        | route와 placeholder만 있음. query/KPI/chart/export 없음                                  |     5% |
|     5 | 판매 관리/판매 등록    | `/sales`, `/sales/new` placeholder. Wizard/transaction 없음                              |     3% |
|     6 | 미수금/고객            | route placeholder만 있음. 수납/취소/상세/이력 없음                                       |     3% |
|     7 | 일정/재고              | route placeholder만 있음. 캘린더/재고 등록/상태변경 없음                                 |     3% |
|     8 | 관리자 설정            | staffs/base/policies placeholder. CRUD/정책 활성화/백업 없음                             |     3% |
|     9 | Export/QA/운영 보강    | 운영 문서 일부와 build 검증은 있음. Export/AuditLog/test/deploy 미구현                   |     5% |

## Subagent별 결과

| 세부 작업 | Subagent | Model | 결과 | 산출물 | 검증 |
| --------- | -------- | ----- | ---- | ------ | ---- |

## 변경 파일

| 파일 | 변경 내용 | 담당 |
| ---- | --------- | ---- |

## 하네스 커스터마이징 결과

| 파일                                       | 적용 내용 |
| ------------------------------------------ | --------- |
| `AGENTS.md`                                |           |
| `docs/00_core/model-routing.md`            |           |
| `docs/10_agents/agent-map.md`              |           |
| `docs/20_execution/task-execution-rule.md` |           |
| `docs/20_execution/task-report-format.md`  |           |

## 검증 결과

| 검증 | 결과 | 근거 |
| ---- | ---: | ---- |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고 |
| ------------ | --------: | ---- |
| Auth         |  No / Yes |      |
| DB           |  No / Yes |      |
| API contract |  No / Yes |      |

## 이슈/해결방법

| 이슈 | 원인 | 해결 | 재발 방지 |
| ---- | ---- | ---- | --------- |

## 남은 리스크

| 리스크 | 영향도 | 대응 |
| ------ | -----: | ---- |

## 다음 작업 5개

| 우선순위 | 작업 | 작업 예정자 | 모델 |
| -------: | ---- | ----------- | ---- |
|        1 |      |             |      |
|        2 |      |             |      |
|        3 |      |             |      |
|        4 |      |             |      |
|        5 |      |             |      |
```
