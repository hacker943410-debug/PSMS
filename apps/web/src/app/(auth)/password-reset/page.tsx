import { CredentialTokenPage } from "../_components/credential-token-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "비밀번호 재설정",
  description: "비밀번호 재설정",
};

export default function PasswordResetPage() {
  return <CredentialTokenPage purpose="PASSWORD_RESET" />;
}
