import { queryLocalJson } from "./local-db-client";

async function main() {
  const tables = queryLocalJson<{ tablename: string; rowsecurity: boolean }[]>(
    `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  console.log(`Found ${tables.length} tables in sada_local_test:`);
  console.log(tables.map(t => `${t.tablename} (RLS: ${t.rowsecurity})`).join(", "));
}

main().catch(console.error);
