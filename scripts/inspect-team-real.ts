import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
const client = createClient(supabaseUrl, anonKey);

async function inspectTeam() {
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: team } = await client.from("team_members").select("id, name, email, role, is_active, created_at");
  console.log(`Total Team Members: ${team?.length || 0}`);
  
  // Find members that do NOT look like synthetic auto-generated test emails
  const nonSynthetic = team?.filter(t => 
    !t.email?.includes("test") && 
    !t.email?.includes(".ops.") && 
    !t.email?.includes(".user.") &&
    !t.email?.match(/\d{10,}/)
  );

  console.log(`Non-synthetic-looking team members (${nonSynthetic?.length || 0}):`);
  for (const m of nonSynthetic || []) {
    console.log(`  - [${m.id}] "${m.name}" <${m.email}> | role=${m.role} | active=${m.is_active} | created=${m.created_at}`);
  }
}

inspectTeam().catch(console.error);
