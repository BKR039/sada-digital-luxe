import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').replace(/^"|"$/g, '').trim();
});

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await client.auth.signInWithPassword({
    email: 'phase1.tester@sada.agency',
    password: 'Phase1TestPassword123!'
  });
  if (error) {
    console.error("Login failed:", error.message);
    return;
  }
  console.log("Logged in user id:", data.user.id);
  const { data: userRoles } = await client.from('user_roles').select('role').eq('user_id', data.user.id);
  console.log("user_roles:", userRoles);
  const { data: member } = await client.from('team_members').select('role').eq('profile_id', data.user.id).maybeSingle();
  console.log("team_members role:", member);
}

run();
