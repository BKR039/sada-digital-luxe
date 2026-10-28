import fs from 'fs';
import path from 'path';

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

async function probe() {
  const parsed = new URL(url);
  console.log('Target host:', parsed.host);
  console.log('Project reference:', parsed.hostname.split('.')[0]);

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    console.log('OpenAPI endpoint status:', res.status, res.statusText);
    if (res.ok) {
      const swagger = await res.json();
      console.log('Swagger/OpenAPI title:', swagger.info?.title);
      console.log('Swagger/OpenAPI version:', swagger.info?.version);
      const definitions = swagger.definitions ? Object.keys(swagger.definitions) : [];
      console.log('Total definitions found:', definitions.length);
      const paths = swagger.paths ? Object.keys(swagger.paths) : [];
      console.log('Total paths found:', paths.length);
      fs.writeFileSync(
        path.resolve(process.cwd(), 'scripts/openapi_dump_summary.json'),
        JSON.stringify({ definitions, paths: paths.filter(p => p.startsWith('/rpc/')) }, null, 2)
      );
      console.log('Wrote summary to scripts/openapi_dump_summary.json');
    }
  } catch (err: any) {
    console.error('Probe failed:', err.message);
  }
}

probe();
