import * as fs from "node:fs";

const raw = JSON.parse(fs.readFileSync("catalog_dump.json", "utf-8"));
const packages: any[] = raw.packages;
const addons: any[] = raw.addons;

// Define canonical expectations from SADA_Master_Package_Catalog_and_Public_Pricing_Plan.md
const CANONICAL_INTERNAL = [
  // Section 01: SMM
  { code: "MG-01", name: "Starter", price: 699, unit: "month", reels: 4, posts: 4, stories: "8 Stories / month", hours: 0, sessions: 0, ads: false, web: false, strat: false, cm: true, ref: "Section 01, Page 2" },
  { code: "MG-02", name: "Growth", price: 1090, unit: "month", reels: 8, posts: 8, stories: "Weekly Stories", hours: 0, sessions: 0, ads: false, web: false, strat: false, cm: true, ref: "Section 01, Page 2" },
  { code: "MG-03", name: "Growth+", price: 1290, unit: "month", reels: 8, posts: 8, stories: "Weekly Stories", hours: 0, sessions: 0, ads: true, web: false, strat: true, cm: true, ref: "Section 01, Page 3" },
  { code: "MG-04", name: "Scale", price: 1590, unit: "month", reels: 12, posts: 8, stories: "Weekly Stories", hours: 0, sessions: 0, ads: true, web: false, strat: true, cm: true, ref: "Section 01, Page 3" },

  // Section 02: Production
  { code: "PR-01", name: "Content Session", price: 550, unit: "session", reels: 3, posts: 0, stories: "Story Clips", hours: 4, sessions: 1, ads: false, web: false, strat: false, cm: false, ref: "Section 02, Page 4" },
  { code: "PR-02", name: "Content Session Pro", price: 750, unit: "session", reels: 5, posts: 0, stories: "Story Content", hours: 4, sessions: 1, ads: false, web: false, strat: false, cm: false, ref: "Section 02, Page 4" },
  { code: "PR-03", name: "Long Production Day", price: 900, unit: "session", reels: 6, posts: 0, stories: "Story Assets", hours: 6, sessions: 1, ads: false, web: false, strat: false, cm: false, ref: "Section 02, Page 5" },
  { code: "PR-04", name: "Full Production Day", price: 1200, unit: "day", reels: 8, posts: 0, stories: "Story Content & BTS", hours: 8, sessions: 1, ads: false, web: false, strat: false, cm: false, ref: "Section 02, Page 5" },

  // Section 03: Story
  { code: "ST-01", name: "Story Batch", price: 350, unit: "batch", reels: 0, posts: 0, stories: "15–25 Story Clips", hours: 2, sessions: 1, ads: false, web: false, strat: false, cm: false, ref: "Section 03, Page 6" },
  { code: "ST-02", name: "Story Visits", price: 600, unit: "month", reels: 0, posts: 0, stories: "8 Visits (up to 1h/visit)", hours: 8, sessions: 8, ads: false, web: false, strat: false, cm: false, ref: "Section 03, Page 6" },
  { code: "ST-03", name: "Story Plus", price: 800, unit: "month", reels: 0, posts: 0, stories: "12 Visits (up to 1h/visit)", hours: 12, sessions: 12, ads: false, web: false, strat: false, cm: false, ref: "Section 03, Page 6" },
  { code: "ST-04", name: "Daily Story", price: 1000, unit: "month", reels: 0, posts: 0, stories: "Up to 20 Visits (up to 1h/visit)", hours: 20, sessions: 20, ads: false, web: false, strat: false, cm: false, ref: "Section 03, Page 7" },
  { code: "ST-05", name: "Daily Story Pro", price: 1300, unit: "month", reels: 0, posts: 0, stories: "Up to 20 Visits (up to 1.5h/visit) with Publishing", hours: 30, sessions: 20, ads: false, web: false, strat: false, cm: true, ref: "Section 03, Page 7" },

  // Section 04: Ads
  { code: "AD-01", name: "Ads Basic", price: 250, unit: "month", reels: 0, posts: 0, stories: null, hours: 0, sessions: 0, ads: true, web: false, strat: false, cm: false, ref: "Section 04, Page 8" },
  { code: "AD-02", name: "Ads Pro", price: 400, unit: "month", reels: 0, posts: 0, stories: null, hours: 0, sessions: 0, ads: true, web: false, strat: true, cm: false, ref: "Section 04, Page 8" },

  // Section 05: Web
  { code: "WEB-01", name: "Landing Page", price: 700, unit: "project", reels: 0, posts: 0, stories: null, hours: 0, sessions: 0, ads: false, web: true, strat: false, cm: false, ref: "Section 05, Page 9" },
  { code: "WEB-02", name: "Business Website", price: 1500, unit: "project", reels: 0, posts: 0, stories: null, hours: 0, sessions: 0, ads: false, web: true, strat: false, cm: false, ref: "Section 05, Page 9" },
  { code: "WEB-03", name: "Business System", price: 2500, unit: "project", reels: 0, posts: 0, stories: null, hours: 0, sessions: 0, ads: false, web: true, strat: false, cm: false, ref: "Section 05, Page 9" },

  // Section 06: Strategy
  { code: "STG-01", name: "Content Strategy", price: 300, unit: "service", reels: 0, posts: 0, stories: null, hours: 0, sessions: 0, ads: false, web: false, strat: true, cm: false, ref: "Section 06, Page 10" },
  { code: "STG-02", name: "Marketing Strategy", price: 500, unit: "service", reels: 0, posts: 0, stories: null, hours: 0, sessions: 0, ads: false, web: false, strat: true, cm: false, ref: "Section 06, Page 10" },

  // Section 07: Combined Monthly
  { code: "HY-01", name: "Growth Produce", price: 1490, unit: "month", reels: 4, posts: 4, stories: "Story Assets", hours: 4, sessions: 1, ads: false, web: false, strat: false, cm: true, ref: "Section 07, Page 11" },
  { code: "HY-02", name: "Growth+ Produce", price: 1790, unit: "month", reels: 6, posts: 8, stories: "Weekly Stories & Story Content", hours: 6, sessions: 1, ads: true, web: false, strat: false, cm: true, ref: "Section 07, Page 11" },
  { code: "HY-03", name: "Scale Produce", price: 2190, unit: "month", reels: 8, posts: 8, stories: "Story Assets", hours: 8, sessions: 1, ads: true, web: false, strat: true, cm: true, ref: "Section 07, Page 12" },
  { code: "HY-04", name: "Premium", price: 2490, unit: "month", reels: 8, posts: 8, stories: "Story Content", hours: 8, sessions: 1, ads: true, web: true, strat: true, cm: true, ref: "Section 07, Page 12" },
  { code: "HY-05", name: "Premium Plus", price: 2890, unit: "month", reels: 8, posts: 8, stories: "Story Content", hours: 8, sessions: 1, ads: true, web: true, strat: true, cm: true, ref: "Section 07, Page 12" },

  // Section 08: Custom
  { code: "CUS-01", name: "Build Your Package", price: 0, unit: "custom", reels: 0, posts: 0, stories: null, hours: 0, sessions: 0, ads: false, web: false, strat: false, cm: false, ref: "Section 08, Page 13" },
];

const CANONICAL_PUBLIC = [
  // Category A - Monthly Subscription
  { code: "PUB-MS-01", name: "Social Presence", proposedPrice: 1490, unit: "month", reels: 4, posts: 4, hours: 3, cat: "Monthly Subscription" },
  { code: "PUB-MS-02", name: "Growth Engine", proposedPrice: 1990, unit: "month", reels: 6, posts: 8, hours: 6, cat: "Monthly Subscription" },
  { code: "PUB-MS-03", name: "Full Brand Growth", proposedPrice: 2490, unit: "month", reels: 8, posts: 8, hours: 8, cat: "Monthly Subscription" },

  // Category B - Service On Demand
  { code: "PUB-OD-01", name: "Content Session", proposedPrice: 550, unit: "session", reels: 3, posts: 0, hours: 3, cat: "Service On Demand" },
  { code: "PUB-OD-02", name: "Production Day", proposedPrice: 900, unit: "session", reels: 6, posts: 0, hours: 6, cat: "Service On Demand" },
  { code: "PUB-OD-03", name: "Pro Production Day", proposedPrice: 1200, unit: "session", reels: 8, posts: 0, hours: 8, cat: "Service On Demand" },

  // Category C - Individual Services
  { code: "PUB-IS-01", name: "Reel Editing", proposedPrice: 80, unit: "reel", reels: 1, posts: 0, hours: 0, cat: "Individual Services" },
  { code: "PUB-IS-02", name: "Meta Ads Management", proposedPrice: 250, unit: "month", reels: 0, posts: 0, hours: 0, cat: "Individual Services" },
  { code: "PUB-IS-03", name: "Content Strategy Session", proposedPrice: 300, unit: "service", reels: 0, posts: 0, hours: 0, cat: "Individual Services" },
];

const CANONICAL_ADDONS = [
  { code: "ADD-01", name: "Extra Reel — Editing", price: 80, unit: "reel" },
  { code: "ADD-02", name: "Extra Reel — Full Production", price: 150, unit: "reel" },
  { code: "ADD-03", name: "Extra Post", price: 35, unit: "post" },
  { code: "ADD-04", name: "Extra Carousel", price: 50, unit: "carousel" },
  { code: "ADD-05", name: "Extra Story Batch", price: 100, unit: "batch" },
  { code: "ADD-06", name: "Extra Shooting Hour", price: 100, unit: "hour" },
  { code: "ADD-07", name: "Extra Production Hour", price: 120, unit: "hour" },
  { code: "ADD-08", name: "Extra Story Visit", price: 80, unit: "visit" },
  { code: "ADD-09", name: "Extra Photography Session", price: 250, unit: "session" },
  { code: "ADD-10", name: "Express 48h", price: 0, unit: "modifier", modifier: 20 },
  { code: "ADD-11", name: "Express 24h", price: 0, unit: "modifier", modifier: 40 },
  { code: "ADD-12", name: "Extra Website Hour", price: 80, unit: "hour" },
];

console.log("=== COMPARING DATABASE AGAINST CANONICAL SPECIFICATION ===");

let discrepancies: string[] = [];

// Audit Internal Packages
for (const c of CANONICAL_INTERNAL) {
  const p = packages.find(x => x.code === c.code);
  if (!p) {
    discrepancies.push(`[MISSING PACKAGE] ${c.code} (${c.name}) not found in database.`);
    continue;
  }

  if (c.code !== "CUS-01" && Number(p.price) !== c.price) {
    discrepancies.push(`[PRICE MISMATCH] ${c.code}: expected ${c.price}, found ${p.price}`);
  }
  if (p.billing_unit !== c.unit) {
    discrepancies.push(`[UNIT MISMATCH] ${c.code}: expected ${c.unit}, found ${p.billing_unit}`);
  }
  if (p.monthly_reels !== c.reels) {
    discrepancies.push(`[REELS MISMATCH] ${c.code}: expected ${c.reels}, found ${p.monthly_reels}`);
  }
  if (p.monthly_posts !== c.posts) {
    discrepancies.push(`[POSTS MISMATCH] ${c.code}: expected ${c.posts}, found ${p.monthly_posts}`);
  }
  if (Number(p.production_hours) !== c.hours) {
    discrepancies.push(`[HOURS MISMATCH] ${c.code}: expected ${c.hours}, found ${p.production_hours}`);
  }
  if (p.production_sessions !== c.sessions) {
    discrepancies.push(`[SESSIONS MISMATCH] ${c.code}: expected ${c.sessions}, found ${p.production_sessions}`);
  }
  if (p.is_internal_only !== true) {
    discrepancies.push(`[INTERNAL FLAG MISMATCH] ${c.code}: expected is_internal_only=true, found ${p.is_internal_only}`);
  }
  if (p.is_published !== false) {
    discrepancies.push(`[PUBLISHED FLAG MISMATCH] ${c.code}: expected is_published=false, found ${p.is_published}`);
  }
}

// Audit Public Proposals
for (const c of CANONICAL_PUBLIC) {
  const p = packages.find(x => x.code === c.code);
  if (!p) {
    discrepancies.push(`[MISSING PUBLIC PROPOSAL] ${c.code} (${c.name}) not found in database.`);
    continue;
  }

  if (Number(p.proposed_price) !== c.proposedPrice) {
    discrepancies.push(`[PROPOSED PRICE MISMATCH] ${c.code}: expected ${c.proposedPrice}, found ${p.proposed_price}`);
  }
  if (p.billing_unit !== c.unit) {
    discrepancies.push(`[PUBLIC UNIT MISMATCH] ${c.code}: expected ${c.unit}, found ${p.billing_unit}`);
  }
  if (p.monthly_reels !== c.reels) {
    discrepancies.push(`[PUBLIC REELS MISMATCH] ${c.code}: expected ${c.reels}, found ${p.monthly_reels}`);
  }
  if (p.monthly_posts !== c.posts) {
    discrepancies.push(`[PUBLIC POSTS MISMATCH] ${c.code}: expected ${c.posts}, found ${p.monthly_posts}`);
  }
  if (p.is_published !== false) {
    discrepancies.push(`[PUBLIC PUBLISHED MISMATCH] ${c.code}: MUST BE is_published=false, found ${p.is_published}`);
  }
  if (p.approval_status !== "proposed") {
    discrepancies.push(`[PUBLIC APPROVAL STATUS MISMATCH] ${c.code}: MUST BE 'proposed', found '${p.approval_status}'`);
  }
}

// Audit Add-ons
for (const c of CANONICAL_ADDONS) {
  const a = addons.find(x => x.code === c.code);
  if (!a) {
    discrepancies.push(`[MISSING ADDON] ${c.code} not found in database.`);
    continue;
  }
  if (Number(a.price) !== c.price) {
    discrepancies.push(`[ADDON PRICE MISMATCH] ${c.code}: expected ${c.price}, found ${a.price}`);
  }
  if (a.unit !== c.unit) {
    discrepancies.push(`[ADDON UNIT MISMATCH] ${c.code}: expected ${c.unit}, found ${a.unit}`);
  }
}

console.log(`\nAudit completed with ${discrepancies.length} discrepancy findings:`);
for (const d of discrepancies) {
  console.log(`- ${d}`);
}
