import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function main() {
  console.log("Testing fetchPublishedProjects select on remote DB:");
  const res = await client
    .from("projects")
    .select("id,title,slug,client,industry,category,description,cover_url,thumbnail_url,services,project_date,title_ar,description_ar,client_ar,industry_ar,category_ar")
    .eq("published", true);

  console.log("Result error:", res.error);
  console.log("Result data rows count:", res.data?.length);
}

main().catch(console.error);
