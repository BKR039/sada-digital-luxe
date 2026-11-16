import fs from "fs";
import path from "path";

const nodeBuiltins = new Set([
  "fs", "node:fs", "path", "node:path", "crypto", "node:crypto",
  "http", "node:http", "https", "node:https", "net", "node:net",
  "os", "node:os", "stream", "node:stream", "child_process", "node:child_process",
  "util", "node:util", "buffer", "node:buffer", "events", "node:events"
]);

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
console.log(`Auditing ${allFiles.length} TypeScript files in src/...`);

const findings: { file: string; line: number; mod: string; raw: string }[] = [];

for (const f of allFiles) {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // check imports
    const match = l.match(/(?:import|from|require\(|import\()\s*['"]([^'"]+)['"]/);
    if (match) {
      const imp = match[1];
      if (nodeBuiltins.has(imp) || imp.startsWith("node:")) {
        findings.push({ file: f, line: i + 1, mod: imp, raw: l.trim() });
      }
    }
  }
}

console.log(`\nFound ${findings.length} Node.js builtin imports:`);
for (const item of findings) {
  console.log(`- ${item.file}:${item.line} -> ${item.mod}`);
  console.log(`    ${item.raw}`);
}
