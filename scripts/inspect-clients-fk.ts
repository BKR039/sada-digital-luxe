import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((l) => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[m[1]] = val;
    process.env[m[1]] = val;
  }
});

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function inspectForeignKeys() {
  console.log("=== CHECKING ALL FOREIGN KEYS ON public.clients ===");
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  // Query PostgreSQL constraints on clients
  const { data, error } = await (client as any).rpc("admin_inspect_table_constraints", {
    _table_name: "clients",
  });

  if (error) {
    console.log("RPC admin_inspect_table_constraints not found, trying query via migrations inspection...");
  } else {
    console.log("Constraints:", data);
  }
}

inspectForeignKeys().catch(console.error);
