import { CredentialTokenPage } from "../_components/credential-token-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "직원 계정 활성화",
  description: "직원 계정 활성화",
};

export default function StaffActivationPage() {
  return <CredentialTokenPage purpose="STAFF_ACTIVATION" />;
}
