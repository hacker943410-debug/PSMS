# Design Reference Match Gate

작성일: 2026-05-02
최근 갱신: 2026-05-03

## 기준

`C:\projects\archive\PSMS_Tech\phoneshop_rebuild_docs\design-reference`의 PNG 10개를 화면별 최종 디자인 기준으로 사용한다.

모든 기준 PNG는 `1586x992`이며, 각 패치는 화면 하나만 대상으로 한다.

## 진행 순서

| 순서 | Route                | 기준 PNG               | 상태             |
| ---: | -------------------- | ---------------------- | ---------------- |
|    1 | `/`                  | `dashboard.png`        | 사용자 승인 완료 |
|    2 | `/sales`             | `sales-management.png` | 사용자 승인 완료 |
|    3 | `/sales/new`         | `sales-entry.png`      | 사용자 승인 완료 |
|    4 | `/receivables`       | `receivables.png`      | 사용자 승인 완료 |
|    5 | `/customers`         | `customers.png`        | 사용자 승인 완료 |
|    6 | `/schedule`          | `schedule.png`         | 사용자 승인 후보 |
|    7 | `/inventory`         | `inventory.png`        | 대기             |
|    8 | `/staffs`            | `staffs.png`           | 대기             |
|    9 | `/settings/base`     | `base-info.png`        | 대기             |
|   10 | `/settings/policies` | `policies.png`         | 대기             |

## 진행률

| 항목                            |                   현재 |
| ------------------------------- | ---------------------: |
| PNG 일치 게이트 승인 완료       |               `5 / 10` |
| PNG 일치 게이트 승인 후보       |               `1 / 10` |
| 기존 Phase 1 Design System Gate |           `67% / 100%` |
| Design Reference Match Gate     | `50% / 100%` 승인 기준 |
| 전체 프로젝트                   |           `36% / 100%` |
| Web/API MVP 업무 기능 준비도    |           `14% / 100%` |

사용자 승인 전에는 해당 메뉴를 완료로 계산하지 않는다.

## 메뉴별 패치 규칙

1. 기준 PNG에서 주요 UI 영역의 좌표와 비율을 측정한다.
2. 같은 viewport의 현재 화면 screenshot과 차이를 비교한다.
3. 해당 메뉴 route와 필요한 공통 UI만 수정한다.
4. 기능/API 연결은 하지 않고 정적 기준 데이터로 디자인 밀도를 맞춘다.
5. `1586x992`, `1440x900`, `1280x800` screenshot을 캡처한다.
6. 사용자 승인 후 다음 메뉴로 넘어간다.

## 측정 항목

| 항목          | 산식                                                                  |
| ------------- | --------------------------------------------------------------------- |
| 좌표          | `x / 1586`, `y / 992`                                                 |
| 크기          | `w / 1586`, `h / 992`                                                 |
| 공통 영역     | sidebar, page padding, header, filter, KPI, chart, table, footer      |
| 컴포넌트 세부 | card radius, font size, icon size, table row height, chart block size |

폰트 크기는 viewport 비례 확대를 금지하고, 기준 viewport에서 맞춘 px/rem 값을 유지한다.
