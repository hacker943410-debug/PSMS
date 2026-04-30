import { WorkspacePlaceholder } from "../_components/workspace-placeholder";

export default function SchedulePage() {
  return (
    <WorkspacePlaceholder
      title="일정 관리"
      route="/schedule"
      status="Static placeholder"
      description="월간/목록 일정 보기와 수동 일정 등록을 연결하기 전의 정적 준비 화면입니다."
      searchParams={["month", "staffId", "type", "storeId", "view"]}
      features={[
        "월 기준 일정 조회",
        "담당자, 일정 유형, 매장 필터",
        "캘린더 보기와 목록 보기 전환",
        "수동 일정 등록/수정 Modal 진입점",
      ]}
    />
  );
}
