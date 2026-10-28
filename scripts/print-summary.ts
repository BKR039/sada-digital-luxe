import * as fs from "node:fs";

const raw = JSON.parse(fs.readFileSync("catalog_dump.json", "utf-8"));
for (const p of raw.packages) {
  console.log(
    p.code.padEnd(10),
    p.name.padEnd(25),
    "Reels:", String(p.monthly_reels).padEnd(4),
    "Posts:", String(p.monthly_posts).padEnd(4),
    "Hours:", String(p.production_hours).padEnd(4),
    "Price:", String(p.price !== null ? p.price : p.proposed_price).padEnd(6),
    p.billing_unit.padEnd(8),
    "Internal:", String(p.is_internal_only).padEnd(6),
    "Pub:", String(p.is_published).padEnd(6),
    "Status:", p.approval_status
  );
}
