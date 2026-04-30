import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { WorkspacePlaceholder } from "../../_components/workspace-placeholder";

export default async function SettingsBasePage() {
  requireRole(await requireSession(), ["ADMIN"]);

  return (
    <WorkspacePlaceholder
      title="기초정보"
      route="/settings/base"
      status="Admin placeholder"
      description="ADMIN 전용 기초정보 관리 탭을 구현하기 전의 정적 준비 화면입니다."
      searchParams={["tab", "q", "page", "detail"]}
      features={[
        "매장, 통신사, 단말기 모델 등 기준 정보 탭",
        "탭별 검색과 페이지네이션",
        "detail search param 기반 상세 Drawer",
        "기준 정보 등록/수정 작업 진입점",
      ]}
      access="ADMIN only"
    />
  );
}
