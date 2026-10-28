import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env');
const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
const env: Record<string, string> = {};
for (const line of lines) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const superClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
const advClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function testPostgrestWithRevokedSession() {
  console.log("1. Authenticating Super Admin and Adversary...");
  await superClient.auth.signInWithPassword({
    email: 'qa.superadmin@sada.agency',
    password: 'SuperAdminPassword123!'
  });

  const { data: advAuth, error: advAuthErr } = await advClient.auth.signInWithPassword({
    email: 'adv.target.test@sada.agency',
    password: 'AdvTargetPass2026!#'
  });
  if (advAuthErr) {
    console.error("Adversary auth error:", advAuthErr);
    return;
  }
  const advUser = advAuth.user!;
  const advToken = advAuth.session!.access_token;
  const payload = JSON.parse(Buffer.from(advToken.split('.')[1], 'base64').toString('utf-8'));
  const jwtSessionId = payload.session_id;

  console.log("Adversary User ID:", advUser.id);
  console.log("Adversary JWT session_id:", jwtSessionId);

  // Register session with jwtSessionId
  const regRes = await (advClient as any).rpc("register_user_session", {
    _session_id: jwtSessionId,
    _device_type: "desktop",
    _browser_name: "Test Browser"
  });
  console.log("Register session result:", regRes);

  // Now Super Admin revokes this session
  const revokeRes = await (superClient as any).rpc("admin_revoke_session", {
    _session_id: jwtSessionId,
    _reason: "Testing direct PostgREST access on revoked session"
  });
  console.log("Super Admin revoked session:", revokeRes);

  // Now, using advClient (holding the unexpired JWT of the revoked session), attempt direct PostgREST reads!
  console.log("\n--- Testing Direct PostgREST Reads using Unexpired JWT of Revoked Session ---");

  const tables = [
    "clients",
    "deals",
    "invoices",
    "project_tasks",
    "salary_records",
    "system_audit_logs",
    "security_alerts",
    "business_rules"
  ];

  for (const table of tables) {
    const { data, error, status } = await advClient
      .from(table)
      .select("*")
      .limit(2);
    console.log(`Table '${table}': status=${status}, rows=${data?.length ?? 0}, error=${error?.message || 'none'}`);
  }

  // Also attempt direct PostgREST write (insert)
  console.log("\n--- Testing Direct PostgREST Writes using Unexpired JWT of Revoked Session ---");
  const { data: insData, error: insErr, status: insStatus } = await advClient
    .from("project_tasks")
    .insert({
      title: "Malicious Task on Revoked Session",
      status: "todo"
    })
    .select();
  console.log(`Direct INSERT on 'project_tasks': status=${insStatus}, rows=${insData?.length ?? 0}, error=${insErr?.message || 'none'}`);
}

testPostgrestWithRevokedSession();
