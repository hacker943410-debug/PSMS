import { WorkspacePlaceholder } from "../_components/workspace-placeholder";

export default function SalesPage() {
  return (
    <WorkspacePlaceholder
      title="판매 관리"
      route="/sales"
      status="Static placeholder"
      description="판매 목록, 필터, 상세 Drawer를 연결하기 전의 정적 준비 화면입니다."
      searchParams={[
        "from",
        "to",
        "storeId",
        "staffId",
        "carrierId",
        "subscriptionType",
        "status",
        "q",
        "page",
        "pageSize",
        "detail",
      ]}
      features={[
        "판매 목록과 기간/매장/담당자 필터",
        "통신사, 가입 유형, 상태, 검색어 필터",
        "detail search param 기반 판매 상세 Drawer",
        "판매 등록 페이지로 이동하는 주요 작업",
      ]}
    />
  );
}
