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

async function testStorage() {
  console.log("Testing Supabase Storage...");
  const { data: buckets, error: bError } = await supabase.storage.listBuckets();
  console.log("Buckets:", { buckets, bError });

  // Test list files in media bucket
  const { data: files, error: fError } = await supabase.storage.from("media").list("");
  console.log("Files in media bucket:", { files, fError });

  // Test uploading a small buffer to team-avatars/test.txt
  const buffer = Buffer.from("test image content");
  const testPath = `team-avatars/test-${Date.now()}.txt`;
  const { data: uploadData, error: uError } = await supabase.storage.from("media").upload(testPath, buffer, {
    contentType: "text/plain",
    upsert: true,
  });
  console.log("Upload result:", { uploadData, uError });

  if (uploadData?.path) {
    const { data: urlData } = supabase.storage.from("media").getPublicUrl(uploadData.path);
    console.log("Public URL:", urlData.publicUrl);

    // Clean up test file
    const { error: delError } = await supabase.storage.from("media").remove([uploadData.path]);
    console.log("Cleanup result:", { delError });
  }
}

testStorage();
