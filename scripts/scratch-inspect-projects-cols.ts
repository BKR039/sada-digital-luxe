import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
const client = createClient(supabaseUrl, anonKey);

async function inspectClientProjects() {
  const { data: auth, error: authErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Logged in as:", auth.user.email);

  const { data, error } = await client.from("client_projects").select("*").limit(1);
  if (error) {
    console.error("Select error:", error);
  } else {
    console.log("client_projects row count:", data.length);
    if (data.length > 0) {
      console.log("ACTUAL client_projects columns in database:", Object.keys(data[0]));
      console.log("Has client_email?", "client_email" in data[0]);
      console.log("Has client_phone?", "client_phone" in data[0]);
      console.log("Sample client_project:", data[0]);
    }
  }
}

inspectClientProjects().catch(console.error);
