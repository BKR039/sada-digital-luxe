import fs from 'fs';
import path from 'path';

// Parse all SQL files in supabase/migrations
const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultVal: string | null;
  isPk?: boolean;
}

interface TableDDL {
  name: string;
  schema: string;
  columns: Record<string, ColumnDef>;
  pk: string[];
  fks: Array<{ name: string; column: string; targetTable: string; targetColumn: string }>;
  uniques: Array<{ name: string; columns: string[] }>;
  checks: Array<{ name: string; expr: string }>;
  indexes: Array<{ name: string; unique: boolean; columns: string }>;
  triggers: Array<{ name: string; timing: string; events: string; fn: string }>;
  rlsEnabled: boolean;
  policies: Array<{ name: string; cmd: string; roles: string[]; using: string; withCheck: string }>;
}

const tables: Record<string, TableDDL> = {};
const functions: Record<string, {
  name: string;
  args: string;
  returns: string;
  securityDefiner: boolean;
  sqlBodyPreview: string;
  files: string[];
}> = {};
const views: Record<string, { name: string; definition: string; files: string[] }> = {};
const storageBuckets: Record<string, { name: string; isPublic: boolean; policies: string[] }> = {};

function initTable(tableName: string): TableDDL {
  if (!tables[tableName]) {
    tables[tableName] = {
      name: tableName,
      schema: 'public',
      columns: {},
      pk: [],
      fks: [],
      uniques: [],
      checks: [],
      indexes: [],
      triggers: [],
      rlsEnabled: false,
      policies: []
    };
  }
  return tables[tableName];
}

console.log(`Processing ${migrationFiles.length} migration files...`);

for (const file of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

  // 1. CREATE TABLE
  // Match CREATE TABLE [IF NOT EXISTS] (public.)tableName (...)
  const ctRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
  let match;
  while ((match = ctRegex.exec(sql)) !== null) {
    const tblName = match[1];
    const body = match[2];
    const tbl = initTable(tblName);

    // Parse column definitions and table-level constraints inside body
    const lines = body.split(/,\r?\n/);
    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.toUpperCase().startsWith('PRIMARY KEY') || line.toUpperCase().startsWith('CONSTRAINT') && line.toUpperCase().includes('PRIMARY KEY')) {
        const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          tbl.pk = pkMatch[1].split(',').map(s => s.trim().replace(/"/g, ''));
        }
        continue;
      }

      if (line.toUpperCase().startsWith('FOREIGN KEY') || (line.toUpperCase().startsWith('CONSTRAINT') && line.toUpperCase().includes('FOREIGN KEY'))) {
        const fkMatch = line.match(/(?:CONSTRAINT\s+"?([a-zA-Z0-9_]+)"?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
        if (fkMatch) {
          tbl.fks.push({
            name: fkMatch[1] || `fk_${tblName}_${fkMatch[2]}`,
            column: fkMatch[2].replace(/"/g, '').trim(),
            targetTable: fkMatch[3].trim(),
            targetColumn: fkMatch[4].replace(/"/g, '').trim()
          });
        }
        continue;
      }

      if (line.toUpperCase().startsWith('UNIQUE') || (line.toUpperCase().startsWith('CONSTRAINT') && line.toUpperCase().includes('UNIQUE'))) {
        const uqMatch = line.match(/(?:CONSTRAINT\s+"?([a-zA-Z0-9_]+)"?\s+)?UNIQUE\s*\(([^)]+)\)/i);
        if (uqMatch) {
          tbl.uniques.push({
            name: uqMatch[1] || `uq_${tblName}`,
            columns: uqMatch[2].split(',').map(s => s.trim().replace(/"/g, ''))
          });
        }
        continue;
      }

      if (line.toUpperCase().startsWith('CHECK') || (line.toUpperCase().startsWith('CONSTRAINT') && line.toUpperCase().includes('CHECK'))) {
        const chkMatch = line.match(/(?:CONSTRAINT\s+"?([a-zA-Z0-9_]+)"?\s+)?CHECK\s*\(([\s\S]+)\)/i);
        if (chkMatch) {
          tbl.checks.push({
            name: chkMatch[1] || `chk_${tblName}`,
            expr: chkMatch[2].trim()
          });
        }
        continue;
      }

      // Column definition
      const colMatch = line.match(/^"?([a-zA-Z0-9_]+)"?\s+([a-zA-Z0-9_\[\]]+(?:\([^)]+\))?)([\s\S]*)$/i);
      if (colMatch) {
        const colName = colMatch[1];
        const colType = colMatch[2];
        const rest = colMatch[3] || '';
        const isNotNull = /NOT\s+NULL/i.test(rest);
        const isPk = /PRIMARY\s+KEY/i.test(rest);
        const defaultMatch = rest.match(/DEFAULT\s+([^,;]+)/i);

        tbl.columns[colName] = {
          name: colName,
          type: colType,
          nullable: !isNotNull && !isPk,
          defaultVal: defaultMatch ? defaultMatch[1].trim() : null,
          isPk: isPk
        };
        if (isPk && !tbl.pk.includes(colName)) {
          tbl.pk.push(colName);
        }

        // Inline references
        const inlineFk = rest.match(/REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s*\(([^)]+)\))?/i);
        if (inlineFk) {
          tbl.fks.push({
            name: `fk_${tblName}_${colName}`,
            column: colName,
            targetTable: inlineFk[1],
            targetColumn: inlineFk[2] ? inlineFk[2].trim() : 'id'
          });
        }
      }
    }
  }

  // 2. ALTER TABLE ADD COLUMN
  const addColRegex = /ALTER\s+TABLE(?:\s+ONLY)?\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?\s+([a-zA-Z0-9_\[\]]+(?:\([^)]+\))?)([\s\S]*?);/gi;
  while ((match = addColRegex.exec(sql)) !== null) {
    const tblName = match[1];
    const colName = match[2];
    const colType = match[3];
    const rest = match[4] || '';
    const tbl = initTable(tblName);
    const isNotNull = /NOT\s+NULL/i.test(rest);
    const defaultMatch = rest.match(/DEFAULT\s+([^,;]+)/i);

    tbl.columns[colName] = {
      name: colName,
      type: colType,
      nullable: !isNotNull,
      defaultVal: defaultMatch ? defaultMatch[1].trim() : null
    };

    const inlineFk = rest.match(/REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s*\(([^)]+)\))?/i);
    if (inlineFk) {
      tbl.fks.push({
        name: `fk_${tblName}_${colName}`,
        column: colName,
        targetTable: inlineFk[1],
        targetColumn: inlineFk[2] ? inlineFk[2].trim() : 'id'
      });
    }
  }

  // 3. RLS ENABLED
  const rlsRegex = /ALTER\s+TABLE(?:\s+ONLY)?\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  while ((match = rlsRegex.exec(sql)) !== null) {
    const tbl = initTable(match[1]);
    tbl.rlsEnabled = true;
  }

  // 4. CREATE POLICY
  const polRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s+AS\s+[A-Z]+)?(?:\s+FOR\s+([A-Z]+))?(?:\s+TO\s+([^,\n;]+))?(?:\s+USING\s*\(([\s\S]*?)\))?(?:\s+WITH\s+CHECK\s*\(([\s\S]*?)\))?;/gi;
  while ((match = polRegex.exec(sql)) !== null) {
    const polName = match[1];
    const tblName = match[2];
    const cmd = match[3] || 'ALL';
    const roles = match[4] ? match[4].split(',').map(s => s.trim()) : ['public'];
    const using = match[5] ? match[5].trim() : '';
    const withCheck = match[6] ? match[6].trim() : '';

    const tbl = initTable(tblName);
    // Avoid duplicate policies if replaced
    tbl.policies.push({
      name: polName,
      cmd,
      roles,
      using,
      withCheck
    });
  }

  // 5. CREATE TRIGGER
  const trgRegex = /CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)\s+(BEFORE|AFTER|INSTEAD\s+OF)\s+([A-Z\sOR]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)[\s\S]*?EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
  while ((match = trgRegex.exec(sql)) !== null) {
    const trgName = match[1];
    const timing = match[2];
    const events = match[3].replace(/\s+/g, ' ').trim();
    const tblName = match[4];
    const fnName = match[5];

    const tbl = initTable(tblName);
    tbl.triggers.push({
      name: trgName,
      timing,
      events,
      fn: fnName
    });
  }

  // 6. CREATE INDEX
  const idxRegex = /CREATE\s+(UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s+USING\s+[a-zA-Z0-9_]+)?\s*\(([^)]+)\)/gi;
  while ((match = idxRegex.exec(sql)) !== null) {
    const isUnique = !!match[1];
    const idxName = match[2];
    const tblName = match[3];
    const cols = match[4].trim();

    const tbl = initTable(tblName);
    tbl.indexes.push({
      name: idxName,
      unique: isUnique,
      columns: cols
    });
  }

  // 7. CREATE OR REPLACE FUNCTION
  const fnRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS\s+([a-zA-Z0-9_\[\]\(\)\s%]+?)(?:\s+LANGUAGE\s+[a-zA-Z0-9_]+)?(?:\s+(SECURITY\s+DEFINER|SECURITY\s+INVOKER))?[\s\S]*?AS\s+(\$\$|')([\s\S]*?)\5/gi;
  while ((match = fnRegex.exec(sql)) !== null) {
    const fnName = match[1];
    const args = match[2].trim().replace(/\s+/g, ' ');
    const returns = match[3].trim().replace(/\s+/g, ' ');
    const isSecDef = /SECURITY\s+DEFINER/i.test(match[0]);
    const body = match[6].trim().slice(0, 150).replace(/\s+/g, ' ');

    if (!functions[fnName]) {
      functions[fnName] = {
        name: fnName,
        args,
        returns,
        securityDefiner: isSecDef,
        sqlBodyPreview: body,
        files: []
      };
    } else {
      functions[fnName].args = args;
      functions[fnName].returns = returns;
      functions[fnName].securityDefiner = isSecDef;
      functions[fnName].sqlBodyPreview = body;
    }
    functions[fnName].files.push(file);
  }

  // 8. Storage bucket creation
  const bucketRegex = /INSERT\s+INTO\s+storage\.buckets\s*\([^)]+\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(true|false)/gi;
  while ((match = bucketRegex.exec(sql)) !== null) {
    const bId = match[1];
    const bPublic = match[3] === 'true';
    if (!storageBuckets[bId]) {
      storageBuckets[bId] = { name: bId, isPublic: bPublic, policies: [] };
    }
  }

  // Storage policy
  const stPolRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+storage\.objects/gi;
  while ((match = stPolRegex.exec(sql)) !== null) {
    const pName = match[1];
    for (const b of Object.values(storageBuckets)) {
      if (sql.includes(b.name)) {
        b.policies.push(pName);
      }
    }
  }
}

// Write the parsed DDL to JSON
fs.writeFileSync(
  path.resolve(process.cwd(), 'scripts/deep_ddl_parsed.json'),
  JSON.stringify({ tables, functions, views, storageBuckets }, null, 2)
);

console.log(`Deep DDL parsed successfully!`);
console.log(`Tables parsed: ${Object.keys(tables).length}`);
console.log(`Functions parsed: ${Object.keys(functions).length}`);
console.log(`Storage buckets: ${Object.keys(storageBuckets).length}`);
