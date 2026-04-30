import {
  DataTable,
  type DataTableColumn,
  MetricCard,
  PageIntro,
  Panel,
  TonePill,
} from "@/components/workspace";

type BootstrapRow = {
  id: string;
  area: string;
  status: "ready" | "pending" | "guarded";
  owner: string;
};

const rows: BootstrapRow[] = [
  {
    id: "harness",
    area: "AI 하네스",
    status: "ready",
    owner: "docs_release_manager",
  },
  {
    id: "workspace-ui",
    area: "Workspace UI 컴포넌트",
    status: "ready",
    owner: "spark_ui_iterator",
  },
  {
    id: "auth",
    area: "인증/RBAC",
    status: "guarded",
    owner: "security_reviewer",
  },
  {
    id: "db",
    area: "Prisma/DB",
    status: "guarded",
    owner: "db_reviewer",
  },
  {
    id: "domain",
    area: "업무 도메인",
    status: "pending",
    owner: "backend_agent",
  },
];

const columns: DataTableColumn<BootstrapRow>[] = [
  {
    key: "area",
    header: "영역",
    cell: (row) => (
      <span className="font-medium text-slate-900">{row.area}</span>
    ),
  },
  {
    key: "status",
    header: "상태",
    cell: (row) => {
      const toneByStatus = {
        ready: "success",
        pending: "warning",
        guarded: "info",
      } as const;

      const labelByStatus = {
        ready: "준비됨",
        pending: "대기",
        guarded: "보호됨",
      } as const;

      return (
        <TonePill tone={toneByStatus[row.status]}>
          {labelByStatus[row.status]}
        </TonePill>
      );
    },
  },
  {
    key: "owner",
    header: "담당 Agent",
    cell: (row) => <span className="text-slate-600">{row.owner}</span>,
  },
];

export default function WorkspaceHomePage() {
  return (
    <>
      <PageIntro
        eyebrow="PhoneShop Rebuild"
        title="대시보드 준비 화면"
        description="공통 Workspace UI 컴포넌트가 적용된 초기 화면입니다. 업무 기능, 인증, 데이터베이스, API contract는 아직 구현하지 않았습니다."
        meta={
          <>
            <TonePill tone="success">Harness Ready</TonePill>
            <TonePill tone="info">App Router</TonePill>
            <TonePill tone="warning">Domain Pending</TonePill>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="하네스 상태"
          value="적용 완료"
          helper="AGENTS.md, model routing, agent map 반영"
          trend="OK"
          tone="success"
        />
        <MetricCard
          label="검증 상태"
          value="3/3"
          helper="typecheck, lint, build 통과"
          trend="PASS"
          tone="success"
        />
        <MetricCard
          label="보호 영역"
          value="Auth/DB/API"
          helper="현재 단계에서는 변경 금지"
          trend="Guarded"
          tone="info"
        />
      </section>

      <Panel
        title="다음 구현 범위"
        description="현재 화면은 공통 UI 컴포넌트 연결 검증용입니다."
      >
        <ul className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <li className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            Workspace route group 생성
          </li>
          <li className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            Sidebar active state와 권한 메뉴 연결
          </li>
          <li className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            Dashboard query는 DB 단계 이후 연결
          </li>
          <li className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            인증/RBAC는 security reviewer 경로로 진행
          </li>
        </ul>
      </Panel>

      <DataTable
        caption="Bootstrap status"
        columns={columns}
        data={rows}
        getRowKey={(row) => row.id}
      />
    </>
  );
}
