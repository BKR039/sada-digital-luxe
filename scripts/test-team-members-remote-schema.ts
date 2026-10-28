import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.length > 0 && value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRemoteTeamMembersSchema() {
  console.log("=== CHECKING REMOTE TEAM_MEMBERS SCHEMA & COLUMNS ===");

  const { data, error } = await supabase
    .from("team_members")
    .select("id, name, position, division, specialties, email, is_active, availability_status, profile_id, photo_url, socials, sort_order, published, created_at, updated_at")
    .limit(1);

  if (error) {
    console.error("Error querying team_members table:", error);
  } else {
    console.log("✓ Successfully queried all team_members columns!");
    console.log("Data count:", data?.length);
  }
}

checkRemoteTeamMembersSchema();
