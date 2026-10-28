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

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await client.auth.signInWithPassword({
    email: 'adv.target.test@sada.agency',
    password: 'AdvTargetPass2026!#'
  });
  if (error) {
    console.error('Sign in error:', error);
    return;
  }
  const token = data.session?.access_token;
  if (!token) {
    console.log('No token');
    return;
  }
  const { data: rpcData, error: rpcErr } = await client.rpc("verify_session_and_account", {
    _session_id: "test"
  });
  console.log("verify_session_and_account result:", rpcData, rpcErr);

  // Let's also check what auth.uid() and auth.jwt() return via an RPC or query
  const { data: profData, error: profErr } = await client
    .from("profiles")
    .select("id, email, status")
    .eq("id", data.session?.user?.id)
    .single();
  console.log("Profiles query with JWT:", profData, profErr);
}

run();
