import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function auditStorage() {
  console.log("=== AUDITING STORAGE POLICIES ===");
  // Test anonymous upload to team-avatars/
  const testBuffer = Buffer.from("anon upload test");
  const anonFileName = `team-avatars/anon-test-${Date.now()}.png`;

  const { data: anonUpload, error: anonErr } = await supabase.storage.from("media").upload(anonFileName, testBuffer, {
    contentType: "image/png",
  });
  console.log("Anonymous upload result:", { anonUpload, anonErr });

  if (anonUpload?.path) {
    // Cleanup if it succeeded
    await supabase.storage.from("media").remove([anonUpload.path]);
  }
}

auditStorage();
