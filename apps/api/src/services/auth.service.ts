import { prisma } from "@psms/db";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  recordFailedLogin,
} from "../auth/login-rate-limit";
import {
  createSessionExpiresAt,
  generateSessionToken,
  hashSessionToken,
} from "@psms/shared/session-token";
import { verifyPassword } from "@psms/shared/password";
import { createAuditLog } from "../repositories/audit-log.repository";
import {
  createSession,
  findSessionByTokenHash,
  revokeActiveSessionsForUser,
  revokeSessionByTokenHash,
} from "../repositories/session.repository";
import {
  findUserForLoginByLoginId,
  updateUserLastLoginAt,
} from "../repositories/user.repository";
import type { LoginInput, SessionContext } from "@psms/shared";

const GENERIC_LOGIN_FAILURE = "계정 또는 비밀번호를 확인해 주세요.";
const RATE_LIMITED_LOGIN_FAILURE =
  "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.";
const DUMMY_PASSWORD_HASH =
  "scrypt$N=16384,r=8,p=1$WGBrdQGtLoNzWH-kqzSC_g$9-EeWCcF-oZhfeXMBUXByLneQn-5_ZyHbr9MWkZsiw6WIHhl9VIvBLizcIZWiVMbA2wP8hjKVj3o2vNBGz94Yg";

export type AuthRequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

type LoginSuccess = {
  ok: true;
  sessionToken: string;
  expiresAt: Date;
  session: SessionContext;
  redirectTo: string;
};

type LoginFailure =
  | {
      ok: false;
      code: "FORBIDDEN";
      message: string;
    }
  | {
      ok: false;
      code: "RATE_LIMITED";
      message: string;
      retryAfterSeconds: number;
    };

export type LoginResult = LoginSuccess | LoginFailure;

function isUsableSessionUser(user: {
  role: "ADMIN" | "STAFF";
  status: "ACTIVE" | "INACTIVE";
  storeId: string | null;
}) {
  return user.status === "ACTIVE" && (user.role === "ADMIN" || user.storeId);
}

function toSessionContext(input: {
  sessionId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "STAFF";
    status: "ACTIVE" | "INACTIVE";
    storeId: string | null;
  };
}): SessionContext {
  return {
    sessionId: input.sessionId,
    userId: input.user.id,
    role: input.user.role,
    storeId: input.user.storeId,
    loginId: input.user.email,
    name: input.user.name,
    status: input.user.status,
  };
}

async function auditLoginFailure(
  actorUserId: string | null,
  reason: string,
  metadata: AuthRequestMetadata
) {
  await createAuditLog(prisma, {
    actorUserId,
    action: "AUTH_LOGIN_FAILED",
    entityType: "AuthSession",
    reason,
    afterJson: { reason },
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

export async function loginWithCredentials(
  input: LoginInput,
  metadata: AuthRequestMetadata
): Promise<LoginResult> {
  const rateLimit = checkLoginRateLimit(input.loginId, metadata.ipAddress);

  if (!rateLimit.allowed) {
    await auditLoginFailure(null, "RATE_LIMITED", metadata);

    return {
      ok: false,
      code: "RATE_LIMITED",
      message: RATE_LIMITED_LOGIN_FAILURE,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const user = await findUserForLoginByLoginId(prisma, input.loginId);
  const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await verifyPassword(input.password, passwordHash);
  const userAllowed = user ? isUsableSessionUser(user) : false;

  if (!user || !passwordMatches || !userAllowed) {
    recordFailedLogin(input.loginId, metadata.ipAddress);
    await auditLoginFailure(user?.id ?? null, "INVALID_CREDENTIALS", metadata);

    return {
      ok: false,
      code: "FORBIDDEN",
      message: GENERIC_LOGIN_FAILURE,
    };
  }

  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);
  const now = new Date();
  const expiresAt = createSessionExpiresAt(now);

  const loginSession = await prisma.$transaction(async (tx) => {
    const freshUser = await findUserForLoginByLoginId(tx, input.loginId);

    if (!freshUser || !isUsableSessionUser(freshUser)) {
      await createAuditLog(tx, {
        actorUserId: freshUser?.id ?? user.id,
        action: "AUTH_LOGIN_FAILED",
        entityType: "AuthSession",
        reason: "USER_NOT_ACTIVE",
        afterJson: { reason: "USER_NOT_ACTIVE" },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      return null;
    }

    await revokeActiveSessionsForUser(tx, freshUser.id, now);

    const createdSession = await createSession(tx, {
      userId: freshUser.id,
      sessionTokenHash,
      expiresAt,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    await updateUserLastLoginAt(tx, freshUser.id, now);

    await createAuditLog(tx, {
      actorUserId: freshUser.id,
      action: "AUTH_LOGIN_SUCCEEDED",
      entityType: "AuthSession",
      entityId: createdSession.id,
      afterJson: {
        sessionId: createdSession.id,
        expiresAt: expiresAt.toISOString(),
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      createdSession,
      user: freshUser,
    };
  });

  if (!loginSession) {
    recordFailedLogin(input.loginId, metadata.ipAddress);

    return {
      ok: false,
      code: "FORBIDDEN",
      message: GENERIC_LOGIN_FAILURE,
    };
  }

  clearLoginFailures(input.loginId, metadata.ipAddress);

  return {
    ok: true,
    sessionToken,
    expiresAt,
    session: toSessionContext({
      sessionId: loginSession.createdSession.id,
      user: loginSession.user,
    }),
    redirectTo: "/",
  };
}

export async function getSessionByTokenHash(sessionTokenHash: string) {
  const session = await findSessionByTokenHash(prisma, sessionTokenHash);

  if (!session) {
    return null;
  }

  if (
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !isUsableSessionUser(session.user)
  ) {
    return null;
  }

  return toSessionContext({
    sessionId: session.id,
    user: session.user,
  });
}

export async function logoutByTokenHash(
  sessionTokenHash: string,
  metadata: AuthRequestMetadata
) {
  const session = await findSessionByTokenHash(prisma, sessionTokenHash);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await revokeSessionByTokenHash(tx, sessionTokenHash, now);

    if (session) {
      await createAuditLog(tx, {
        actorUserId: session.user.id,
        action: "AUTH_LOGOUT",
        entityType: "AuthSession",
        entityId: session.id,
        afterJson: { sessionId: session.id },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
    }
  });
}
