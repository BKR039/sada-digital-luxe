import * as fs from "node:fs";

const raw = JSON.parse(fs.readFileSync("catalog_dump.json", "utf-8"));
const packages: any[] = raw.packages;
const addons: any[] = raw.addons;

console.log("=== SADA PACKAGE CATALOG DETAILED AUDIT ===");
console.log(`Total packages in DB: ${packages.length}`);
console.log(`Total addons in DB: ${addons.length}\n`);

// 1. MG Packages
console.log("--- 01: SMM PACKAGES (MG-01 to MG-04) ---");
for (const code of ["MG-01", "MG-02", "MG-03", "MG-04"]) {
  const p = packages.find(x => x.code === code);
  console.log(`${p.code} | Name: ${p.name} | Price: ${p.price} TND/${p.billing_unit}`);
  console.log(`  Reels: ${p.monthly_reels} | Posts: ${p.monthly_posts} | Stories: ${p.monthly_stories}`);
  console.log(`  Production Hours: ${p.production_hours} | Sessions: ${p.production_sessions}`);
  console.log(`  Ads: ${p.has_ads_management} | CM: ${p.has_community_management} | Strat: ${p.has_strategy} | Web: ${p.has_website}`);
  console.log(`  Included: ${JSON.stringify(p.included_items)}`);
  console.log(`  Excluded: ${JSON.stringify(p.excluded_items)}`);
  console.log(`  Page Ref: ${p.source_page_ref}`);
  console.log("");
}

// 2. Production Packages
console.log("--- 02: PRODUCTION PACKAGES (PR-01 to PR-04) ---");
for (const code of ["PR-01", "PR-02", "PR-03", "PR-04"]) {
  const p = packages.find(x => x.code === code);
  console.log(`${p.code} | Name: ${p.name} | Price: ${p.price} TND/${p.billing_unit}`);
  console.log(`  Reels: ${p.monthly_reels} | Posts: ${p.monthly_posts} | Stories: ${p.monthly_stories}`);
  console.log(`  Production Hours: ${p.production_hours} | Sessions: ${p.production_sessions}`);
  console.log(`  Included: ${JSON.stringify(p.included_items)}`);
  console.log(`  Excluded: ${JSON.stringify(p.excluded_items)}`);
  console.log(`  Page Ref: ${p.source_page_ref}`);
  console.log("");
}

// 3. Story Packages
console.log("--- 03: STORY PACKAGES (ST-01 to ST-05) ---");
for (const code of ["ST-01", "ST-02", "ST-03", "ST-04", "ST-05"]) {
  const p = packages.find(x => x.code === code);
  console.log(`${p.code} | Name: ${p.name} | Price: ${p.price} TND/${p.billing_unit}`);
  console.log(`  Reels: ${p.monthly_reels} | Posts: ${p.monthly_posts} | Stories: ${p.monthly_stories}`);
  console.log(`  Production Hours: ${p.production_hours} | Sessions: ${p.production_sessions}`);
  console.log(`  Included: ${JSON.stringify(p.included_items)}`);
  console.log(`  Excluded: ${JSON.stringify(p.excluded_items)}`);
  console.log(`  Page Ref: ${p.source_page_ref}`);
  console.log("");
}

// 4. Ads, Web, Strategy, Custom Packages
console.log("--- 04-06, 08: ADS, WEB, STRATEGY, CUSTOM ---");
for (const code of ["AD-01", "AD-02", "WEB-01", "WEB-02", "WEB-03", "STG-01", "STG-02", "CUS-01"]) {
  const p = packages.find(x => x.code === code);
  console.log(`${p.code} | Name: ${p.name} | Price: ${p.price} TND/${p.billing_unit}`);
  console.log(`  Included: ${JSON.stringify(p.included_items)}`);
  console.log(`  Excluded: ${JSON.stringify(p.excluded_items)}`);
  console.log(`  Page Ref: ${p.source_page_ref}`);
  console.log("");
}

// 5. Monthly Combined Packages
console.log("--- 07: COMBINED MONTHLY (HY-01 to HY-05) ---");
for (const code of ["HY-01", "HY-02", "HY-03", "HY-04", "HY-05"]) {
  const p = packages.find(x => x.code === code);
  console.log(`${p.code} | Name: ${p.name} | Price: ${p.price} TND/${p.billing_unit}`);
  console.log(`  Reels: ${p.monthly_reels} | Posts: ${p.monthly_posts} | Stories: ${p.monthly_stories}`);
  console.log(`  Production Hours: ${p.production_hours} | Sessions: ${p.production_sessions}`);
  console.log(`  Included: ${JSON.stringify(p.included_items)}`);
  console.log(`  Excluded: ${JSON.stringify(p.excluded_items)}`);
  console.log(`  Page Ref: ${p.source_page_ref}`);
  console.log("");
}

// 6. Public Proposals
console.log("--- 11: PUBLIC PROPOSALS (PUB-*) ---");
const publicProposals = packages.filter(x => x.code.startsWith("PUB-"));
for (const p of publicProposals) {
  console.log(`${p.code} | Name: ${p.name} | Proposed Price: ${p.proposed_price} TND/${p.billing_unit} | Published: ${p.is_published} | Status: ${p.approval_status}`);
  console.log(`  Category: ${p.category_name} | Internal-only: ${p.is_internal_only}`);
  console.log(`  Included: ${JSON.stringify(p.included_items)}`);
  console.log(`  Excluded: ${JSON.stringify(p.excluded_items)}`);
  console.log(`  Page Ref: ${p.source_page_ref}`);
  console.log("");
}

// 7. Addons
console.log("--- 09: ADD-ONS ---");
for (const a of addons) {
  console.log(`${a.code} | ${a.name} | Price: ${a.price} TND / ${a.unit} | Perc: ${a.price_percentage}% | Active: ${a.is_active} | Ref: ${a.source_page_ref}`);
}
