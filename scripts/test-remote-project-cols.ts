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
  console.log("Checking columns in remote social_reels table:");
  const testCols = [
    "id", "slug", "instagram_url", "instagram_shortcode", "title", "caption", 
    "thumbnail_url", "category", "display_order", "is_published", "is_featured",
    "created_at", "updated_at", "title_ar", "description_ar", "caption_ar"
  ];
  
  for (const col of testCols) {
    const { data, error } = await client.from("social_reels").select(col).limit(1);
    if (error) {
      console.log(`❌ Column '${col}': FAILED -> ${error.message}`);
    } else {
      console.log(`✓ Column '${col}': EXISTS`);
    }
  }
}

main().catch(console.error);
