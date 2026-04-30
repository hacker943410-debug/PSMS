import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { WorkspacePlaceholder } from "../../_components/workspace-placeholder";

export default async function SettingsPoliciesPage() {
  requireRole(await requireSession(), ["ADMIN"]);

  return (
    <WorkspacePlaceholder
      title="정책 관리"
      route="/settings/policies"
      status="Admin placeholder"
      description="ADMIN 전용 정책 관리 화면을 구현하기 전의 정적 준비 화면입니다."
      searchParams={[
        "tab",
        "carrierId",
        "status",
        "from",
        "to",
        "page",
        "detail",
      ]}
      features={[
        "정책 유형별 탭 구성",
        "통신사, 상태, 적용 기간 필터",
        "detail search param 기반 정책 상세 Drawer",
        "정책 등록, 활성화, 이력 확인 진입점",
      ]}
      access="ADMIN only"
    />
  );
}
