import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { enforceDatabaseIsolation } from "./test-db-guard";

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = "5432";
const TARGET_DB = "sada_local_test";
const LOCAL_DB_URL = `postgres://postgres@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}`;

const PSQL_BIN = path.join(
  process.env.LOCALAPPDATA || "",
  "Programs",
  "PostgreSQL16",
  "pgsql",
  "bin",
  "psql.exe"
);

export function runLocalSql(sql: string): string {
  enforceDatabaseIsolation(LOCAL_DB_URL);
  return execFileSync(
    PSQL_BIN,
    ["-X", "-A", "-t", "-d", TARGET_DB],
    {
      input: Buffer.from(sql, "utf-8"),
      env: {
        ...process.env,
        PGCLIENTENCODING: "UTF8",
        PGHOST: TARGET_HOST,
        PGPORT: TARGET_PORT,
        PGDATABASE: TARGET_DB,
        PGUSER: "postgres",
      },
      encoding: "utf-8",
    }
  ).trim();
}

export function queryLocalJson<T = any>(sql: string): T {
  const cleanSql = sql.trim().replace(/;+$/, "");
  const wrapped = `WITH sub AS (${cleanSql}) SELECT COALESCE(json_agg(sub), '[]'::json) FROM sub;`;
  const raw = runLocalSql(wrapped);
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse SQL JSON:", raw, err);
    throw err;
  }
}

export function executeLocalSql(sql: string): void {
  runLocalSql(sql);
}

function escapeSqlVal(val: any, colName?: string): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  const jsonbCols = [
    "gallery",
    "metrics",
    "testimonial",
    "module_permissions",
    "metadata",
    "config",
    "criteria",
    "stages",
    "actions",
  ];
  if (colName && jsonbCols.includes(colName)) {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return "ARRAY[]::text[]";
    const allStrings = val.every((x) => typeof x === "string");
    if (allStrings) {
      const items = val.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(", ");
      return `ARRAY[${items}]::text[]`;
    }
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  if (typeof val === "object") {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function splitTopLevelCommas(str: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parsePostgrestCondition(cond: string): string {
  cond = cond.trim();
  const firstDot = cond.indexOf(".");
  if (firstDot === -1) return "1=1";
  const col = cond.substring(0, firstDot);
  const rest = cond.substring(firstDot + 1);
  const secondDot = rest.indexOf(".");
  if (secondDot === -1) return "1=1";
  const op = rest.substring(0, secondDot);
  const val = rest.substring(secondDot + 1);

  if (op === "eq") {
    if (val === "null") return `"${col}" IS NULL`;
    return `"${col}" = ${escapeSqlVal(val)}`;
  } else if (op === "neq") {
    if (val === "null") return `"${col}" IS NOT NULL`;
    return `"${col}" <> ${escapeSqlVal(val)}`;
  } else if (op === "is") {
    if (val === "null") return `"${col}" IS NULL`;
    if (val === "not.null") return `"${col}" IS NOT NULL`;
    return `"${col}" IS ${val}`;
  } else if (op === "in") {
    const inner = val.replace(/^\(|\)$/g, "");
    const items = inner.split(",").map((s) => escapeSqlVal(s.trim()));
    return `"${col}" IN (${items.join(", ")})`;
  } else if (op === "gt") {
    return `"${col}" > ${escapeSqlVal(val)}`;
  } else if (op === "gte") {
    return `"${col}" >= ${escapeSqlVal(val)}`;
  } else if (op === "lt") {
    return `"${col}" < ${escapeSqlVal(val)}`;
  } else if (op === "lte") {
    return `"${col}" <= ${escapeSqlVal(val)}`;
  } else if (op === "like") {
    return `"${col}" LIKE ${escapeSqlVal(val)}`;
  } else if (op === "ilike") {
    return `"${col}" ILIKE ${escapeSqlVal(val)}`;
  }
  return `"${col}" = ${escapeSqlVal(val)}`;
}

class QueryBuilder {
  private tableName: string;
  private action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private selectCols = "*";
  private insertData: any = null;
  private updateData: any = null;
  private onConflictCols: string | null = null;
  private whereClauses: string[] = [];
  private orderClause: string | null = null;
  private limitNum: number | null = null;
  private isSingle = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns = "*") {
    this.selectCols = columns;
    return this;
  }

  insert(data: any | any[]) {
    this.action = "insert";
    this.insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  upsert(data: any | any[], options?: { onConflict?: string }) {
    this.action = "upsert";
    this.insertData = Array.isArray(data) ? data : [data];
    if (options?.onConflict) {
      this.onConflictCols = options.onConflict;
    }
    return this;
  }

  update(data: any) {
    this.action = "update";
    this.updateData = data;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    if (value === null || value === undefined) {
      this.whereClauses.push(`"${column}" IS NULL`);
    } else {
      this.whereClauses.push(`"${column}" = ${escapeSqlVal(value)}`);
    }
    return this;
  }

  neq(column: string, value: any) {
    if (value === null || value === undefined) {
      this.whereClauses.push(`"${column}" IS NOT NULL`);
    } else {
      this.whereClauses.push(`"${column}" <> ${escapeSqlVal(value)}`);
    }
    return this;
  }

  is(column: string, value: any) {
    if (value === null || value === "null") {
      this.whereClauses.push(`"${column}" IS NULL`);
    } else {
      this.whereClauses.push(`"${column}" IS ${value}`);
    }
    return this;
  }

  gt(column: string, value: any) {
    this.whereClauses.push(`"${column}" > ${escapeSqlVal(value)}`);
    return this;
  }

  gte(column: string, value: any) {
    this.whereClauses.push(`"${column}" >= ${escapeSqlVal(value)}`);
    return this;
  }

  lt(column: string, value: any) {
    this.whereClauses.push(`"${column}" < ${escapeSqlVal(value)}`);
    return this;
  }

  lte(column: string, value: any) {
    this.whereClauses.push(`"${column}" <= ${escapeSqlVal(value)}`);
    return this;
  }

  like(column: string, pattern: string) {
    this.whereClauses.push(`"${column}" LIKE ${escapeSqlVal(pattern)}`);
    return this;
  }

  ilike(column: string, pattern: string) {
    this.whereClauses.push(`"${column}" ILIKE ${escapeSqlVal(pattern)}`);
    return this;
  }

  or(filterStr: string) {
    if (!filterStr || !filterStr.trim()) return this;
    const items = splitTopLevelCommas(filterStr);
    const parsed = items.map((it) => parsePostgrestCondition(it)).filter(Boolean);
    if (parsed.length > 0) {
      this.whereClauses.push(`(${parsed.join(" OR ")})`);
    }
    return this;
  }

  filter(column: string, operator: string, value: any) {
    if (operator === "eq") return this.eq(column, value);
    if (operator === "neq") return this.neq(column, value);
    if (operator === "is") return this.is(column, value);
    if (operator === "in") return this.in(column, Array.isArray(value) ? value : [value]);
    if (operator === "gt") return this.gt(column, value);
    if (operator === "gte") return this.gte(column, value);
    if (operator === "lt") return this.lt(column, value);
    if (operator === "lte") return this.lte(column, value);
    this.whereClauses.push(`"${column}" ${operator} ${escapeSqlVal(value)}`);
    return this;
  }

  in(column: string, values: any[]) {
    if (!values || values.length === 0) {
      this.whereClauses.push("1=0");
    } else {
      const escaped = values.map((v) => escapeSqlVal(v)).join(", ");
      this.whereClauses.push(`"${column}" IN (${escaped})`);
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    const dir = options?.ascending === false ? "DESC" : "ASC";
    this.orderClause = `ORDER BY "${column}" ${dir}`;
    return this;
  }

  limit(n: number) {
    this.limitNum = n;
    return this;
  }

  single() {
    this.isSingle = true;
    return this.execute();
  }

  maybeSingle() {
    this.isSingle = true;
    return this.execute();
  }

  // Promise-like resolution when awaited
  then(resolve: (res: { data: any; error: any }) => void, reject?: (err: any) => void) {
    return this.execute().then(resolve, reject);
  }

  async execute(): Promise<{ data: any; error: any }> {
    try {
      let sql = "";
      const wherePart = this.whereClauses.length > 0 ? `WHERE ${this.whereClauses.join(" AND ")}` : "";

      if (this.action === "select") {
        if (this.tableName === "workflow_templates" && this.selectCols.includes("stages")) {
          const tWhere = wherePart
            .replace(/"id"/g, 't."id"')
            .replace(/"task_type"/g, 't."task_type"')
            .replace(/"is_active"/g, 't."is_active"');
          const orderPart = this.orderClause ? this.orderClause.replace(/"/g, "") : "ORDER BY t.sort_order ASC";
          sql = `
            SELECT t.*, COALESCE(json_agg(s.* ORDER BY s.sort_order) FILTER (WHERE s.id IS NOT NULL), '[]'::json) AS stages
            FROM public.workflow_templates t
            LEFT JOIN public.workflow_stages s ON s.template_id = t.id
            ${tWhere}
            GROUP BY t.id
            ${orderPart}
          `;
        } else {
          const orderPart = this.orderClause || "";
          const limitPart = this.limitNum ? `LIMIT ${this.limitNum}` : "";
          sql = `SELECT * FROM public."${this.tableName}" ${wherePart} ${orderPart} ${limitPart}`;
        }
      } else if (this.action === "insert") {
        if (!this.insertData || this.insertData.length === 0) {
          return { data: [], error: null };
        }
        const rows = this.insertData;
        const allKeys = Array.from(new Set(rows.flatMap((r: any) => Object.keys(r))));
        const colNames = allKeys.map((k) => `"${k}"`).join(", ");
        const valRows = rows
          .map((r: any) => `(${allKeys.map((k) => escapeSqlVal(r[k], k)).join(", ")})`)
          .join(",\n");

        sql = `INSERT INTO public."${this.tableName}" (${colNames}) VALUES ${valRows} RETURNING *`;
      } else if (this.action === "upsert") {
        if (!this.insertData || this.insertData.length === 0) {
          return { data: [], error: null };
        }
        const rows = this.insertData;
        const allKeys = Array.from(new Set(rows.flatMap((r: any) => Object.keys(r))));
        const colNames = allKeys.map((k) => `"${k}"`).join(", ");
        const valRows = rows
          .map((r: any) => `(${allKeys.map((k) => escapeSqlVal(r[k], k)).join(", ")})`)
          .join(",\n");

        let conflictClause = "";
        if (this.onConflictCols) {
          const conflictColNames = this.onConflictCols.split(",").map((c) => `"${c.trim()}"`).join(", ");
          const updateAssignments = allKeys
            .filter((k) => !this.onConflictCols!.split(",").map((c) => c.trim()).includes(k))
            .map((k) => `"${k}" = EXCLUDED."${k}"`)
            .join(", ");
          conflictClause =
            updateAssignments.length > 0
              ? `ON CONFLICT (${conflictColNames}) DO UPDATE SET ${updateAssignments}`
              : `ON CONFLICT (${conflictColNames}) DO NOTHING`;
        }

        sql = `INSERT INTO public."${this.tableName}" (${colNames}) VALUES ${valRows} ${conflictClause} RETURNING *`;
      } else if (this.action === "update") {
        const setAssignments = Object.keys(this.updateData)
          .map((k) => `"${k}" = ${escapeSqlVal(this.updateData[k], k)}`)
          .join(", ");
        sql = `UPDATE public."${this.tableName}" SET ${setAssignments} ${wherePart} RETURNING *`;
      } else if (this.action === "delete") {
        sql = `DELETE FROM public."${this.tableName}" ${wherePart} RETURNING *`;
      }

      const rows = queryLocalJson<any[]>(sql);

      if (this.action === "select" && rows.length > 0) {
        // Embed clients if requested
        if (this.selectCols.includes("clients")) {
          const clientIds = Array.from(new Set(rows.map((r) => r.client_id).filter(Boolean)));
          if (clientIds.length > 0) {
            const escaped = clientIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(", ");
            try {
              const clientRows = queryLocalJson<any[]>(`SELECT id, name FROM public.clients WHERE id IN (${escaped})`);
              const cMap = new Map(clientRows.map((c) => [c.id, c]));
              for (const r of rows) {
                if (r.client_id) r.client = cMap.get(r.client_id) || null;
              }
            } catch {
              // ignore
            }
          }
        }
        // Embed team_members if requested
        if (this.selectCols.includes("team_members")) {
          const memberIds = Array.from(new Set(rows.map((r) => r.team_member_id).filter(Boolean)));
          if (memberIds.length > 0) {
            const escaped = memberIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(", ");
            try {
              const memberRows = queryLocalJson<any[]>(`SELECT id, name, email, position, role, division, photo_url FROM public.team_members WHERE id IN (${escaped})`);
              const mMap = new Map(memberRows.map((m) => [m.id, m]));
              for (const r of rows) {
                if (r.team_member_id) r.team_member = mMap.get(r.team_member_id) || null;
              }
            } catch {
              // ignore
            }
          }
        }
        // Embed projects if requested
        if (this.selectCols.includes("projects")) {
          for (const r of rows) {
            r.project = null;
          }
        }
      }

      let data: any = rows;
      if (this.isSingle) {
        data = rows.length > 0 ? rows[0] : null;
      }
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || String(err) } };
    }
  }
}

export function createLocalTestClient(actorId = "10000000-0000-0000-0000-000000000001") {
  return {
    from(tableName: string) {
      return new QueryBuilder(tableName);
    },
    async rpc(fnName: string, args?: any) {
      return { data: null, error: null };
    },
    auth: {
      async getUser() {
        return { data: { user: { id: actorId } }, error: null };
      },
      async getSession() {
        return { data: { session: { user: { id: actorId } } }, error: null };
      },
    },
  };
}
