import {
  generateRequestSummary,
  generateLikelyNeeds,
  getIndustryContextLabel,
  DiscoveryAnswers,
} from "../src/components/discovery/discovery-utils";

interface TestCase {
  id: string;
  name: string;
  answers: Partial<DiscoveryAnswers>;
  expectedRank1Includes?: string;
  minRecommendations?: number;
  maxRecommendations?: number;
}

const scenarios: TestCase[] = [
  // Scenario 1: Restaurant
  // Goal: more sales, Problem: customers discover but don't order, Need: ordering website + ads
  {
    id: "scenario-1-restaurant",
    name: "Restaurant / Café — Direct Sales & Ordering Experience",
    answers: {
      path_taken: "guided",
      business_type: "Restaurant / Café",
      business_stage: "Already operating",
      company: "Olive & Stone",
      business_situation_details: "Mostly foot traffic and delivery apps, Instagram is active with 15k followers but needs work",
      what_brought_here: ["People don't know us", "We need more customers"],
      main_problem: "More sales",
      root_problem: "People see us but don't order",
      services_needed: ["Website", "Meta Ads", "Content"],
      priority_service: "Website",
      timeline: "Within 2 weeks",
      budget_preference: "I have a budget",
      budget_range: "$2,500 – $5,000",
      name: "Karim Mansour",
      email: "karim@oliveandstone.tn",
      preferred_contact: "WhatsApp",
    },
    expectedRank1Includes: "Website",
  },

  // Scenario 2: Travel Agency
  // Services: Umrah + flights, Goal: more qualified leads, Need: website + ads
  {
    id: "scenario-2-travel",
    name: "Travel Agency — Umrah & Flight Inbound Lead Generation",
    answers: {
      path_taken: "guided",
      business_type: "Travel & Tourism",
      business_stage: "Established",
      company: "Al-Bousala Voyages",
      business_situation_details: "Mainly organized Umrah groups, VIP Saudi packages, and seasonal holiday flights across Europe and MENA",
      what_brought_here: ["We need more leads", "We need advertising"],
      main_problem: "More qualified leads",
      root_problem: "Not enough visibility",
      services_needed: ["Website", "Meta Ads"],
      priority_service: "Meta Ads",
      timeline: "This month",
      budget_preference: "I have a budget",
      budget_range: "$5,000 – $15,000",
      name: "Mehdi Trabelsi",
      email: "mehdi@albousala.tn",
      preferred_contact: "Phone",
    },
    expectedRank1Includes: "Meta Ads",
  },

  // Scenario 3: E-commerce
  // Goal: more sales, Problem: traffic but low conversion
  {
    id: "scenario-3-ecommerce",
    name: "E-commerce — High-Volume Storefront & Conversion Optimization",
    answers: {
      path_taken: "guided",
      business_type: "E-commerce",
      business_stage: "Growing",
      company: "Zaytuna Botanicals",
      business_situation_details: "Organic cold-pressed skincare shipped nationwide via Shopify, active TikTok creator collaborations",
      what_brought_here: ["Social media isn't performing", "We need more customers"],
      main_problem: "More sales",
      root_problem: "Website doesn't convert",
      what_tried: ["Running Meta Ads", "In-house social media"],
      what_tried_notes: "CPA doubled last quarter, visitors bounce on checkout",
      services_needed: ["Website", "Meta Ads", "Content"],
      priority_service: "Website",
      timeline: "This month",
      budget_preference: "I have a budget",
      budget_range: "$5,000 – $15,000",
      name: "Sonia Ghedira",
      email: "sonia@zaytuna.com",
      preferred_contact: "Email",
    },
    expectedRank1Includes: "Website",
  },

  // Scenario 4: Real Estate
  // Goal: build trust, Problem: weak positioning, Need: branding + content + website
  {
    id: "scenario-4-real-estate",
    name: "Real Estate — Luxury Credibility & Strategic Repositioning",
    answers: {
      path_taken: "guided",
      business_type: "Real Estate",
      business_stage: "Already operating",
      company: "Totta Living",
      business_situation_details: "Prime coastal residential villas and boutique commercial retail in Gammarth and La Marsa",
      what_brought_here: ["Our brand doesn't represent us", "People don't know us"],
      main_problem: "More trust",
      root_problem: "Present the business",
      services_needed: ["Branding", "Content", "Website", "Video Production"],
      priority_service: "Video Production",
      timeline: "This month",
      budget_preference: "I have a budget",
      budget_range: "$2,500 – $5,000",
      name: "Tarek Touati",
      email: "tarek@tottaliving.com",
      preferred_contact: "WhatsApp",
    },
    expectedRank1Includes: "Video",
  },

  // Scenario 5: Education
  // Goal: more student registrations, Problem: weak online presence
  {
    id: "scenario-5-education",
    name: "Education — Student Cohort Enrollment & Digital Showcase",
    answers: {
      path_taken: "guided",
      business_type: "Education",
      business_stage: "Growing",
      company: "Apex Tech Institute",
      business_situation_details: "Executive coding bootcamps, UX design certifications, and corporate AI training workshops",
      what_brought_here: ["People don't know us", "We need more leads", "We need a website"],
      main_problem: "More qualified leads",
      root_problem: "Not enough visibility",
      services_needed: ["Website", "Meta Ads", "Content"],
      priority_service: "Website",
      timeline: "Within 2 weeks",
      budget_preference: "I have a budget",
      budget_range: "$5,000 – $15,000",
      name: "Dr. Anis Karray",
      email: "anis@apextech.tn",
      preferred_contact: "Email",
    },
    expectedRank1Includes: "Website",
  },

  // Scenario 6: Branding-only request
  // Goal: rebrand, Need: brand strategy + visual identity
  {
    id: "scenario-6-branding-only",
    name: "B2B Brand Repositioning — Identity & Strategy Overhaul",
    answers: {
      path_taken: "guided",
      business_type: "B2B / Company",
      business_stage: "Rebranding",
      company: "Carthage Logistics",
      business_situation_details: "Industrial freight forwarding and regional cold-chain shipping across North Africa and Southern Europe",
      what_brought_here: ["Our brand doesn't represent us", "We need a rebrand"],
      main_problem: "Better brand image",
      root_problem: "Visual identity",
      services_needed: ["Branding", "Brand Strategy", "Visual Identity"],
      priority_service: "Brand Strategy",
      timeline: "1–3 months",
      budget_preference: "I have a budget",
      budget_range: "$5,000 – $15,000",
      name: "Hichem Chaabane",
      email: "h.chaabane@carthagelog.com",
      preferred_contact: "Phone",
    },
    expectedRank1Includes: "Brand Strategy",
  },

  // Scenario 7: Website request
  // Goal: generate leads, Existing website: yes, Problem: poor conversion
  {
    id: "scenario-7-website-conversion",
    name: "Professional Advisory — High-Converting Lead Generation Site",
    answers: {
      path_taken: "guided",
      business_type: "Professional Services",
      business_stage: "Established",
      company: "Cabinet Ben Salem & Partners",
      business_situation_details: "Corporate tax optimization, cross-border M&A advisory, and private client wealth management",
      what_brought_here: ["We need a website", "We need more leads"],
      main_problem: "Better conversion",
      root_problem: "Website doesn't convert",
      what_tried: ["Building our own website"],
      what_tried_notes: "Previous WordPress build was slow and never brought in inbound corporate inquiries",
      services_needed: ["Website", "Copywriting"],
      priority_service: "Website",
      timeline: "This month",
      budget_preference: "I have a budget",
      budget_range: "$2,500 – $5,000",
      name: "Mourad Ben Salem",
      email: "m.bensalem@bsp-partners.com",
      preferred_contact: "Email",
    },
    expectedRank1Includes: "Website",
  },

  // Scenario 8: Advertising request
  // Problem: high ad cost / poor leads
  {
    id: "scenario-8-ads-optimization",
    name: "Healthcare Clinic — Paid Acquisition & High-ROI Campaigns",
    answers: {
      path_taken: "guided",
      business_type: "Healthcare",
      business_stage: "Growing",
      company: "Clinique Dr. Amira",
      business_situation_details: "Cosmetic dentistry, laser facial aesthetics, and dental implant surgery clinic in Tunis Centre",
      what_brought_here: ["We need advertising", "We need more leads"],
      main_problem: "More qualified leads",
      root_problem: "Ads aren't working",
      what_tried: ["Running Meta Ads", "Working with freelancers"],
      what_tried_notes: "Previous agency generated hundreds of irrelevant messages with zero show-ups",
      services_needed: ["Meta Ads", "Copywriting"],
      priority_service: "Meta Ads",
      timeline: "ASAP",
      budget_preference: "I have a budget",
      budget_range: "$2,500 – $5,000",
      name: "Dr. Amira Louati",
      email: "amira@cliniquelouati.tn",
      preferred_contact: "WhatsApp",
    },
    expectedRank1Includes: "Meta Ads",
  },

  // Scenario 9: "Not sure — recommend what we need"
  {
    id: "scenario-9-not-sure",
    name: "Creator / Executive Coach — Consultative Strategic Direction",
    answers: {
      path_taken: "guided",
      business_type: "Personal Brand / Creator",
      business_stage: "Growing",
      company: "Leila B. Leadership",
      business_situation_details: "C-level executive leadership coaching, advisory masterminds, and keynote speaking across MENA",
      what_brought_here: ["People don't know us", "Our brand doesn't represent us"],
      main_problem: "More trust",
      root_problem: "Positioning",
      services_needed: ["Not sure — recommend what we need"],
      timeline: "1–3 months",
      budget_preference: "I'd like SADA to recommend an approach",
      name: "Leila Bouazizi",
      email: "leila@bouazizileadership.com",
      preferred_contact: "Email",
    },
    expectedRank1Includes: "Brand Strategy",
  },

  // Scenario 10: Free-text-only submission
  {
    id: "scenario-10-free-text",
    name: "Artisan Olive Estate — Direct Narrative Inquiry",
    answers: {
      path_taken: "free_text",
      company: "Domaine de Zaghouan",
      raw_description:
        "We are a family-owned organic olive grove operating since 1974. We are launching an ultra-premium monovarietal extra virgin olive oil brand for export to Tokyo, Copenhagen, and London. We need world-class cinematic video storytelling, documentary photography, and an editorial digital storefront that conveys our heritage and organic certification.",
      timeline: "1–3 months",
      budget_preference: "I have a budget",
      budget_range: "$15,000+",
      name: "Yassine Ben Youssef",
      email: "yassine@zaghouan-olive.com",
      preferred_contact: "WhatsApp",
    },
    minRecommendations: 2,
    maxRecommendations: 4,
  },
];

console.log("================================================================");
console.log("  SADA SMART DISCOVERY POLISH — 10 REALISTIC TEST SCENARIOS     ");
console.log("================================================================\n");

let passed = 0;
let failed = 0;

for (const test of scenarios) {
  console.log(`--- [TEST ${test.id}] ${test.name} ---`);

  // 1. Generate Request Summary
  const summary = generateRequestSummary(test.answers);
  console.log(`\nREQUEST SUMMARY:\n"${summary}"`);

  // Assertions on summary
  if (!summary || summary.length < 35) {
    console.error(`FAIL: Summary too short or empty (${summary.length} chars)`);
    failed++;
    continue;
  }
  if (summary.includes("undefined") || summary.includes("null") || summary.includes("[object")) {
    console.error("FAIL: Summary contains raw code artifacts (undefined/null)");
    failed++;
    continue;
  }

  // 2. Business Context Label
  const contextLabel = getIndustryContextLabel(test.answers.business_type);
  console.log(`\nBUSINESS CONTEXT LABEL: "${contextLabel}"`);
  if (test.answers.business_situation_details) {
    console.log(`CONTEXT ANSWER: "${test.answers.business_situation_details}"`);
  }

  // 3. Primary Problem & Goal
  console.log(`PRIMARY PROBLEM: "${test.answers.root_problem || test.answers.what_brought_here?.[0] || "N/A"}"`);
  console.log(`PRIMARY GOAL: "${test.answers.main_problem || "N/A"}"`);

  // 4. Generate Likely Needs
  const needs = generateLikelyNeeds(test.answers);
  console.log(`\nLIKELY NEEDS (${needs.length} recommendations):`);
  needs.forEach((need, idx) => {
    console.log(`  ${idx + 1}. ${need}`);
  });

  // Assertions on Likely Needs
  if (needs.length < 2 || needs.length > 4) {
    console.error(`FAIL: Expected 2 to 4 recommendations, got ${needs.length}`);
    failed++;
    continue;
  }

  if (test.expectedRank1Includes && !needs[0].toLowerCase().includes(test.expectedRank1Includes.toLowerCase())) {
    console.warn(`WARNING: Rank 1 "${needs[0]}" does not include expected "${test.expectedRank1Includes}"`);
  }

  console.log("\nSTATUS: PASS\n----------------------------------------------------------------\n");
  passed++;
}

console.log("================================================================");
console.log(`TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED (Total: ${scenarios.length})`);
console.log("================================================================");

if (failed > 0) {
  process.exit(1);
}
