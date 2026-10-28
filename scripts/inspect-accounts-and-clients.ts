import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
let url = "";
let key = "";
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim().replace(/^["']|["']$/g, "");
    if (match[1] === "VITE_SUPABASE_URL" || match[1] === "SUPABASE_URL") url = value;
    if (match[1] === "VITE_SUPABASE_PUBLISHABLE_KEY" || match[1] === "SUPABASE_PUBLISHABLE_KEY") key = value;
  }
});

const client = createClient(url, key);

async function run() {
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: cSample } = await client.from("clients").select("*").limit(1);
  console.log("CLIENT COLS:", cSample && cSample[0] ? Object.keys(cSample[0]) : []);

  const { data: incSample } = await client.from("income_transactions").select("*").limit(1);
  console.log("INCOME COLS:", incSample && incSample[0] ? Object.keys(incSample[0]) : []);

  const { data: expSample } = await client.from("expense_transactions").select("*").limit(1);
  console.log("EXPENSE COLS:", expSample && expSample[0] ? Object.keys(expSample[0]) : []);

  const { data: invSample } = await client.from("invoices").select("*").limit(1);
  console.log("INVOICE COLS:", invSample && invSample[0] ? Object.keys(invSample[0]) : []);

  const { data: sponSample } = await client.from("sponsoring_campaigns").select("*").limit(1);
  console.log("SPONSORING COLS:", sponSample && sponSample[0] ? Object.keys(sponSample[0]) : []);

  // accounts only

  // End of run
}

run().catch(console.error);
