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

const GENERAL_WORKSPACE_ROUTES = [
  "/",
  "/sales",
  "/sales/new",
  "/receivables",
  "/customers",
  "/schedule",
  "/inventory",
  "/reports/summary",
];

const ADMIN_ONLY_ROUTES = ["/staffs", "/settings/base", "/settings/policies"];

const ADMIN_ONLY_HREFS = ["/staffs", "/settings/base", "/settings/policies"];
const STAFF_VISIBLE_HREFS = [
  "/sales",
  "/receivables",
  "/customers",
  "/schedule",
  "/inventory",
];

let requestSequence = 0;

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

  return json.data.sessionToken;
}

async function logout(sessionToken) {
  const { response, json } = await apiJson("/auth/logout", {
    method: "POST",
    headers: { cookie: sessionCookie(sessionToken) },
  });

  assert(response.status === 200, `logout returned ${response.status}`);
  assert(json.ok === true, "logout did not return ok:true");
}

function isRedirectStatus(status) {
  return [303, 307, 308].includes(status);
}

async function fetchWeb(path, sessionToken) {
  const url = new URL(path, WEB_BASE_URL);
  url.searchParams.set("__smoke", `${Date.now()}-${requestSequence++}`);
  const headers = sessionToken
    ? { cookie: sessionCookie(sessionToken) }
    : undefined;

  return fetch(url, {
    headers,
    redirect: "manual",
  });
}

function getAsideHtml(html) {
  const aside = html.match(/<aside\b[\s\S]*?<\/aside>/i)?.[0];

  assert(aside, "workspace response missing sidebar aside");

  return aside;
}

function includesHref(html, href) {
  return html.includes(`href="${href}"`) || html.includes(`href=\\"${href}\\"`);
}

async function assertRedirectsTo(path, targetPath, sessionToken) {
  const response = await fetchWeb(path, sessionToken);
  const location = response.headers.get("location");

  assert(
    isRedirectStatus(response.status),
    `${path} returned ${response.status}, expected redirect`
  );
  assert(
    location?.includes(targetPath),
    `${path} should redirect to ${targetPath}, got ${location}`
  );
}

async function assertRouteOk(path, sessionToken, label) {
  const response = await fetchWeb(path, sessionToken);

  assert(
    response.status === 200,
    `${label} ${path} returned ${response.status}`
  );

  return response.text();
}

async function assertUnauthenticatedWorkspaceRoutes() {
  for (const path of [...GENERAL_WORKSPACE_ROUTES, ...ADMIN_ONLY_ROUTES]) {
    await assertRedirectsTo(path, "/login");
  }
}

async function assertGeneralRoutesForRole(role, sessionToken) {
  for (const path of GENERAL_WORKSPACE_ROUTES) {
    await assertRouteOk(path, sessionToken, role);
  }
}

async function assertAdminOnlyRoutes(adminToken, staffToken) {
  for (const path of ADMIN_ONLY_ROUTES) {
    await assertRouteOk(path, adminToken, "ADMIN");
    await assertRedirectsTo(path, "/forbidden", staffToken);
  }
}

async function assertSidebarVisibility(adminToken, staffToken) {
  const adminAside = getAsideHtml(
    await assertRouteOk("/", adminToken, "ADMIN sidebar")
  );
  const staffAside = getAsideHtml(
    await assertRouteOk("/", staffToken, "STAFF sidebar")
  );

  for (const href of ADMIN_ONLY_HREFS) {
    assert(includesHref(adminAside, href), `ADMIN sidebar missing ${href}`);
    assert(
      !includesHref(staffAside, href),
      `STAFF sidebar should not include ${href}`
    );
  }

  for (const href of STAFF_VISIBLE_HREFS) {
    assert(includesHref(staffAside, href), `STAFF sidebar missing ${href}`);
  }
}

const health = await apiJson("/health");
assert(
  health.response.status === 200,
  `health returned ${health.response.status}`
);
assert(health.json.ok === true, "health did not return ok:true");
assert(health.json.port === 4273, "health did not report API port 4273");

await assertUnauthenticatedWorkspaceRoutes();

const adminToken = await login(ACCOUNTS.admin);
const staffToken = await login(ACCOUNTS.staff);

try {
  await assertGeneralRoutesForRole("ADMIN", adminToken);
  await assertGeneralRoutesForRole("STAFF", staffToken);
  await assertAdminOnlyRoutes(adminToken, staffToken);
  await assertSidebarVisibility(adminToken, staffToken);
} finally {
  await logout(adminToken);
  await logout(staffToken);
}

console.log("web route guard smoke passed");
