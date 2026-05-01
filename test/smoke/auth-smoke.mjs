const API_BASE_URL = process.env.PSMS_API_URL ?? "http://127.0.0.1:4273";
const WEB_BASE_URL = process.env.PSMS_WEB_URL ?? "http://127.0.0.1:5273";

const ACCOUNTS = {
  admin: {
    loginId: process.env.PSMS_SEED_ADMIN_LOGIN_ID ?? "admin1001",
    password: process.env.PSMS_SEED_ADMIN_PASSWORD ?? "LocalAdmin123!",
    role: "ADMIN",
  },
  staff: {
    loginId: process.env.PSMS_SEED_STAFF_LOGIN_ID ?? "staff1001",
    password: process.env.PSMS_SEED_STAFF_PASSWORD ?? "LocalStaff123!",
    role: "STAFF",
  },
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON response, got: ${text.slice(0, 200)}`);
  }
}

function sessionCookie(sessionToken) {
  return `psms_session=${encodeURIComponent(sessionToken)}`;
}

async function apiJson(path, init) {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const json = await readJson(response);

  return { response, json };
}

async function login(account) {
  const { response, json } = await apiJson("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      loginId: account.loginId,
      password: account.password,
    }),
  });

  assert(
    response.status === 200,
    `${account.role} login returned ${response.status}`
  );
  assert(json.ok === true, `${account.role} login did not return ok:true`);
  assert(json.data?.sessionToken, `${account.role} login missing sessionToken`);
  assert(json.redirectTo === "/", `${account.role} login redirectTo must be /`);

  return json.data.sessionToken;
}

async function assertSession(account, sessionToken) {
  const { response, json } = await apiJson("/auth/session", {
    headers: { cookie: sessionCookie(sessionToken) },
  });

  assert(
    response.status === 200,
    `${account.role} session returned ${response.status}`
  );
  assert(json.ok === true, `${account.role} session did not return ok:true`);
  assert(
    json.data?.session?.loginId === account.loginId,
    `${account.role} session loginId mismatch`
  );
  assert(
    json.data?.session?.role === account.role,
    `${account.role} session role mismatch`
  );
}

async function logout(sessionToken) {
  const { response, json } = await apiJson("/auth/logout", {
    method: "POST",
    headers: { cookie: sessionCookie(sessionToken) },
  });

  assert(response.status === 200, `logout returned ${response.status}`);
  assert(json.ok === true, "logout did not return ok:true");
}

async function assertRevoked(sessionToken) {
  const { response, json } = await apiJson("/auth/session", {
    headers: { cookie: sessionCookie(sessionToken) },
  });

  assert(
    response.status === 401,
    `revoked session returned ${response.status}`
  );
  assert(json.ok === false, "revoked session should return ok:false");
  assert(
    json.code === "AUTH_REQUIRED",
    "revoked session should return AUTH_REQUIRED"
  );
}

async function assertWebLoginPage() {
  const response = await fetch(`${WEB_BASE_URL}/login`);
  const html = await response.text();

  assert(response.status === 200, `web login returned ${response.status}`);
  assert(html.includes('name="loginId"'), "web login missing loginId input");
  assert(
    html.includes(ACCOUNTS.admin.loginId),
    "web login missing admin test account"
  );
  assert(
    html.includes(ACCOUNTS.staff.loginId),
    "web login missing staff test account"
  );
}

async function assertWorkspaceGuard() {
  const response = await fetch(`${WEB_BASE_URL}/`, { redirect: "manual" });

  assert(
    [303, 307, 308].includes(response.status),
    `unauthenticated workspace returned ${response.status}`
  );
  assert(
    response.headers.get("location")?.includes("/login"),
    "unauthenticated workspace should redirect to /login"
  );
}

async function assertRoleGuards(adminToken, staffToken) {
  const adminResponse = await fetch(`${WEB_BASE_URL}/staffs`, {
    headers: { cookie: sessionCookie(adminToken) },
    redirect: "manual",
  });

  assert(
    adminResponse.status === 200,
    `ADMIN /staffs returned ${adminResponse.status}`
  );

  const staffResponse = await fetch(`${WEB_BASE_URL}/staffs`, {
    headers: { cookie: sessionCookie(staffToken) },
    redirect: "manual",
  });

  assert(
    [303, 307, 308].includes(staffResponse.status),
    `STAFF /staffs returned ${staffResponse.status}`
  );
  assert(
    staffResponse.headers.get("location")?.includes("/forbidden"),
    "STAFF /staffs should redirect to /forbidden"
  );
}

const health = await apiJson("/health");
assert(
  health.response.status === 200,
  `health returned ${health.response.status}`
);
assert(health.json.ok === true, "health did not return ok:true");
assert(health.json.port === 4273, "health did not report API port 4273");

const invalidLogin = await apiJson("/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ loginId: "bad-id!", password: "x" }),
});
assert(invalidLogin.response.status === 400, "invalid login should return 400");
assert(
  invalidLogin.json.code === "VALIDATION_FAILED",
  "invalid login should validate"
);

await assertWebLoginPage();
await assertWorkspaceGuard();

const adminToken = await login(ACCOUNTS.admin);
const staffToken = await login(ACCOUNTS.staff);

await assertSession(ACCOUNTS.admin, adminToken);
await assertSession(ACCOUNTS.staff, staffToken);
await assertRoleGuards(adminToken, staffToken);
await logout(adminToken);
await logout(staffToken);
await assertRevoked(adminToken);
await assertRevoked(staffToken);

console.log("auth smoke passed");
