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

  const { data: member } = await client.from('team_members').select('*').eq('profile_id', '0964ac3d-bfe1-408f-89fc-b11c49a0a479').maybeSingle();
  console.log("MEMBER 0964:", member);

  const { data: profiles } = await client.from('profiles').select('*').eq('id', '0964ac3d-bfe1-408f-89fc-b11c49a0a479').maybeSingle();
  console.log("PROFILE 0964:", profiles);
}

run();
