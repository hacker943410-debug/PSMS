import { WorkspacePlaceholder } from "../../_components/workspace-placeholder";

export default function ReportsSummaryPage() {
  return (
    <WorkspacePlaceholder
      title="상세 리포트"
      route="/reports/summary"
      status="Report placeholder"
      description="기간, 매장, 담당자, 통신사 기준 리포트 집계를 연결하기 전의 정적 준비 화면입니다."
      searchParams={[
        "from",
        "to",
        "storeId",
        "staffId",
        "carrierId",
        "groupBy",
      ]}
      features={[
        "기간 기준 매출/개통/미수금 요약",
        "매장, 담당자, 통신사 필터",
        "groupBy search param 기반 집계 기준 변경",
        "CSV/PDF Export 진입점은 권한/Audit Log 구현 후 연결",
      ]}
    />
  );
}
