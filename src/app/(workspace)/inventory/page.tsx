import { WorkspacePlaceholder } from "../_components/workspace-placeholder";

export default function InventoryPage() {
  return (
    <WorkspacePlaceholder
      title="재고 관리"
      route="/inventory"
      status="Static placeholder"
      description="단말기 재고 목록, 상태 필터, 등록/수정 Drawer를 연결하기 전의 정적 준비 화면입니다."
      searchParams={[
        "storeId",
        "carrierId",
        "deviceModelId",
        "status",
        "from",
        "to",
        "q",
        "page",
        "detail",
      ]}
      features={[
        "매장, 통신사, 모델, 상태별 재고 조회",
        "입고 기간과 검색어 기반 필터",
        "detail search param 기반 재고 Drawer",
        "재고 등록/수정 작업 진입점",
      ]}
    />
  );
}
