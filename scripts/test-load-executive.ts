import fs from "fs";
import path from "path";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

async function run() {
  const { supabase } = await import("../src/integrations/supabase/client");

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Logged in user:", auth.user.id, auth.user.email);

  const { fetchManagementAnalytics } = await import("../src/lib/analytics-service");
  try {
    const data = await fetchManagementAnalytics({ periodType: "this_month" });
    console.log("Successfully fetched analytics!");
    console.log("KPIs:", JSON.stringify(data.financeState.kpis, null, 2));
  } catch (err: any) {
    console.error("Failed to fetch analytics:", err.message || err);
  }
}

run();
