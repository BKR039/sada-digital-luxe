import fs from "fs";
import path from "path";

function walk(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== ".output") {
        walk(full, fileList);
      }
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(full);
    }
  }
  return fileList;
}

const allFiles = walk("src");
const envVars = new Map<string, { client: boolean; server: boolean; files: string[] }>();

for (const f of allFiles) {
  const content = fs.readFileSync(f, "utf8");
  // Match process.env.VAR_NAME or import.meta.env.VAR_NAME
  const regex = /(?:process\.env|import\.meta\.env)\.([A-Za-z0-9_]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const varName = match[1];
    if (!envVars.has(varName)) {
      envVars.set(varName, { client: false, server: false, files: [] });
    }
    const entry = envVars.get(varName)!;
    if (!entry.files.includes(f)) {
      entry.files.push(f);
    }
    if (match[0].startsWith("import.meta.env") || varName.startsWith("VITE_")) {
      entry.client = true;
    } else {
      entry.server = true;
    }
  }
}

console.log("=== ENVIRONMENT VARIABLE INVENTORY ===");
const sorted = Array.from(envVars.entries()).sort((a, b) => a[0].localeCompare(b[0]));
for (const [name, meta] of sorted) {
  const scope = meta.client && meta.server ? "CLIENT + SERVER" : meta.client ? "CLIENT ONLY" : "SERVER ONLY";
  console.log(`- ${name} [${scope}]: used in ${meta.files.length} file(s)`);
  for (const f of meta.files) {
    console.log(`    ${f}`);
  }
}
