import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const keys = envContent.split(/\r?\n/).map(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=/);
    return match ? match[1] : null;
  }).filter(Boolean);
  console.log("Keys in .env:", keys);
} else {
  console.log(".env not found");
}
