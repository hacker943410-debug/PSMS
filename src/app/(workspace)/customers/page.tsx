import { WorkspacePlaceholder } from "../_components/workspace-placeholder";

export default function CustomersPage() {
  return (
    <WorkspacePlaceholder
      title="고객 관리"
      route="/customers"
      status="Static placeholder"
      description="고객 검색, 계약 상태, 미수금 상태를 연결하기 전의 정적 준비 화면입니다."
      searchParams={[
        "storeId",
        "carrierId",
        "contractStatus",
        "receivableStatus",
        "q",
        "page",
        "detail",
      ]}
      features={[
        "고객 목록과 통합 검색",
        "매장, 통신사, 계약 상태 필터",
        "미수금 상태 기반 고객 분류",
        "detail search param 기반 고객 상세 Drawer",
      ]}
    />
  );
}
