import { z } from "zod";

const LOGIN_ID_PATTERN = /^[a-z0-9]+$/;

export const loginInputSchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(1, "아이디를 입력해 주세요.")
    .min(4, "아이디는 4자 이상이어야 합니다.")
    .max(32, "아이디는 32자 이하여야 합니다.")
    .transform((loginId) => loginId.toLowerCase())
    .refine(
      (loginId) => LOGIN_ID_PATTERN.test(loginId),
      "아이디는 영문 소문자와 숫자만 사용할 수 있습니다."
    ),
  password: z
    .string()
    .min(1, "비밀번호를 입력해 주세요.")
    .max(256, "비밀번호는 256자 이하여야 합니다."),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export function toFieldErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");

    if (!fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}
