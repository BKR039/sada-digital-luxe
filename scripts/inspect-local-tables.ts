import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { enforceDatabaseIsolation } from "./test-db-guard";
import { queryLocalJson } from "./local-db-client";

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

enforceDatabaseIsolation(LOCAL_DB_URL);

function runSql(sql: string): string {
  return execFileSync(
    PSQL_BIN,
    ["-X", "-A", "-t", "-d", TARGET_DB, "-c", sql],
    {
      env: {
        ...process.env,
        PGHOST: TARGET_HOST,
        PGPORT: TARGET_PORT,
        PGDATABASE: TARGET_DB,
        PGUSER: "postgres",
      },
      encoding: "utf-8",
    }
  ).trim();
}

import { findMatchingClients } from "../src/components/admin/project-utils";

const clients = runSql(`SELECT id, name, email, phone FROM public.clients;`);
console.log("Clients in DB:\n" + clients);

const allCl = queryLocalJson<any[]>(`SELECT * FROM public.clients;`);
const matches = findMatchingClients(
  {
    email: "shared@holding.tn",
    phone: "+216 71 999 888",
    business_name: "Acme",
    name: "John Doe",
  },
  allCl
);
console.log("Matched clients count:", matches.length, matches.map(m => m.name));





