import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { WorkspacePlaceholder } from "../_components/workspace-placeholder";

export default async function StaffsPage() {
  requireRole(await requireSession(), ["ADMIN"]);

  return (
    <WorkspacePlaceholder
      title="직원 관리"
      route="/staffs"
      status="Admin placeholder"
      description="ADMIN 전용 직원 관리 화면을 구현하기 전의 정적 준비 화면입니다."
      searchParams={["role", "storeId", "status", "q", "page", "detail"]}
      features={[
        "직원 목록과 역할/매장/상태 필터",
        "직원 검색과 페이지네이션",
        "detail search param 기반 직원 상세 Drawer",
        "직원 등록/수정 작업 진입점",
      ]}
      access="ADMIN only"
    />
  );
}
