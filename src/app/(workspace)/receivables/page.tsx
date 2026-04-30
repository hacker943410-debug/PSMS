import { WorkspacePlaceholder } from "../_components/workspace-placeholder";

export default function ReceivablesPage() {
  return (
    <WorkspacePlaceholder
      title="미수금 관리"
      route="/receivables"
      status="Static placeholder"
      description="미수금 목록, 수납 흐름, 후속 일정 연결 전의 정적 준비 화면입니다."
      searchParams={[
        "from",
        "to",
        "storeId",
        "staffId",
        "status",
        "overdue",
        "q",
        "page",
        "detail",
      ]}
      features={[
        "미수금 목록과 연체 여부 필터",
        "상태별 잔액과 수납 예정 정보",
        "detail search param 기반 미수금 상세 Drawer",
        "수납 등록/취소와 후속 일정 등록 진입점",
      ]}
    />
  );
}
