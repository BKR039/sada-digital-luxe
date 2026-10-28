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
  await client.auth.signInWithPassword({
    email: 'qa.superadmin@sada.agency',
    password: 'SuperAdminPassword123!'
  });

  // Query PostgreSQL catalog for public tables and RLS
  const { data, error } = await (client as any).rpc("exec_sql", {
    query: `
      SELECT 
        tablename, 
        rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `
  });
  if (error) {
    console.log("exec_sql error (expected if not present):", error.message);
  } else {
    console.log("Tables:", data);
  }
}

run();
