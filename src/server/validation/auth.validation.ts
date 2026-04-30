import { z } from "zod";

export const loginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "이메일을 입력해 주세요.")
    .email("올바른 이메일 형식으로 입력해 주세요.")
    .max(254, "이메일은 254자 이하여야 합니다.")
    .transform((email) => email.toLowerCase()),
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
