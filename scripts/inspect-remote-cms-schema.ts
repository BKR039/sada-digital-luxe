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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

const client = createClient(supabaseUrl!, anonKey!);

async function main() {
  console.log("=== INSPECTING REMOTE PRODUCTION (READ-ONLY) ===");
  console.log("Target:", supabaseUrl);

  for (const tbl of ["projects", "social_reels", "testimonials"]) {
    console.log(`\nQuerying public.${tbl} (sample read)...`);
    const { data, error, count } = await client
      .from(tbl)
      .select("*", { count: "exact" })
      .limit(2);

    if (error) {
      console.error(`Error querying ${tbl}:`, error.message);
    } else {
      console.log(`Success! Total rows in ${tbl}:`, count);
      if (data && data.length > 0) {
        console.log(`Sample columns from first row of ${tbl}:`, Object.keys(data[0]));
        console.log("First row:", data[0]);
      } else {
        console.log(`Table ${tbl} is currently empty in remote database.`);
      }
    }
  }
}

main().catch(console.error);
