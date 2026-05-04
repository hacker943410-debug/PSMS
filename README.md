# PhoneShop Rebuild Technical Documentation

## 현재 개발 이어받기

현재 활성 개발 저장소는 `PSMS` pnpm workspace이며, 다른 PC에서 이어받을 때는
[`docs/80_ai_harness/cross-pc-handoff-20260504.md`](docs/80_ai_harness/cross-pc-handoff-20260504.md)를 먼저 확인한다.

주요 로컬 포트:

- Web/App: `http://127.0.0.1:5273`
- API: `http://127.0.0.1:4273`

최종 갱신: 2026-04-24  
목적: 새 화면 디자인을 기준으로 PhoneShop 프로젝트를 처음부터 다시 개발하기 위한 기술 문서 묶음.

## 핵심 방향

- 데스크톱 우선 운영 콘솔
- 좌측 사이드바 + 우측 워크스페이스 구조
- 라이트 콘솔형 UI
- 목록, 필터, 상세 Drawer, 등록 Modal 중심 CRUD
- 서버 렌더링 + 서버 액션 + URL 상태 기반 필터링
- 운영 화면과 관리자 설정 화면 분리
- 판매, 미수금, 고객, 일정, 재고가 연결되는 실행형 업무 흐름

## 읽는 순서

1. `docs/00_EXECUTIVE_REBUILD_BRIEF.md`
2. `docs/01_PRODUCT_REQUIREMENTS.md`
3. `docs/02_INFORMATION_ARCHITECTURE_ROUTES_RBAC.md`
4. `docs/03_UI_UX_DESIGN_SYSTEM.md`
5. `docs/04_COMPONENT_ARCHITECTURE.md`
6. `docs/05_FRONTEND_ARCHITECTURE.md`
7. `docs/06_BACKEND_ARCHITECTURE.md`
8. `docs/07_DOMAIN_MODEL_DATABASE_SPEC.md`
9. `prisma/schema.draft.prisma`
10. `docs/08_SERVER_ACTIONS_AND_API_CONTRACTS.md`
11. `docs/09_VALIDATION_FORMATTING_BUSINESS_RULES.md`
12. `docs/10_18_FEATURE_SPECS_INDEX.md`
13. `docs/19_TESTING_QA_ACCEPTANCE_SPEC.md`
14. `docs/20_DEVELOPMENT_ROADMAP_TASK_BREAKDOWN.md`
15. `docs/21_DEPLOYMENT_OPERATION_RUNBOOK.md`
16. `docs/22_CODING_STANDARDS_PROJECT_STRUCTURE.md`
17. `prompts/AI_CODING_AGENT_HANDOFF_PROMPT.md`

## 폴더 구조

```txt
phoneshop_rebuild_docs/
├─ README.md
├─ PHONESHOP_REBUILD_MASTER_SPEC.md
├─ docs/
├─ prisma/
│  └─ schema.draft.prisma
├─ prompts/
│  └─ AI_CODING_AGENT_HANDOFF_PROMPT.md
├─ design-reference/
│  ├─ dashboard.png
│  ├─ sales-management.png
│  ├─ sales-entry.png
│  ├─ receivables.png
│  ├─ customers.png
│  ├─ schedule.png
│  ├─ inventory.png
│  ├─ staffs.png
│  ├─ base-info.png
│  └─ policies.png
└─ source/
   └─ PHONESHOP_SCREEN_DESIGN_TECHNICAL_GUIDE.md
```

## 개발 착수 순서

1. 디자인 시스템과 공통 레이아웃
2. 인증/RBAC/워크스페이스 Shell
3. Prisma 스키마/Seed 데이터
4. 대시보드, 판매 관리, 판매 등록
5. 미수금, 고객, 일정
6. 재고, 직원, 기초정보, 정책
7. 리포트, Export, 테스트, 운영 보강
