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
  await client.auth.signInWithPassword({
    email: 'sec.admin@sada.agency',
    password: 'AdminPassword123!'
  });
  const { data: profiles } = await client.from('profiles').select('email, role, status').eq('role', 'worker').limit(5);
  console.log("WORKER PROFILES:", profiles);
}

run();
