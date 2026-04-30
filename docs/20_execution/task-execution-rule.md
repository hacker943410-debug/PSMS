# Task Execution Rule

## 기본 실행 흐름

1. MUST READ 파일을 확인한다.
2. 작업 목표를 재정의한다.
3. 기능, 위험도, 영향 범위를 분류한다.
4. subagent 자동 배정을 고려한다.
5. 작업 예정 보고를 작성한다.
6. 구현/문서/검증을 수행한다.
7. subagent별 결과를 수집한다.
8. 작업 결과 보고를 작성한다.
9. 다음 작업 5개를 제안한다.

## 자동 Subagent 위임 기준

다음 조건이면 subagent 위임을 자동 고려한다.

- 작업이 2개 이상의 독립 영역으로 나뉜다.
- UI와 backend가 분리되어 병렬 진행 가능하다.
- DB schema 검토와 화면 구현이 동시에 필요하다.
- 문서 정리와 구현 검증을 분리할 수 있다.
- 코드 탐색과 구현을 분리하면 안전성이 올라간다.

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
| 문서        | current-state, routing, agent-map, completion report로 분해              |

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
- `src/lib/auth`
- `prisma`
- auth/session/RBAC
- Server Action contract
- payment/receivable/sale transaction
- policy calculation
- Audit Log
- Export permission

## 병렬 작업 금지 조건

- 같은 파일을 여러 agent가 수정해야 하는 경우
- DB schema와 service가 동시에 확정되지 않은 경우
- API contract가 아직 미정인 경우
- 권한 정책이 불명확한 경우
- auth/DB/API contract 변경이 필요한데 사용자 확인이 없는 경우

## 완료 기준

- 변경이 기준 문서와 충돌하지 않는다.
- 관련 권한 검사가 포함되어 있다.
- 서버 입력은 Zod 검증을 통과한다.
- 금액/재고/수납/정책 변경은 테스트가 있다.
- 변경 후 실행한 검증 명령 또는 검증 방법을 보고한다.
- auth/DB/API contract 변경 여부를 명시한다.

## Spark 리뷰 정책

| 항목                      | 값                      |
| ------------------------- | ----------------------- |
| Spark Review              | Pro Spark review 우선   |
| GPT-5.5 additional review | 기본 `OFF_BY_POLICY`    |
| Escalation 발생 시        | GPT-5.5 reviewer로 전환 |

검증 결과가 없으면 완료로 보고하지 않는다.
