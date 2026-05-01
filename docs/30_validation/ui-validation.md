# UI Validation

작성일: 2026-05-01

이 문서는 `C:\Project\AI_Harness\docs\30_validation\ui-validation.md`를 PSMS 디자인 게이트에 맞게 적용한 기준이다.

## 기준

- 디자인 소스: `C:\Project\PSMS_Tech\design-reference`
- 개발 Web: `http://127.0.0.1:5273`
- 개발 API: `http://127.0.0.1:4273`
- 금지 포트: `5173`, `4173`

## Viewports

| 목적            | 크기       |
| --------------- | ---------- |
| 기준 PNG 비교   | `1586x992` |
| 실제 데스크톱 1 | `1440x900` |
| 실제 데스크톱 2 | `1280x800` |

## Validation Flow

1. API `GET /health`가 통과하는지 확인한다.
2. Web dev server가 `5273`에서 열리는지 확인한다.
3. 대상 화면에 seed/static data를 넣고 기준 PNG와 레이아웃을 맞춘다.
4. Playwright로 screenshot을 수집한다.
5. 콘솔 에러, 네트워크 실패, hydration warning을 확인한다.
6. 접근성 기본 검사를 수행한다.
7. `visual_ui_reviewer` 관점으로 기준 PNG와 비교한다.
8. 발견 사항을 수정하고 같은 viewport에서 재검증한다.

## Screen Reference Map

| 화면        | Route                | 기준 이미지            |
| ----------- | -------------------- | ---------------------- |
| 대시보드    | `/`                  | `dashboard.png`        |
| 판매 관리   | `/sales`             | `sales-management.png` |
| 판매 등록   | `/sales/new`         | `sales-entry.png`      |
| 미수금 관리 | `/receivables`       | `receivables.png`      |
| 고객 관리   | `/customers`         | `customers.png`        |
| 일정 관리   | `/schedule`          | `schedule.png`         |
| 재고 관리   | `/inventory`         | `inventory.png`        |
| 직원 관리   | `/staffs`            | `staffs.png`           |
| 기초정보    | `/settings/base`     | `base-info.png`        |
| 정책 관리   | `/settings/policies` | `policies.png`         |

## Pass Criteria

- Sidebar, top spacing, PageIntro, KPI, FilterBar, DataTable, Drawer, Modal, FormField 구조가 기준 PNG와 같은 위계로 보인다.
- 텍스트가 버튼, 카드, 표 셀, drawer 내부에서 잘리지 않는다.
- 상태는 색만으로 구분하지 않고 텍스트를 포함한다.
- hover/focus/active 상태가 레이아웃 shift를 만들지 않는다.
- `1586x992`, `1440x900`, `1280x800`에서 주요 UI가 겹치지 않는다.
- 콘솔 에러와 치명적 network failure가 없다.
- keyboard focus와 form label이 기본 접근성 기준을 통과한다.

## Report Fields

UI 검증 보고에는 다음을 포함한다.

- 화면 route
- 기준 PNG 파일명
- screenshot viewport
- 콘솔/네트워크 결과
- 접근성 결과
- 기준 대비 차이
- 수정 여부
- 남은 위험
