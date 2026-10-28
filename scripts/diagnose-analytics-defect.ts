import fs from "fs";
import path from "path";

// Load .env first
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || "").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

import { supabase } from "../src/integrations/supabase/client";
import {
  fetchUserModulePermissions,
  updateAccountPermissions,
  fetchAccounts,
} from "../src/lib/account-service";
import {
  getEffectiveModulePermission,
  getEffectiveActionPermission,
  hasPermission,
  resolveModuleFromPath,
} from "../src/types/permissions";
import { evaluateRouteAccess } from "../src/lib/security-isolation-service";

async function diagnose() {
  console.log("=== STEP 1: Authenticate Super Admin ===");
  const { data: saAuth, error: saAuthErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (saAuthErr) {
    console.error("Super Admin auth error:", saAuthErr);
    return;
  }
  console.log("Super Admin logged in:", saAuth.user.id);

  console.log("\n=== STEP 2: Find BKR039 ===");
  const accounts = await fetchAccounts();
  const bkr = accounts.find((a: any) =>
    a.display_name === "BKR039" ||
    a.email === "boubakarhamedsgail@gmail.com" ||
    (a.full_name && a.full_name.includes("BKR039"))
  );
  if (!bkr) {
    console.error("BKR039 not found in accounts directory! Available accounts:", accounts.map((a: any) => ({ id: a.user_id, email: a.email, name: a.display_name, role: a.role })));
    return;
  }
  console.log("Target BKR039 found:", {
    user_id: bkr.user_id,
    email: bkr.email,
    display_name: bkr.display_name,
    role: bkr.role,
    status: bkr.status,
  });

  console.log("\n=== STEP 3: Check Current Database Rows for BKR039 ===");
  const { data: umpRows, error: umpErr } = await (supabase as any)
    .from("user_module_permissions")
    .select("*")
    .eq("user_id", bkr.user_id);
  console.log("public.user_module_permissions rows:", umpRows, "error:", umpErr);

  const { data: profRow, error: profErr } = await (supabase as any)
    .from("profiles")
    .select("id, module_permissions")
    .eq("id", bkr.user_id)
    .single();
  console.log("public.profiles row:", profRow, "error:", profErr);

  console.log("\n=== STEP 4: fetchUserModulePermissions(bkr.user_id) ===");
  const fetchedPerms = await fetchUserModulePermissions(bkr.user_id);
  console.log("fetchUserModulePermissions result:", JSON.stringify(fetchedPerms, null, 2));

  console.log("\n=== STEP 5: Permission Resolution Checks ===");
  const effectiveMod = getEffectiveModulePermission("analytics", bkr.role, fetchedPerms);
  const effectiveAct = getEffectiveActionPermission("analytics", "view", bkr.role, fetchedPerms);
  const hasView = hasPermission("analytics.view", bkr.role, fetchedPerms);
  console.log("getEffectiveModulePermission('analytics'):", effectiveMod);
  console.log("getEffectiveActionPermission('analytics', 'view'):", effectiveAct);
  console.log("hasPermission('analytics.view'):", hasView);

  console.log("\n=== STEP 6: evaluateRouteAccess('/admin/analytics') ===");
  const secCtx: any = {
    authenticated: true,
    userId: bkr.user_id,
    email: bkr.email,
    role: bkr.role,
    status: bkr.status,
    effectivePermissions: {
      analytics: effectiveMod,
    },
    customOverrides: fetchedPerms || undefined,
  };
  const routeEval = evaluateRouteAccess("/admin/analytics", secCtx);
  console.log("evaluateRouteAccess('/admin/analytics'):", routeEval);
}

diagnose().catch(console.error);
