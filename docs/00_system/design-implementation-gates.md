# Design Implementation Gates

작성일: 2026-05-01

## 기준

디자인 기준은 `C:\Project\PSMS_Tech\design-reference`의 PNG 10개다. 기능 구현 후 마지막에 보정하지 않고, 각 화면은 아래 순서로 완료 처리한다.

```txt
디자인 정합성 -> API 계약 -> 기능 연결 -> 테스트 -> 스크린샷 QA
```

## 화면별 기준 이미지

| 화면        | 경로                 | 기준 이미지            |
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

## QA 기준

- 기준 이미지 크기 `1586x992`를 우선 비교한다.
- 개발 확인은 Web `http://127.0.0.1:5273`, API `http://127.0.0.1:4273`로 수행한다.
- Playwright 스크린샷은 `1586x992`, `1440x900`, `1280x800`에서 확인한다.
- Sidebar, PageIntro, KPI, FilterBar, DataTable, Drawer, Modal, FormField가 기준 화면과 일관되어야 한다.
- 릴리즈 직전 일괄 보정은 완료 기준으로 인정하지 않는다.
