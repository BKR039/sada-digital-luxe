import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').replace(/^"|"$/g, '').trim();
});

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  await client.auth.signInWithPassword({
    email: 'qa.superadmin@sada.agency',
    password: 'SuperAdminPassword123!'
  });
  const { data: accounts } = await client.from('profiles').select('id, email, display_name, role, status');
  console.log("PROFILES:", JSON.stringify(accounts, null, 2));

  const { data: userRoles } = await client.from('user_roles').select('*');
  console.log("USER_ROLES:", JSON.stringify(userRoles, null, 2));
}

run();
