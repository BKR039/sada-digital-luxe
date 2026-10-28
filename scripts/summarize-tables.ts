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
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

async function run() {
  const data = JSON.parse(fs.readFileSync('scripts/database_complete_inventory_dump.json', 'utf-8'));
  const tables = Object.values(data.tables) as any[];

  // Also probe with qa.worker@sada.agency
  const workerClient = createClient(url, anonKey);
  const { data: wAuth, error: wErr } = await workerClient.auth.signInWithPassword({
    email: 'qa.worker@sada.agency',
    password: 'WorkerPassword123!'
  });

  console.log('Worker login:', wAuth?.user?.id ? 'SUCCESS' : 'FAILED', wErr?.message || '');

  const workerAccessibility: Record<string, { accessible: boolean; count: number | null }> = {};
  if (wAuth?.user?.id) {
    for (const t of tables) {
      try {
        const { data: rows, error, count } = await workerClient
          .from(t.tableName)
          .select('*', { count: 'exact', head: false })
          .limit(1);
        workerAccessibility[t.tableName] = {
          accessible: !error,
          count: error ? null : count
        };
      } catch {
        workerAccessibility[t.tableName] = { accessible: false, count: null };
      }
    }
  }

  tables.sort((a, b) => (b.liveCount || 0) - (a.liveCount || 0));

  console.log('=== TABLE INVENTORY SUMMARY (53 TABLES) ===');
  for (const t of tables) {
    const w = workerAccessibility[t.tableName];
    const wStatus = w ? (w.accessible ? `YES (${w.count})` : 'NO') : 'UNCHECKED';
    const aStatus = t.anonAccessible ? `YES (${t.anonCount})` : 'NO';
    console.log(`${t.tableName.padEnd(35)} | SuperAdmin: ${String(t.liveCount).padStart(5)} | Worker: ${wStatus.padEnd(10)} | Anon: ${aStatus}`);
  }

  // Update dump with worker accessibility
  for (const t of tables) {
    if (workerAccessibility[t.tableName]) {
      t.workerAccessible = workerAccessibility[t.tableName].accessible;
      t.workerCount = workerAccessibility[t.tableName].count;
    }
  }
  fs.writeFileSync('scripts/database_complete_inventory_dump.json', JSON.stringify(data, null, 2));
}

run();
