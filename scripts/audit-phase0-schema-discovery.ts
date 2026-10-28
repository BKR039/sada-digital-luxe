import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Load env safely
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

// 2. Parse types.ts
function parseTypesFile() {
  const typesPath = path.resolve(process.cwd(), 'src/integrations/supabase/types.ts');
  const content = fs.readFileSync(typesPath, 'utf-8');
  
  // Find tables in public schema
  const tablesMatch = content.match(/public:\s*\{\s*Tables:\s*\{([\s\S]*?)\}\s*Views:/);
  const tables: Record<string, { columns: string[] }> = {};
  if (tablesMatch) {
    const tablesBlock = tablesMatch[1];
    const tableRegex = /([a-zA-Z0-9_]+):\s*\{\s*Row:\s*\{([\s\S]*?)\}\s*Insert:/g;
    let match;
    while ((match = tableRegex.exec(tablesBlock)) !== null) {
      const tableName = match[1];
      const rowBlock = match[2];
      const colRegex = /([a-zA-Z0-9_]+)(\??):\s*([^;\n]+)/g;
      const columns: string[] = [];
      let colMatch;
      while ((colMatch = colRegex.exec(rowBlock)) !== null) {
        columns.push(colMatch[1]);
      }
      tables[tableName] = { columns };
    }
  }

  // Find views in public schema
  const viewsMatch = content.match(/Views:\s*\{([\s\S]*?)\}\s*Functions:/);
  const views: Record<string, { columns: string[] }> = {};
  if (viewsMatch) {
    const viewsBlock = viewsMatch[1];
    const viewRegex = /([a-zA-Z0-9_]+):\s*\{\s*Row:\s*\{([\s\S]*?)\}/g;
    let match;
    while ((match = viewRegex.exec(viewsBlock)) !== null) {
      const viewName = match[1];
      const rowBlock = match[2];
      const colRegex = /([a-zA-Z0-9_]+)(\??):\s*([^;\n]+)/g;
      const columns: string[] = [];
      let colMatch;
      while ((colMatch = colRegex.exec(rowBlock)) !== null) {
        columns.push(colMatch[1]);
      }
      views[viewName] = { columns };
    }
  }

  // Find functions
  const functionsMatch = content.match(/Functions:\s*\{([\s\S]*?)\}\s*Enums:/);
  const functions: Record<string, { args: string[]; returns: string }> = {};
  if (functionsMatch) {
    const fnBlock = functionsMatch[1];
    const fnRegex = /([a-zA-Z0-9_]+):\s*\{\s*Args:\s*\{([\s\S]*?)\}\s*Returns:\s*([^;\n]+)/g;
    let match;
    while ((match = fnRegex.exec(fnBlock)) !== null) {
      const fnName = match[1];
      const argsBlock = match[2];
      const returns = match[3].trim();
      const argRegex = /([a-zA-Z0-9_]+)(\??):\s*([^;\n]+)/g;
      const args: string[] = [];
      let argMatch;
      while ((argMatch = argRegex.exec(argsBlock)) !== null) {
        args.push(argMatch[1]);
      }
      functions[fnName] = { args, returns };
    }
  }

  // Find Enums
  const enumsMatch = content.match(/Enums:\s*\{([\s\S]*?)\}\s*CompositeTypes:/);
  const enums: Record<string, string[]> = {};
  if (enumsMatch) {
    const enumBlock = enumsMatch[1];
    const enumRegex = /([a-zA-Z0-9_]+):\s*([^;\n]+)/g;
    let match;
    while ((match = enumRegex.exec(enumBlock)) !== null) {
      const enumName = match[1];
      const values = match[2].trim().split('|').map(v => v.trim().replace(/^["']|["']$/g, ''));
      enums[enumName] = values;
    }
  }

  return { tables, views, functions, enums };
}

// 3. Parse migrations
function parseMigrations() {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  
  const createdTables = new Set<string>();
  const createdViews = new Set<string>();
  const createdFunctions = new Set<string>();
  const createdPolicies: { table: string; policy: string; cmd?: string }[] = [];
  const createdTriggers: { table: string; trigger: string; fn: string }[] = [];
  const createdIndexes: { index: string; table: string }[] = [];
  const createdTypes: string[] = [];

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    
    // CREATE TABLE
    const ctRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
    let match;
    while ((match = ctRegex.exec(sql)) !== null) {
      createdTables.add(match[1]);
    }

    // CREATE VIEW
    const cvRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
    while ((match = cvRegex.exec(sql)) !== null) {
      createdViews.add(match[1]);
    }

    // CREATE FUNCTION
    const cfRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
    while ((match = cfRegex.exec(sql)) !== null) {
      createdFunctions.add(match[1]);
    }

    // CREATE POLICY
    const cpRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s+FOR\s+([A-Z]+))?/gi;
    while ((match = cpRegex.exec(sql)) !== null) {
      createdPolicies.push({ policy: match[1], table: match[2], cmd: match[3] || 'ALL' });
    }

    // CREATE TRIGGER
    const trgRegex = /CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)\s+[\s\S]*?ON\s+(?:public\.)?([a-zA-Z0-9_]+)[\s\S]*?EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
    while ((match = trgRegex.exec(sql)) !== null) {
      createdTriggers.push({ trigger: match[1], table: match[2], fn: match[3] });
    }

    // CREATE INDEX
    const idxRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
    while ((match = idxRegex.exec(sql)) !== null) {
      createdIndexes.push({ index: match[1], table: match[2] });
    }

    // CREATE TYPE
    const typeRegex = /CREATE\s+TYPE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+AS\s+ENUM/gi;
    while ((match = typeRegex.exec(sql)) !== null) {
      createdTypes.push(match[1]);
    }
  }

  return {
    migrationCount: files.length,
    createdTables: Array.from(createdTables),
    createdViews: Array.from(createdViews),
    createdFunctions: Array.from(createdFunctions),
    createdPolicies,
    createdTriggers,
    createdIndexes,
    createdTypes
  };
}

async function runDiscovery() {
  console.log('=== SADA OS DATABASE INVENTORY & DISCOVERY ===');
  const urlObj = new URL(url);
  console.log('Environment Host:', urlObj.host);
  console.log('Project Ref:', urlObj.hostname.split('.')[0]);

  const parsedTypes = parseTypesFile();
  console.log(`Parsed types.ts: ${Object.keys(parsedTypes.tables).length} tables, ${Object.keys(parsedTypes.views).length} views, ${Object.keys(parsedTypes.functions).length} functions, ${Object.keys(parsedTypes.enums).length} enums`);

  const parsedMigrations = parseMigrations();
  console.log(`Parsed ${parsedMigrations.migrationCount} migrations: ${parsedMigrations.createdTables.length} tables, ${parsedMigrations.createdViews.length} views, ${parsedMigrations.createdFunctions.length} functions, ${parsedMigrations.createdPolicies.length} policies, ${parsedMigrations.createdTriggers.length} triggers, ${parsedMigrations.createdIndexes.length} indexes`);

  // Union of all candidate tables
  const allCandidateTables = Array.from(new Set([
    ...Object.keys(parsedTypes.tables),
    ...parsedMigrations.createdTables
  ])).sort();

  console.log(`Total unique candidate tables to probe: ${allCandidateTables.length}`);

  // Create clients
  const anonClient = createClient(url, anonKey);
  const adminClient = createClient(url, anonKey);

  const authRes = await adminClient.auth.signInWithPassword({
    email: 'qa.superadmin@sada.agency',
    password: 'SuperAdminPassword123!'
  });

  if (authRes.error) {
    console.error('Super Admin sign-in failed:', authRes.error.message);
  } else {
    console.log('Super Admin authenticated:', authRes.data.user.id);
  }

  // Worker client
  const workerClient = createClient(url, anonKey);
  const workerAuth = await workerClient.auth.signInWithPassword({
    email: 'adv.target.test@sada.agency',
    password: 'TestPassword123!'
  });
  if (workerAuth.error) {
    console.log('Worker sign-in note:', workerAuth.error.message);
  } else {
    console.log('Worker authenticated:', workerAuth.data.user.id);
  }

  const tableResults: Record<string, any> = {};

  for (const tableName of allCandidateTables) {
    const inTypes = tableName in parsedTypes.tables;
    const inMigrations = parsedMigrations.createdTables.includes(tableName);
    const typeCols = inTypes ? parsedTypes.tables[tableName].columns : [];

    // Probe as Super Admin
    let exists = false;
    let liveCount: number | null = null;
    let adminError: string | null = null;
    let liveCols: string[] = [];

    try {
      const { data, error, count } = await adminClient
        .from(tableName)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (error) {
        adminError = error.message;
        if (!error.message.includes('does not exist') && !error.message.includes('relation') && !error.message.includes('not found')) {
          exists = true; // Exists but RLS or other condition blocked
        }
      } else {
        exists = true;
        liveCount = count;
        if (data && data.length > 0) {
          liveCols = Object.keys(data[0]);
        }
      }
    } catch (e: any) {
      adminError = e.message;
    }

    // Probe as Anon
    let anonAccessible = false;
    let anonCount: number | null = null;
    try {
      const { data, error, count } = await anonClient
        .from(tableName)
        .select('*', { count: 'exact', head: false })
        .limit(1);
      if (!error) {
        anonAccessible = true;
        anonCount = count;
      }
    } catch {}

    // Probe as Worker
    let workerAccessible = false;
    let workerCount: number | null = null;
    if (workerAuth.data?.user) {
      try {
        const { data, error, count } = await workerClient
          .from(tableName)
          .select('*', { count: 'exact', head: false })
          .limit(1);
        if (!error) {
          workerAccessible = true;
          workerCount = count;
        }
      } catch {}
    }

    tableResults[tableName] = {
      tableName,
      existsInLiveDb: exists,
      inTypes,
      inMigrations,
      liveCount,
      adminError,
      anonAccessible,
      anonCount,
      workerAccessible,
      workerCount,
      typeCols,
      liveCols
    };
  }

  // Also probe views
  const allCandidateViews = Array.from(new Set([
    ...Object.keys(parsedTypes.views),
    ...parsedMigrations.createdViews
  ])).sort();

  const viewResults: Record<string, any> = {};
  for (const viewName of allCandidateViews) {
    let exists = false;
    let count: number | null = null;
    let err: string | null = null;
    try {
      const { data, error, count: c } = await adminClient
        .from(viewName)
        .select('*', { count: 'exact', head: false })
        .limit(1);
      if (!error) {
        exists = true;
        count = c;
      } else {
        err = error.message;
        if (!error.message.includes('does not exist') && !error.message.includes('relation')) {
          exists = true;
        }
      }
    } catch (e: any) {
      err = e.message;
    }
    viewResults[viewName] = {
      viewName,
      existsInLiveDb: exists,
      count,
      error: err,
      inTypes: viewName in parsedTypes.views,
      inMigrations: parsedMigrations.createdViews.includes(viewName)
    };
  }

  // Also probe RPCs
  const allCandidateFunctions = Array.from(new Set([
    ...Object.keys(parsedTypes.functions),
    ...parsedMigrations.createdFunctions
  ])).sort();

  const functionResults: Record<string, any> = {};
  for (const fnName of allCandidateFunctions) {
    const inTypes = fnName in parsedTypes.functions;
    const inMigrations = parsedMigrations.createdFunctions.includes(fnName);
    functionResults[fnName] = {
      fnName,
      inTypes,
      inMigrations,
      args: inTypes ? parsedTypes.functions[fnName].args : [],
      returns: inTypes ? parsedTypes.functions[fnName].returns : 'unknown'
    };
  }

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      host: urlObj.host,
      projectRef: urlObj.hostname.split('.')[0],
      totalCandidateTables: allCandidateTables.length,
      tablesLiveFound: Object.values(tableResults).filter(t => t.existsInLiveDb).length,
      tablesMissingFromLive: Object.values(tableResults).filter(t => !t.existsInLiveDb).length,
      totalCandidateViews: allCandidateViews.length,
      viewsLiveFound: Object.values(viewResults).filter(v => v.existsInLiveDb).length,
      totalFunctions: allCandidateFunctions.length,
      totalMigrations: parsedMigrations.migrationCount,
      totalPoliciesInMigrations: parsedMigrations.createdPolicies.length,
      totalTriggersInMigrations: parsedMigrations.createdTriggers.length,
      totalIndexesInMigrations: parsedMigrations.createdIndexes.length,
      totalEnumsInTypes: Object.keys(parsedTypes.enums).length
    },
    tables: tableResults,
    views: viewResults,
    functions: functionResults,
    policies: parsedMigrations.createdPolicies,
    triggers: parsedMigrations.createdTriggers,
    indexes: parsedMigrations.createdIndexes,
    enums: parsedTypes.enums
  };

  fs.writeFileSync(
    path.resolve(process.cwd(), 'scripts/database_complete_inventory_dump.json'),
    JSON.stringify(output, null, 2)
  );

  console.log('=== DISCOVERY COMPLETED ===');
  console.log(`Live tables found: ${output.meta.tablesLiveFound} / ${output.meta.totalCandidateTables}`);
  console.log(`Live views found: ${output.meta.viewsLiveFound} / ${output.meta.totalCandidateViews}`);
  console.log(`Total functions: ${output.meta.totalFunctions}`);
  console.log('Saved complete dump to scripts/database_complete_inventory_dump.json');
}

runDiscovery().catch(e => console.error('Error running discovery:', e));
