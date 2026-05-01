export type SessionRole = "ADMIN" | "STAFF";
export type SessionUserStatus = "ACTIVE" | "INACTIVE";

export type SessionContext = {
  sessionId: string;
  userId: string;
  role: SessionRole;
  storeId: string | null;
  loginId: string;
  name: string;
  status: SessionUserStatus;
};
