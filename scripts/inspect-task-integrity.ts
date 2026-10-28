import fs from "fs";

if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf-8");
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

import { supabase } from "../src/integrations/supabase/client";

async function main() {
  const { data, error } = await (supabase as any)
    .from("service_commitments")
    .select("*")
    .limit(5);

  console.log("service_commitments query error:", error, "rows:", data?.length);

  const { data: delivData, error: delivErr } = await (supabase as any)
    .from("client_deliverables")
    .select("*")
    .limit(5);

  console.log("client_deliverables query error:", delivErr, "rows:", delivData?.length);
}

main().catch(console.error);
