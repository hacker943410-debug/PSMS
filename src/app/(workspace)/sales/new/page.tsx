import { WorkspacePlaceholder } from "../../_components/workspace-placeholder";

export default function SalesNewPage() {
  return (
    <WorkspacePlaceholder
      title="판매 등록"
      route="/sales/new"
      status="Wizard placeholder"
      description="판매 등록 6단계 Wizard를 구현하기 전의 정적 준비 화면입니다."
      searchParams={["draftId", "customerId", "step"]}
      features={[
        "고객 선택 또는 신규 고객 입력",
        "단말기와 재고 선택",
        "요금제, 부가서비스, 정책 정보 입력",
        "미수금과 일정 생성을 포함한 최종 검토 단계",
      ]}
    />
  );
}
