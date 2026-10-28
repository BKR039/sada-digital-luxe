import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env');
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || '').trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1]] = val;
    }
  });
}

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function testAuth() {
  console.log('Testing with Service Key present:', !!serviceKey);
  if (serviceKey) {
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        }
      });
      console.log('OpenAPI with service key status:', res.status);
      if (res.ok) {
        const swagger = await res.json();
        const defs = Object.keys(swagger.definitions || {});
        console.log('Defs count with service key:', defs.length);
        fs.writeFileSync(
          path.resolve(process.cwd(), 'scripts/swagger_schema.json'),
          JSON.stringify(swagger, null, 2)
        );
        console.log('Saved swagger_schema.json successfully!');
        return;
      }
    } catch (e: any) {
      console.log('Service key fetch error:', e.message);
    }
  }

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'qa.superadmin@sada.agency',
    password: 'SuperAdminPassword123!'
  });

  if (authErr || !auth?.session) {
    console.error('Super Admin login failed:', authErr?.message);
    return;
  }

  const token = auth.session.access_token;
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`
    }
  });
  console.log('OpenAPI with Super Admin token status:', res.status);
  if (res.ok) {
    const swagger = await res.json();
    console.log('Defs count with Super Admin token:', Object.keys(swagger.definitions || {}).length);
    fs.writeFileSync(
      path.resolve(process.cwd(), 'scripts/swagger_schema.json'),
      JSON.stringify(swagger, null, 2)
    );
    console.log('Saved swagger_schema.json successfully!');
  }
}

testAuth();
