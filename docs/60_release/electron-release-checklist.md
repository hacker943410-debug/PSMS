# Electron Release Checklist

작성일: 2026-05-01

Electron은 Web/API MVP와 화면별 디자인 게이트, E2E가 통과한 뒤 활성화한다. 초기 릴리즈는 단일 PC 로컬 앱형이며 SQLite를 사용한다.

## Prerequisites

| 항목                                | 상태 |
| ----------------------------------- | ---- |
| Web/API MVP 기능 완료               | ⬜   |
| 주요 화면 디자인 게이트 통과        | ⬜   |
| `pnpm format:check` 통과            | ⬜   |
| `pnpm lint` 통과                    | ⬜   |
| `pnpm typecheck` 통과               | ⬜   |
| `pnpm db:validate` 통과             | ⬜   |
| `pnpm build` 통과                   | ⬜   |
| ADMIN/STAFF E2E 통과                | ⬜   |
| 판매 등록 E2E 통과                  | ⬜   |
| 수납 등록/취소 E2E 통과             | ⬜   |
| 앱 재시작 후 데이터 유지 smoke 통과 | ⬜   |

## Runtime Rules

- Electron은 로컬 Web `http://127.0.0.1:5273`와 API `http://127.0.0.1:4273`를 실행해 감싼다.
- 개발 중 DB는 `file:./dev.db`를 사용한다.
- 패키징 후 DB는 Electron `userData` 경로의 `psms.db`를 사용한다.
- 앱 시작 시 DB 파일 존재 여부, migration 상태, 백업 가능 여부를 확인한다.
- renderer에는 Node 권한을 주지 않는다.
- preload IPC만 허용한다.
- auth/session/RBAC, DB schema, 판매/수납/정책 로직은 Electron 단계에서 재작성하지 않는다.

## Smoke Test

릴리즈 후보는 최소 다음을 확인한다.

1. 앱 실행
2. local port 점유 충돌 감지
3. API `/health` 통과
4. 로그인
5. 주요 메뉴 진입
6. 판매 등록
7. 수납 등록
8. 앱 재시작
9. 데이터 유지 확인
10. 로그/백업 위치 확인

## Release Report

릴리즈 보고에는 다음을 포함한다.

- 빌드 산출물 경로
- 실행 환경
- 사용 DB 경로
- 실행한 검증 명령
- smoke 결과
- known issues
- rollback/backup 절차
