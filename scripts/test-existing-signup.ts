import fs from "fs";
const envContent = fs.readFileSync(".env", "utf-8");
const keys: string[] = [];
envContent.split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*([\w.-]+)\s*=/);
  if (m) keys.push(m[1]);
});
console.log("Keys in .env:", keys);
