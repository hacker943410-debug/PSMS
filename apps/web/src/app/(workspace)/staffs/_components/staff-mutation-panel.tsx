"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Send, Undo2, X } from "lucide-react";

import { Button, SelectInput, TextInput } from "@/components/workspace";
import {
  issuePasswordResetCredentialAction,
  issueStaffActivationCredentialAction,
  revokePasswordResetCredentialAction,
  revokeStaffActivationCredentialAction,
  type StaffCredentialActionState,
} from "@/server/actions/admin-staff-credential.actions";
import {
  changeStaffStatusAction,
  createStaffAction,
  updateStaffAction,
  type StaffMutationActionState,
} from "@/server/actions/admin-staff.actions";
import type {
  AdminRecordStatus,
  AdminStaffCredentialRequestSummary,
  AdminStaffDetail,
  AdminStaffPageData,
  CredentialDeliveryMode,
} from "@psms/shared";

type StaffDrawerKind = "create" | "detail" | "edit";

type StaffMutationPanelProps = {
  closeHref: string;
  editHref?: string;
  kind: StaffDrawerKind;
  staff?: AdminStaffDetail;
  stores: AdminStaffPageData["filterOptions"]["stores"];
};

const drawerInputClass =
  "!h-10 !rounded-md !border-slate-200 !px-3.5 !text-sm !text-slate-700";

const footerLinkClass =
  "inline-flex h-10 min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200/70 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2";

const initialStaffMutationActionState: StaffMutationActionState = {
  ok: false,
};

const initialStaffCredentialActionState: StaffCredentialActionState = {
  ok: false,
};

function statusText(status: AdminRecordStatus | undefined) {
  return status === "INACTIVE" ? "비활성" : "활성";
}

function nextStatus(status: AdminRecordStatus | undefined): AdminRecordStatus {
  return status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
}

function nextStatusActionLabel(status: AdminRecordStatus | undefined) {
  return status === "ACTIVE" ? "비활성 처리" : "활성 처리";
}

function DrawerField({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-3 block text-sm font-bold leading-4 text-slate-700">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs font-medium text-rose-700">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function MessageBox({ state }: { state: StaffMutationActionState }) {
  if (!state.message) {
    return (
      <p className="sr-only" aria-live="polite">
        직원 관리 처리 상태
      </p>
    );
  }

  return (
    <div
      className={[
        "rounded-lg border px-4 py-3 text-sm font-semibold",
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800",
      ].join(" ")}
      aria-live="polite"
    >
      {state.message}
    </div>
  );
}

function CredentialMessageBox({
  state,
}: {
  state: StaffCredentialActionState;
}) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      className={[
        "rounded-md border px-3 py-2 text-xs font-semibold leading-5",
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800",
      ].join(" ")}
      aria-live="polite"
    >
      <p>{state.message}</p>
      {state.ok && state.revokedPreviousTokenCount !== undefined ? (
        <p className="mt-1 font-medium">
          이전 미사용 요청 회수 {state.revokedPreviousTokenCount}건
        </p>
      ) : null}
    </div>
  );
}

function CredentialActionForm({
  action,
  buttonLabel,
  disabled,
  disabledLabel,
  expectedUpdatedAt,
  icon,
  reasonLabel,
  state,
  userId,
  variant,
}: {
  action: (payload: FormData) => void;
  buttonLabel: string;
  disabled: boolean;
  disabledLabel?: string;
  expectedUpdatedAt: string;
  icon: typeof Send;
  reasonLabel: string;
  state: StaffCredentialActionState;
  userId: string;
  variant: "primary" | "danger";
}) {
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      <DrawerField
        label={reasonLabel}
        required
        error={state.fieldErrors?.reason}
      >
        <TextInput
          name="reason"
          placeholder="처리 사유를 입력하세요"
          maxLength={200}
          disabled={disabled}
          className={drawerInputClass}
          aria-invalid={state.fieldErrors?.reason ? "true" : undefined}
        />
      </DrawerField>
      <Button
        type="submit"
        variant={variant}
        icon={icon}
        disabled={disabled}
        className="!h-10 !min-h-10 !w-full !text-sm"
      >
        {disabled ? (disabledLabel ?? "처리 중") : buttonLabel}
      </Button>
      <CredentialMessageBox state={state} />
    </form>
  );
}

function formatCredentialDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  }).format(date);
}

function deliveryModeText(mode: CredentialDeliveryMode | null) {
  if (!mode) {
    return "승인된 전달 채널";
  }

  return "승인된 전달 채널";
}

function CredentialRequestStatusCard({
  accessLabel,
  request,
}: {
  accessLabel: string;
  request: AdminStaffCredentialRequestSummary;
}) {
  const isPending = request.status === "PENDING";

  return (
    <div
      className={[
        "rounded-md border px-3 py-3 text-xs leading-5",
        isPending
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-white text-slate-600",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">
          {isPending ? `${accessLabel} 요청 대기 중` : "대기 중인 요청 없음"}
        </p>
        <span
          className={[
            "rounded-md border px-2 py-1 font-bold",
            isPending
              ? "border-amber-300 bg-amber-100 text-amber-900"
              : "border-slate-200 bg-slate-50 text-slate-500",
          ].join(" ")}
        >
          {isPending ? "대기" : "없음"}
        </span>
      </div>
      <p className="mt-2 font-medium">
        {isPending
          ? `${deliveryModeText(
              request.deliveryMode
            )}로 보낸 ${accessLabel} 요청이 아직 사용되지 않았습니다.`
          : "현재 미사용 계정 접근 요청이 없습니다."}
      </p>
      {isPending ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-semibold">
          <span>만료 {formatCredentialDateTime(request.expiresAt)}</span>
          {request.issuedByName ? (
            <span>처리자 {request.issuedByName}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StaffCredentialPanel({
  staff,
  issueActivationAction,
  issueActivationPending,
  issueActivationState,
  revokeActivationAction,
  revokeActivationPending,
  revokeActivationState,
  issuePasswordResetAction,
  issuePasswordResetPending,
  issuePasswordResetState,
  revokePasswordResetAction,
  revokePasswordResetPending,
  revokePasswordResetState,
}: {
  staff: AdminStaffDetail;
  issueActivationAction: (payload: FormData) => void;
  issueActivationPending: boolean;
  issueActivationState: StaffCredentialActionState;
  revokeActivationAction: (payload: FormData) => void;
  revokeActivationPending: boolean;
  revokeActivationState: StaffCredentialActionState;
  issuePasswordResetAction: (payload: FormData) => void;
  issuePasswordResetPending: boolean;
  issuePasswordResetState: StaffCredentialActionState;
  revokePasswordResetAction: (payload: FormData) => void;
  revokePasswordResetPending: boolean;
  revokePasswordResetState: StaffCredentialActionState;
}) {
  const isStaffRole = staff.role === "STAFF";
  const isActive = staff.status === "ACTIVE";
  const issueState = isActive ? issuePasswordResetState : issueActivationState;
  const revokeState = isActive
    ? revokePasswordResetState
    : revokeActivationState;
  const issueAction = isActive
    ? issuePasswordResetAction
    : issueActivationAction;
  const revokeAction = isActive
    ? revokePasswordResetAction
    : revokeActivationAction;
  const issuePending = isActive
    ? issuePasswordResetPending
    : issueActivationPending;
  const revokePending = isActive
    ? revokePasswordResetPending
    : revokeActivationPending;
  const accessLabel = isActive ? "접근 재설정" : "활성화";
  const requestState = isActive
    ? staff.credentialRequests.passwordReset
    : staff.credentialRequests.activation;
  const revokeDisabled =
    revokePending ||
    requestState.status !== "PENDING" ||
    requestState.canRevoke !== true;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
          <KeyRound className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-4 text-slate-700">
            계정 접근 요청
          </p>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
            승인된 전달 채널로만 요청을 보내며 화면에는 민감한 값을 표시하지
            않습니다.
          </p>
        </div>
      </div>

      {!isStaffRole ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold leading-5 text-amber-800">
          관리자 계정의 접근 요청은 별도 승인 절차에서 처리합니다.
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-3 text-xs font-medium leading-5 text-slate-600">
            {isActive
              ? "활성 직원에게 접근 재설정 요청을 발급하거나 미사용 요청을 회수합니다."
              : "비활성 직원에게 활성화 요청을 발급하거나 미사용 요청을 회수합니다."}
          </div>

          <CredentialRequestStatusCard
            accessLabel={accessLabel}
            request={requestState}
          />

          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-3 text-xs font-medium leading-5 text-slate-600">
            {requestState.status === "PENDING"
              ? "요청을 회수하면 기존 접근 요청은 더 이상 사용할 수 없습니다."
              : "새 요청을 발급하면 이전 미사용 요청은 회수됩니다."}
          </div>

          <CredentialActionForm
            action={issueAction}
            buttonLabel={`${accessLabel} 요청 발급`}
            disabled={issuePending}
            expectedUpdatedAt={staff.updatedAt}
            icon={Send}
            reasonLabel={`${accessLabel} 요청 발급 사유`}
            state={issueState}
            userId={staff.id}
            variant="primary"
          />

          <CredentialActionForm
            action={revokeAction}
            buttonLabel={`${accessLabel} 요청 회수`}
            disabled={revokeDisabled}
            disabledLabel={revokePending ? undefined : "회수할 요청 없음"}
            expectedUpdatedAt={staff.updatedAt}
            icon={Undo2}
            reasonLabel={`${accessLabel} 요청 회수 사유`}
            state={revokeState}
            userId={staff.id}
            variant="danger"
          />
        </div>
      )}
    </div>
  );
}

function MissingStaffPanel({ closeHref }: { closeHref: string }) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-[25px] pt-[27px] text-sm">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm font-semibold text-amber-800">
          직원 정보를 찾을 수 없습니다.
        </div>
      </div>
      <div className="grid h-[88px] shrink-0 grid-cols-1 gap-4 border-t border-slate-200 px-[25px] py-6">
        <Link href={closeHref} className={footerLinkClass}>
          닫기
        </Link>
      </div>
    </>
  );
}

function CreateStaffPanel({
  closeHref,
  stores,
}: {
  closeHref: string;
  stores: AdminStaffPageData["filterOptions"]["stores"];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [createState, createAction, isCreatePending] = useActionState(
    createStaffAction,
    initialStaffMutationActionState
  );

  useEffect(() => {
    if (createState.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [createState.ok, router]);

  return (
    <form
      ref={formRef}
      action={createAction}
      className="flex min-h-0 flex-1 flex-col"
    >
      <input type="hidden" name="status" value="INACTIVE" />
      <div className="min-h-0 flex-1 space-y-[24px] overflow-y-auto px-[25px] pt-[27px] text-sm">
        <MessageBox state={createState} />

        <DrawerField
          label="이름"
          required
          error={createState.fieldErrors?.name}
        >
          <TextInput
            name="name"
            placeholder="이름을 입력하세요"
            disabled={isCreatePending}
            className={drawerInputClass}
            aria-invalid={createState.fieldErrors?.name ? "true" : undefined}
          />
        </DrawerField>

        <DrawerField
          label="아이디"
          required
          error={createState.fieldErrors?.loginId}
        >
          <TextInput
            name="loginId"
            placeholder="영문 소문자와 숫자 4~32자"
            autoCapitalize="none"
            autoComplete="off"
            disabled={isCreatePending}
            className={drawerInputClass}
            aria-invalid={createState.fieldErrors?.loginId ? "true" : undefined}
          />
        </DrawerField>

        <DrawerField
          label="역할"
          required
          error={createState.fieldErrors?.role}
        >
          <SelectInput
            name="role"
            defaultValue=""
            disabled={isCreatePending}
            className={drawerInputClass}
            aria-invalid={createState.fieldErrors?.role ? "true" : undefined}
          >
            <option value="">역할을 선택하세요</option>
            <option value="ADMIN">관리자</option>
            <option value="STAFF">직원</option>
          </SelectInput>
        </DrawerField>

        <DrawerField label="매장" error={createState.fieldErrors?.storeId}>
          <SelectInput
            name="storeId"
            defaultValue=""
            disabled={isCreatePending}
            className={drawerInputClass}
            aria-invalid={createState.fieldErrors?.storeId ? "true" : undefined}
          >
            <option value="">매장 없음</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
                {store.status === "INACTIVE" ? " (비활성)" : ""}
              </option>
            ))}
          </SelectInput>
        </DrawerField>

        <DrawerField label="연락처" error={createState.fieldErrors?.phone}>
          <TextInput
            name="phone"
            placeholder="010-1234-5678"
            disabled={isCreatePending}
            className={drawerInputClass}
            aria-invalid={createState.fieldErrors?.phone ? "true" : undefined}
          />
        </DrawerField>

        {createState.fieldErrors?.form ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {createState.fieldErrors.form}
          </p>
        ) : null}

        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
          <p>등록된 계정은 비활성 상태로 생성됩니다.</p>
          <p className="text-xs font-medium text-slate-500">
            등록 결과는 목록과 상세 화면에서 확인할 수 있습니다.
          </p>
        </div>
      </div>
      <div className="grid h-[88px] shrink-0 grid-cols-2 gap-4 border-t border-slate-200 px-[25px] py-6">
        <Link href={closeHref} className={footerLinkClass}>
          취소
        </Link>
        <Button
          type="submit"
          variant="primary"
          disabled={isCreatePending}
          className="!h-10 !min-h-10 !text-sm"
        >
          {isCreatePending ? "등록 중" : "등록"}
        </Button>
      </div>
    </form>
  );
}

function DetailStaffPanel({
  closeHref,
  editHref,
  staff,
}: {
  closeHref: string;
  editHref?: string;
  staff: AdminStaffDetail;
}) {
  const router = useRouter();
  const [statusState, statusAction, isStatusPending] = useActionState(
    changeStaffStatusAction,
    initialStaffMutationActionState
  );
  const [
    issueActivationState,
    issueActivationAction,
    isIssueActivationPending,
  ] = useActionState(
    issueStaffActivationCredentialAction,
    initialStaffCredentialActionState
  );
  const [
    revokeActivationState,
    revokeActivationAction,
    isRevokeActivationPending,
  ] = useActionState(
    revokeStaffActivationCredentialAction,
    initialStaffCredentialActionState
  );
  const [
    issuePasswordResetState,
    issuePasswordResetAction,
    isIssuePasswordResetPending,
  ] = useActionState(
    issuePasswordResetCredentialAction,
    initialStaffCredentialActionState
  );
  const [
    revokePasswordResetState,
    revokePasswordResetAction,
    isRevokePasswordResetPending,
  ] = useActionState(
    revokePasswordResetCredentialAction,
    initialStaffCredentialActionState
  );

  useEffect(() => {
    if (statusState.ok) {
      router.refresh();
    }
  }, [router, statusState.ok]);

  useEffect(() => {
    if (
      issueActivationState.ok ||
      revokeActivationState.ok ||
      issuePasswordResetState.ok ||
      revokePasswordResetState.ok
    ) {
      router.refresh();
    }
  }, [
    issueActivationState.ok,
    issuePasswordResetState.ok,
    revokeActivationState.ok,
    revokePasswordResetState.ok,
    router,
  ]);

  const targetStatus = nextStatus(staff.status);

  return (
    <>
      <div className="min-h-0 flex-1 space-y-[24px] overflow-y-auto px-[25px] pt-[27px] text-sm">
        <MessageBox state={statusState} />

        <DrawerField label="이름">
          <TextInput value={staff.name} readOnly className={drawerInputClass} />
        </DrawerField>

        <DrawerField label="아이디 또는 이메일">
          <TextInput
            value={staff.loginId}
            readOnly
            className={drawerInputClass}
          />
        </DrawerField>

        <DrawerField label="역할">
          <TextInput
            value={staff.role === "ADMIN" ? "관리자" : "직원"}
            readOnly
            className={drawerInputClass}
          />
        </DrawerField>

        <DrawerField label="매장">
          <TextInput
            value={staff.storeName ?? "매장 없음"}
            readOnly
            className={drawerInputClass}
          />
        </DrawerField>

        <DrawerField label="연락처">
          <TextInput
            value={staff.phone ?? ""}
            readOnly
            className={drawerInputClass}
          />
        </DrawerField>

        <div className="space-y-[13px] rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm font-bold leading-4 text-slate-700">
            현재 상태
          </p>
          <p className="text-sm font-semibold text-slate-700">
            {statusText(staff.status)} 상태입니다.
          </p>
        </div>

        <StaffCredentialPanel
          staff={staff}
          issueActivationAction={issueActivationAction}
          issueActivationPending={isIssueActivationPending}
          issueActivationState={issueActivationState}
          revokeActivationAction={revokeActivationAction}
          revokeActivationPending={isRevokeActivationPending}
          revokeActivationState={revokeActivationState}
          issuePasswordResetAction={issuePasswordResetAction}
          issuePasswordResetPending={isIssuePasswordResetPending}
          issuePasswordResetState={issuePasswordResetState}
          revokePasswordResetAction={revokePasswordResetAction}
          revokePasswordResetPending={isRevokePasswordResetPending}
          revokePasswordResetState={revokePasswordResetState}
        />

        <form
          action={statusAction}
          className="space-y-3 rounded-lg border border-slate-200 px-4 py-4"
        >
          <input type="hidden" name="userId" value={staff.id} />
          <input type="hidden" name="status" value={targetStatus} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={staff.updatedAt}
          />
          <DrawerField
            label={`${nextStatusActionLabel(staff.status)} 사유`}
            required
            error={statusState.fieldErrors?.reason}
          >
            <TextInput
              name="reason"
              placeholder="변경 사유를 입력하세요"
              maxLength={200}
              disabled={isStatusPending}
              className={drawerInputClass}
              aria-invalid={
                statusState.fieldErrors?.reason ? "true" : undefined
              }
            />
          </DrawerField>
          {statusState.fieldErrors?.form ? (
            <p className="text-xs font-medium text-rose-700">
              {statusState.fieldErrors.form}
            </p>
          ) : null}
          <Button
            type="submit"
            variant={targetStatus === "INACTIVE" ? "danger" : "primary"}
            disabled={isStatusPending}
            className="!h-10 !min-h-10 !w-full !text-sm"
          >
            {isStatusPending
              ? "처리 중"
              : `${nextStatusActionLabel(staff.status)} 저장`}
          </Button>
        </form>
      </div>

      <div className="grid h-[88px] shrink-0 grid-cols-2 gap-4 border-t border-slate-200 px-[25px] py-6">
        <Link href={closeHref} className={footerLinkClass}>
          닫기
        </Link>
        {editHref ? (
          <Link
            href={editHref}
            className={`${footerLinkClass} border-blue-600 bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700`}
          >
            수정
          </Link>
        ) : (
          <Button
            disabled
            variant="primary"
            className="!h-10 !min-h-10 !text-sm"
          >
            수정
          </Button>
        )}
      </div>
    </>
  );
}

function EditStaffPanel({
  closeHref,
  staff,
  stores,
}: {
  closeHref: string;
  staff: AdminStaffDetail;
  stores: AdminStaffPageData["filterOptions"]["stores"];
}) {
  const router = useRouter();
  const [updateState, updateAction, isUpdatePending] = useActionState(
    updateStaffAction,
    initialStaffMutationActionState
  );

  useEffect(() => {
    if (updateState.ok) {
      router.refresh();
    }
  }, [router, updateState.ok]);

  return (
    <form action={updateAction} className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="userId" value={staff.id} />
      <input type="hidden" name="expectedUpdatedAt" value={staff.updatedAt} />

      <div className="min-h-0 flex-1 space-y-[24px] overflow-y-auto px-[25px] pt-[27px] text-sm">
        <MessageBox state={updateState} />

        <DrawerField
          label="이름"
          required
          error={updateState.fieldErrors?.name}
        >
          <TextInput
            name="name"
            defaultValue={staff.name}
            placeholder="이름을 입력하세요"
            disabled={isUpdatePending}
            className={drawerInputClass}
            aria-invalid={updateState.fieldErrors?.name ? "true" : undefined}
          />
        </DrawerField>

        <DrawerField label="아이디 또는 이메일">
          <TextInput
            value={staff.loginId}
            readOnly
            className={drawerInputClass}
          />
        </DrawerField>

        <DrawerField
          label="역할"
          required
          error={updateState.fieldErrors?.role}
        >
          <SelectInput
            name="role"
            defaultValue={staff.role}
            disabled={isUpdatePending}
            className={drawerInputClass}
            aria-invalid={updateState.fieldErrors?.role ? "true" : undefined}
          >
            <option value="ADMIN">관리자</option>
            <option value="STAFF">직원</option>
          </SelectInput>
        </DrawerField>

        <DrawerField
          label="매장"
          required
          error={updateState.fieldErrors?.storeId}
        >
          <SelectInput
            name="storeId"
            defaultValue={staff.storeId ?? ""}
            disabled={isUpdatePending}
            className={drawerInputClass}
            aria-invalid={updateState.fieldErrors?.storeId ? "true" : undefined}
          >
            <option value="">매장 없음</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
                {store.status === "INACTIVE" ? " (비활성)" : ""}
              </option>
            ))}
          </SelectInput>
        </DrawerField>

        <DrawerField
          label="연락처"
          required
          error={updateState.fieldErrors?.phone}
        >
          <TextInput
            name="phone"
            defaultValue={staff.phone ?? ""}
            placeholder="010-1234-5678"
            disabled={isUpdatePending}
            className={drawerInputClass}
            aria-invalid={updateState.fieldErrors?.phone ? "true" : undefined}
          />
        </DrawerField>

        {updateState.fieldErrors?.form ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {updateState.fieldErrors.form}
          </p>
        ) : null}

        <div className="space-y-[13px] rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm font-bold leading-4 text-slate-700">
            활성 여부
          </p>
          <p className="text-sm font-semibold text-slate-700">
            {statusText(staff.status)} 상태입니다. 상태 변경은 상세 화면에서
            사유와 함께 처리합니다.
          </p>
        </div>
      </div>

      <div className="grid h-[88px] shrink-0 grid-cols-2 gap-4 border-t border-slate-200 px-[25px] py-6">
        <Link href={closeHref} className={footerLinkClass}>
          취소
        </Link>
        <Button
          type="submit"
          variant="primary"
          disabled={isUpdatePending}
          className="!h-10 !min-h-10 !text-sm"
        >
          {isUpdatePending ? "저장 중" : "저장"}
        </Button>
      </div>
    </form>
  );
}

export function StaffMutationPanel({
  closeHref,
  editHref,
  kind,
  staff,
  stores,
}: StaffMutationPanelProps) {
  const copy = {
    create: {
      title: "신규 직원 등록",
      description: "직원 정보를 입력하여 새 직원을 등록하세요.",
    },
    detail: {
      title: "직원 상세",
      description: "선택한 직원의 기본 정보를 확인합니다.",
    },
    edit: {
      title: "직원 정보 수정",
      description: "선택한 직원의 기본 정보를 수정합니다.",
    },
  } satisfies Record<StaffDrawerKind, Record<string, string>>;
  const isMissingDetail = kind !== "create" && !staff;

  return (
    <aside
      className="flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden rounded-l-xl border-l border-slate-200 bg-white shadow-xl shadow-slate-300/40 [@media(max-width:1399px)]:fixed [@media(max-width:1399px)]:right-0 [@media(max-width:1399px)]:top-0 [@media(max-width:1399px)]:z-50 [@media(max-width:1399px)]:w-[412px] [@media(max-width:480px)]:w-full"
      aria-label="Drawer panel"
      aria-labelledby="staff-mutation-panel-title"
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
    >
      <div className="flex h-[98px] shrink-0 items-start justify-between border-b border-slate-200 px-[27px] pt-[27px]">
        <div>
          <h2
            id="staff-mutation-panel-title"
            className="text-xl font-bold leading-6 text-slate-950"
          >
            {copy[kind].title}
          </h2>
          <p className="mt-2 text-xs font-medium leading-4 text-slate-500">
            {isMissingDetail
              ? "선택한 직원 상세 데이터를 불러오지 못했습니다."
              : copy[kind].description}
          </p>
        </div>
        <Link
          href={closeHref}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          aria-label={`${copy[kind].title} 닫기`}
        >
          <X className="size-5" aria-hidden />
        </Link>
      </div>

      {kind === "create" ? (
        <CreateStaffPanel closeHref={closeHref} stores={stores} />
      ) : null}
      {isMissingDetail ? <MissingStaffPanel closeHref={closeHref} /> : null}
      {kind === "detail" && staff ? (
        <DetailStaffPanel
          closeHref={closeHref}
          editHref={editHref}
          staff={staff}
        />
      ) : null}
      {kind === "edit" && staff ? (
        <EditStaffPanel closeHref={closeHref} staff={staff} stores={stores} />
      ) : null}
    </aside>
  );
}
