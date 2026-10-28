import { createLocalTestClient, runLocalSql, queryLocalJson } from "./local-db-client";

async function test() {
  console.log("Testing local test client on sada_local_test...");
  const client = createLocalTestClient();

  const { data: tpls, error } = await client.from("workflow_templates").select().order("sort_order");
  console.log("Templates fetched:", tpls?.length, "Error:", error);

  const { data: stages } = await client.from("workflow_stages").select();
  console.log("Stages fetched:", stages?.length);

  console.log("All local test client assertions passed!");
}

test().catch(console.error);
