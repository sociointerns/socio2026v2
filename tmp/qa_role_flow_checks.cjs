const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) {
    return result;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

const rootDir = path.resolve(__dirname, "..");
const clientEnv = parseEnvFile(path.join(rootDir, "client", ".env"));
const serverEnv = parseEnvFile(path.join(rootDir, "server", ".env"));

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  clientEnv.NEXT_PUBLIC_SUPABASE_URL ||
  serverEnv.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  serverEnv.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  clientEnv.SUPABASE_SERVICE_ROLE_KEY ||
  serverEnv.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || clientEnv.NEXT_PUBLIC_API_URL || ""
).replace(/\/+$/, "");
const HOME_URL = process.env.QA_HOME_URL || "http://localhost:3000";

assertCondition(Boolean(SUPABASE_URL), "Missing SUPABASE_URL");
assertCondition(Boolean(SUPABASE_ANON_KEY), "Missing SUPABASE_ANON_KEY");
assertCondition(Boolean(SUPABASE_SERVICE_ROLE_KEY), "Missing SUPABASE_SERVICE_ROLE_KEY");
assertCondition(Boolean(API_URL), "Missing NEXT_PUBLIC_API_URL");

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const createdAuthIds = new Set();
const createdEmails = new Set();

function summarizeStatus(ok) {
  return ok ? "PASS" : "FAIL";
}

async function createAuthAndProfile({ email, password, name, scopedRole, isMasterAdmin = false, campus = null }) {
  const createResult = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
    },
  });

  if (createResult.error || !createResult.data?.user?.id) {
    throw new Error(`Failed creating auth user for ${email}: ${createResult.error?.message || "unknown error"}`);
  }

  const authUserId = createResult.data.user.id;
  createdAuthIds.add(authUserId);
  createdEmails.add(lower(email));

  const role = lower(scopedRole);
  const profile = {
    auth_uuid: authUserId,
    email,
    name,
    is_organiser: false,
    is_support: false,
    is_masteradmin: Boolean(isMasterAdmin),
    is_hod: role === "hod",
    is_dean: role === "dean",
    university_role: isMasterAdmin ? "masteradmin" : (role || null),
    department_id: null,
    school_id: null,
    campus: role === "cfo" ? campus : null,
  };

  const upsertResult = await adminClient
    .from("users")
    .upsert(profile, { onConflict: "email" })
    .select("id,email,university_role")
    .single();

  if (upsertResult.error) {
    throw new Error(`Failed creating profile for ${email}: ${upsertResult.error.message}`);
  }

  return {
    authUserId,
    profile: upsertResult.data,
  };
}

async function signInWithPassword(email, password) {
  const signInResult = await anonClient.auth.signInWithPassword({ email, password });
  if (signInResult.error || !signInResult.data?.session) {
    throw new Error(`Failed sign-in for ${email}: ${signInResult.error?.message || "unknown error"}`);
  }

  return signInResult.data.session;
}

async function updateUserRoles({ token, email, payload }) {
  const response = await fetch(`${API_URL}/users/${encodeURIComponent(email)}/roles`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  return {
    status: response.status,
    body,
  };
}

async function fetchRoleScopes(token) {
  const response = await fetch(`${API_URL}/users/role-scopes`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to fetch role scopes: ${body?.error || response.status}`);
  }

  return body;
}

async function cleanupTestUsers() {
  const emails = Array.from(createdEmails);
  for (const email of emails) {
    await adminClient.from("users").delete().eq("email", email);
  }

  for (const authId of createdAuthIds) {
    await adminClient.auth.admin.deleteUser(authId);
  }
}

async function runApiRoleFlowTests() {
  const runResults = [];

  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const masterEmail = `qa.masteradmin.${stamp}@example.com`;
  const targetEmail = `qa.target.${stamp}@example.com`;
  const masterPassword = `Qa_${stamp}_Master#2026`;
  const targetPassword = `Qa_${stamp}_Target#2026`;

  await createAuthAndProfile({
    email: masterEmail,
    password: masterPassword,
    name: "QA Master Admin",
    scopedRole: "masteradmin",
    isMasterAdmin: true,
  });

  await createAuthAndProfile({
    email: targetEmail,
    password: targetPassword,
    name: "QA Target User",
    scopedRole: null,
  });

  const masterSession = await signInWithPassword(masterEmail, masterPassword);
  const token = masterSession.access_token;

  const scopes = await fetchRoleScopes(token);
  const firstDepartmentId = scopes?.departments?.[0]?.id || null;
  const firstSchoolId = scopes?.schools?.[0]?.id || null;
  const firstCampus = scopes?.campuses?.[0] || null;

  assertCondition(Boolean(firstDepartmentId), "No department scope available for HOD test");
  assertCondition(Boolean(firstSchoolId), "No school scope available for Dean test");
  assertCondition(Boolean(firstCampus), "No campus scope available for CFO test");

  const missingDomainCases = [
    {
      name: "HOD missing department",
      payload: {
        is_hod: true,
        is_dean: false,
        is_cfo: false,
        is_finance_officer: false,
        university_role: "hod",
        department_id: null,
        school_id: null,
        campus: null,
      },
      expectedErrorIncludes: "Select a department",
    },
    {
      name: "Dean missing school",
      payload: {
        is_hod: false,
        is_dean: true,
        is_cfo: false,
        is_finance_officer: false,
        university_role: "dean",
        department_id: null,
        school_id: null,
        campus: null,
      },
      expectedErrorIncludes: "Select a school",
    },
    {
      name: "CFO missing campus",
      payload: {
        is_hod: false,
        is_dean: false,
        is_cfo: true,
        is_finance_officer: false,
        university_role: "cfo",
        department_id: null,
        school_id: null,
        campus: null,
      },
      expectedErrorIncludes: "Select a campus",
    },
  ];

  for (const testCase of missingDomainCases) {
    const result = await updateUserRoles({ token, email: targetEmail, payload: testCase.payload });
    const errorText = String(result.body?.error || "");
    const ok = result.status === 400 && errorText.includes(testCase.expectedErrorIncludes);

    runResults.push({
      category: "Admin Users scoped-role validation",
      test: testCase.name,
      ok,
      details: ok
        ? "Expected validation error received"
        : `Unexpected response status=${result.status}, error=${errorText || "<empty>"}`,
    });
  }

  const successCases = [
    {
      name: "Assign HOD with department",
      payload: {
        is_hod: true,
        is_dean: false,
        is_cfo: false,
        is_finance_officer: false,
        university_role: "hod",
        department_id: firstDepartmentId,
        school_id: null,
        campus: null,
      },
      assertUser: (user) =>
        lower(user?.university_role) === "hod" &&
        String(user?.department_id || "") === String(firstDepartmentId) &&
        !user?.school_id &&
        !user?.campus,
    },
    {
      name: "Assign Dean with school",
      payload: {
        is_hod: false,
        is_dean: true,
        is_cfo: false,
        is_finance_officer: false,
        university_role: "dean",
        department_id: null,
        school_id: firstSchoolId,
        campus: null,
      },
      assertUser: (user) =>
        lower(user?.university_role) === "dean" &&
        String(user?.school_id || "") === String(firstSchoolId) &&
        !user?.department_id &&
        !user?.campus,
    },
    {
      name: "Assign CFO with campus",
      payload: {
        is_hod: false,
        is_dean: false,
        is_cfo: true,
        is_finance_officer: false,
        university_role: "cfo",
        department_id: null,
        school_id: null,
        campus: firstCampus,
      },
      assertUser: (user) =>
        lower(user?.university_role) === "cfo" &&
        String(user?.campus || "") === String(firstCampus) &&
        !user?.department_id &&
        !user?.school_id,
    },
    {
      name: "Assign Finance Officer (global)",
      payload: {
        is_hod: false,
        is_dean: false,
        is_cfo: false,
        is_finance_officer: true,
        university_role: "finance_officer",
        department_id: null,
        school_id: null,
        campus: null,
      },
      assertUser: (user) =>
        lower(user?.university_role) === "finance_officer" &&
        !user?.department_id &&
        !user?.school_id &&
        !user?.campus,
    },
  ];

  for (const testCase of successCases) {
    const result = await updateUserRoles({ token, email: targetEmail, payload: testCase.payload });
    const user = result.body?.user;
    const ok = result.status === 200 && testCase.assertUser(user);

    runResults.push({
      category: "Admin Users scoped-role assignment",
      test: testCase.name,
      ok,
      details: ok
        ? "Role saved with expected scope/nullification"
        : `Unexpected response status=${result.status}, university_role=${user?.university_role || "<missing>"}`,
    });
  }

  return { runResults };
}

async function setSupabaseSessionInBrowser(page, session) {
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });

  await page.evaluate(
    async ({ supabaseUrl, anonKey, accessToken, refreshToken }) => {
      const mod = await import("https://esm.sh/@supabase/supabase-js@2");
      const client = mod.createClient(supabaseUrl, anonKey);
      await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    },
    {
      supabaseUrl: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    }
  );

  await page.goto(HOME_URL, { waitUntil: "networkidle" });
}

async function runHomeNavRouteChecks() {
  const results = [];
  const { chromium } = require("playwright");
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const cfoEmail = `qa.cfo.${stamp}@example.com`;
  const financeEmail = `qa.finance.${stamp}@example.com`;
  const cfoPassword = `Qa_${stamp}_Cfo#2026`;
  const financePassword = `Qa_${stamp}_Finance#2026`;

  await createAuthAndProfile({
    email: cfoEmail,
    password: cfoPassword,
    name: "QA CFO User",
    scopedRole: "cfo",
    campus: "Central Campus (Main)",
  });

  await createAuthAndProfile({
    email: financeEmail,
    password: financePassword,
    name: "QA Finance User",
    scopedRole: "finance_officer",
  });

  const cfoSession = await signInWithPassword(cfoEmail, cfoPassword);
  const financeSession = await signInWithPassword(financeEmail, financePassword);

  const browser = await chromium.launch({ headless: true });

  async function verifyRoleRouting({ roleName, session, expectedPath, expectedNavHref }) {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setSupabaseSessionInBrowser(page, session);

      await page.waitForTimeout(2500);

      const navLinkCount = await page.locator(`a[href=\"${expectedNavHref}\"]`).count();
      const hasNavEntry = navLinkCount > 0;

      const openDashboardButton = page.getByRole("button", { name: "Open Dashboard" }).first();
      const hasOpenDashboard = (await openDashboardButton.count()) > 0;

      let routedCorrectly = false;
      let routedUrl = "";

      if (hasOpenDashboard) {
        await Promise.all([
          page.waitForURL((url) => url.pathname.startsWith(expectedPath), { timeout: 15000 }),
          openDashboardButton.click(),
        ]);
        routedUrl = page.url();
        routedCorrectly = routedUrl.includes(expectedPath);
      }

      results.push({
        category: "Home/Nav route entry",
        test: `${roleName} nav entry exists`,
        ok: hasNavEntry,
        details: hasNavEntry ? `Found ${expectedNavHref}` : `Missing ${expectedNavHref}`,
      });

      results.push({
        category: "Home/Nav route entry",
        test: `${roleName} Open Dashboard routes to ${expectedPath}`,
        ok: hasOpenDashboard && routedCorrectly,
        details:
          hasOpenDashboard && routedCorrectly
            ? `Navigated to ${routedUrl}`
            : hasOpenDashboard
              ? `Button existed but route did not match (${routedUrl || "no url"})`
              : "Open Dashboard button not visible",
      });
    } finally {
      await context.close();
    }
  }

  await verifyRoleRouting({
    roleName: "CFO",
    session: cfoSession,
    expectedPath: "/manage/cfo",
    expectedNavHref: "/manage/cfo",
  });

  await verifyRoleRouting({
    roleName: "Finance Officer",
    session: financeSession,
    expectedPath: "/manage/finance",
    expectedNavHref: "/manage/finance",
  });

  await browser.close();
  return { results };
}

(async function main() {
  const report = [];
  let hasFailure = false;

  try {
    const apiReport = await runApiRoleFlowTests();
    report.push(...apiReport.runResults);

    try {
      const navReport = await runHomeNavRouteChecks();
      report.push(...navReport.results);
    } catch (navError) {
      hasFailure = true;
      report.push({
        category: "Home/Nav route entry",
        test: "Browser automation execution",
        ok: false,
        details: navError instanceof Error ? navError.message : String(navError),
      });
    }
  } catch (error) {
    hasFailure = true;
    report.push({
      category: "Role QA execution",
      test: "Test harness run",
      ok: false,
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    try {
      await cleanupTestUsers();
    } catch (cleanupError) {
      hasFailure = true;
      report.push({
        category: "Cleanup",
        test: "Remove temporary QA users",
        ok: false,
        details: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }
  }

  for (const row of report) {
    const status = summarizeStatus(row.ok);
    console.log(`[${status}] ${row.category} :: ${row.test} :: ${row.details}`);
    if (!row.ok) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
})();
