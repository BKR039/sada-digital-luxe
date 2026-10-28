import * as fs from "node:fs";

const raw = JSON.parse(fs.readFileSync("catalog_dump.json", "utf-8"));
const packages = raw.packages;
const addons = raw.addons;

console.log(`Auditing ${packages.length} packages and ${addons.length} addons...\n`);

// Check specific packages mentioned in prompt
const specificCodes = ["MG-01", "MG-02", "MG-03", "MG-04", "PR-01", "PR-02", "PR-03", "PR-04", "ST-01", "ST-02", "ST-03", "ST-04", "ST-05", "HY-01", "HY-02", "HY-03", "HY-04", "HY-05"];

for (const code of specificCodes) {
  const p = packages.find((item: any) => item.code === code);
  if (!p) {
    console.log(`[MISSING] ${code}`);
    continue;
  }
  console.log(`=== ${p.code} — ${p.name} ===`);
  console.log(`Price: ${p.price} | Proposed: ${p.proposed_price} | Unit: ${p.billing_unit} | Category: ${p.category_name}`);
  console.log(`Reels: ${p.monthly_reels} | Posts: ${p.monthly_posts} | Stories: ${p.monthly_stories} | Hours: ${p.production_hours} | Sessions: ${p.production_sessions}`);
  console.log(`Flags: ads=${p.has_ads_management}, web=${p.has_website}, strat=${p.has_strategy}, cm=${p.has_community_management}, internal=${p.is_internal_only}, pub=${p.is_published}, status=${p.approval_status}`);
  console.log(`Included:`, p.included_items);
  console.log(`Excluded:`, p.excluded_items);
  console.log(`Source ref: ${p.source_page_ref}`);
  console.log(`Notes: ${p.operational_notes}`);
  console.log("");
}
