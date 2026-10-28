// SADA Smart Project Discovery — Types, Constants & Deterministic Helpers

export interface DiscoveryAnswers {
  path_taken: "guided" | "quick" | "free_text";
  business_type?: string;
  business_type_custom?: string;
  business_stage?: string;
  business_situation_details?: string;
  what_brought_here?: string[];
  what_brought_here_custom?: string;
  main_problem?: string;
  main_problem_custom?: string;
  root_problem?: string;
  root_problem_custom?: string;
  what_tried?: string[];
  what_tried_notes?: string;
  services_needed?: string[];
  priority_service?: string;
  timeline?: string;
  budget_preference?: string;
  budget_range?: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  preferred_contact: "WhatsApp" | "Phone" | "Email";
  additional_notes?: string;
  raw_description?: string;
  request_summary?: string;
  likely_needs?: string[];
}

export const BUSINESS_TYPES = [
  "E-commerce",
  "Restaurant / Café",
  "Travel & Tourism",
  "Real Estate",
  "Healthcare",
  "Education",
  "Technology / SaaS",
  "B2B / Company",
  "Professional Services",
  "Personal Brand / Creator",
  "Other",
] as const;

export const BUSINESS_STAGES = [
  "Just starting",
  "Already operating",
  "Growing",
  "Established",
  "Rebranding",
  "Launching something new",
] as const;

export const INDUSTRY_QUESTIONS: Record<string, { question: string; placeholder: string }> = {
  "E-commerce": {
    question: "What do you currently sell and where do customers buy?",
    placeholder: "e.g., Fashion apparel via Shopify and Instagram, shipping nationwide",
  },
  "Restaurant / Café": {
    question: "How do customers currently discover and order from you?",
    placeholder: "e.g., Mostly foot traffic and delivery apps, Instagram needs work",
  },
  "Travel & Tourism": {
    question: "What are your main travel services and destinations?",
    placeholder: "e.g., Inbound luxury tours, bespoke itineraries, hotel partnerships",
  },
  "Technology / SaaS": {
    question: "What are you building and who is your target user?",
    placeholder: "e.g., B2B workflow SaaS for logistics teams in North Africa",
  },
  "Real Estate": {
    question: "What types of properties or clients do you handle?",
    placeholder: "e.g., High-end residential villas and commercial retail spaces",
  },
  "Healthcare": {
    question: "What type of practice or healthcare service do you provide?",
    placeholder: "e.g., Specialized dental clinic expanding into cosmetic treatments",
  },
  "Education": {
    question: "What courses, training, or programs do you offer?",
    placeholder: "e.g., Professional certification academy with online and in-person cohorts",
  },
  "B2B / Company": {
    question: "What products or enterprise services do you provide?",
    placeholder: "e.g., Industrial packaging supplies for regional manufacturers",
  },
  "Professional Services": {
    question: "What is your specialized consulting or advisory area?",
    placeholder: "e.g., Financial advisory and corporate accounting firm",
  },
  "Personal Brand / Creator": {
    question: "What is your niche and primary audience?",
    placeholder: "e.g., Executive leadership coach building a premium mastermind",
  },
  Other: {
    question: "Describe your core offering and who you serve.",
    placeholder: "e.g., We provide custom artisan furniture for interior designers",
  },
};

export const WHAT_BROUGHT_OPTIONS = [
  "People don't know us",
  "Our brand doesn't represent us",
  "Social media isn't performing",
  "We need more customers",
  "We need more leads",
  "We need a website",
  "We need better content",
  "We need advertising",
  "We are launching something",
  "We need a rebrand",
  "We need automation / AI",
  "We're not sure what the problem is",
  "Other",
] as const;

export const MAIN_PROBLEM_OPTIONS = [
  "More customers",
  "More qualified leads",
  "More sales",
  "More trust",
  "Better brand image",
  "Better online presence",
  "Better conversion",
  "Launch successfully",
  "Save time / automate",
  "Other",
  "Not sure",
] as const;

export interface RootProblemBranch {
  question: string;
  options: string[];
}

export function getRootProblemBranch(
  mainProblem?: string,
  whatBrought?: string[]
): RootProblemBranch {
  const goal = (mainProblem || "").toLowerCase();
  const brought = (whatBrought || []).map((s) => s.toLowerCase());

  if (
    goal.includes("customer") ||
    goal.includes("sales") ||
    goal.includes("lead")
  ) {
    return {
      question: "What's stopping you from getting more customers today?",
      options: [
        "Not enough visibility",
        "People see us but don't contact us",
        "People contact us but don't buy",
        "Content doesn't convert",
        "Ads aren't working",
        "Website doesn't convert",
        "Offer isn't clear",
        "We don't know",
      ],
    };
  }

  if (
    goal.includes("website") ||
    goal.includes("online presence") ||
    goal.includes("conversion") ||
    brought.some((b) => b.includes("website"))
  ) {
    return {
      question: "What should the website achieve?",
      options: [
        "Generate leads",
        "Sell products",
        "Receive bookings",
        "Receive orders",
        "Present the business",
        "Showcase work",
        "Build credibility",
        "Internal platform",
        "Other",
      ],
    };
  }

  if (
    goal.includes("brand") ||
    goal.includes("trust") ||
    brought.some((b) => b.includes("rebrand") || b.includes("brand"))
  ) {
    return {
      question: "What needs to change with your brand?",
      options: [
        "Logo",
        "Visual identity",
        "Positioning",
        "Brand strategy",
        "Everything",
        "Starting from zero",
      ],
    };
  }

  if (brought.some((b) => b.includes("social media"))) {
    return {
      question: "What's your biggest social media bottleneck?",
      options: [
        "Reach & views",
        "Engagement",
        "Content quality",
        "Consistency",
        "Conversion",
        "Strategy",
        "Paid advertising",
        "Time & resources",
      ],
    };
  }

  if (brought.some((b) => b.includes("advertising"))) {
    return {
      question: "What's happening with your advertising?",
      options: [
        "Too expensive / poor ROI",
        "Not enough leads",
        "Poor lead quality",
        "Low sales conversion",
        "Creative isn't working",
        "Not sure",
      ],
    };
  }

  if (goal.includes("automate") || goal.includes("time")) {
    return {
      question: "Where is your business losing the most time?",
      options: [
        "Repetitive customer inquiries",
        "Manual booking & lead tracking",
        "Content creation & publishing",
        "Disorganized tools & spreadsheets",
        "Other",
      ],
    };
  }

  if (goal.includes("launch")) {
    return {
      question: "What is your key requirement for this launch?",
      options: [
        "Full brand & web presence",
        "High-converting landing page",
        "Launch campaign & video",
        "Social media announcement",
        "Other",
      ],
    };
  }

  return {
    question: "What feels most broken or frustrating right now?",
    options: [
      "Not enough visibility",
      "Credibility / trust isn't strong enough",
      "Technical execution is lacking",
      "Messaging doesn't click with clients",
      "Not sure",
    ],
  };
}

export const WHAT_TRIED_OPTIONS = [
  "In-house social media",
  "Running Meta Ads",
  "Running Google Ads",
  "Working with freelancers",
  "Working with another agency",
  "Word of mouth / Referrals",
  "Building our own website",
  "Cold outreach / Email",
  "Nothing yet",
] as const;

export interface SADA_SERVICE_CATEGORY {
  name: string;
  services: string[];
}

// Aligned strictly with SADA_CONTENT.md
export const SADA_SERVICES: SADA_SERVICE_CATEGORY[] = [
  {
    name: "Marketing",
    services: [
      "Branding",
      "Brand Strategy",
      "Visual Identity",
      "Logo",
      "Marketing Strategy",
      "Social Media",
      "Content",
      "Copywriting",
      "Meta Ads",
    ],
  },
  {
    name: "Development",
    services: [
      "Website",
      "Web Development",
      "UI/UX",
      "Automation",
      "AI",
    ],
  },
  {
    name: "Production",
    services: [
      "Photography",
      "Video Production",
      "Reels",
      "Commercial Production",
    ],
  },
];

export const TIMELINE_OPTIONS = [
  "ASAP",
  "Within 2 weeks",
  "This month",
  "1–3 months",
  "Just exploring",
] as const;

export const BUDGET_PREFERENCE_OPTIONS = [
  "I have a budget",
  "Not yet",
  "I'd like SADA to recommend an approach",
] as const;

export const BUDGET_RANGES = [
  "< $2,500",
  "$2,500 – $5,000",
  "$5,000 – $15,000",
  "$15,000+",
] as const;

export const PREFERRED_CONTACTS = [
  "WhatsApp",
  "Phone",
  "Email",
] as const;

export function getIndustryContextLabel(businessType?: string): string {
  const normalized = (businessType || "").toLowerCase();
  if (normalized.includes("restaurant") || normalized.includes("café") || normalized.includes("cafe")) {
    return "Discovery & Ordering Channels";
  }
  if (normalized.includes("travel") || normalized.includes("tourism")) {
    return "Travel Services & Destinations";
  }
  if (normalized.includes("e-commerce") || normalized.includes("ecommerce")) {
    return "Products & Sales Channels";
  }
  if (normalized.includes("real estate")) {
    return "Properties & Client Focus";
  }
  if (normalized.includes("tech") || normalized.includes("saas")) {
    return "Product & Target User";
  }
  if (normalized.includes("health")) {
    return "Care Focus & Specialized Practice";
  }
  if (normalized.includes("education")) {
    return "Programs & Courses Offered";
  }
  if (normalized.includes("b2b")) {
    return "Products & Enterprise Services";
  }
  if (normalized.includes("professional")) {
    return "Specialized Advisory Area";
  }
  if (normalized.includes("personal") || normalized.includes("creator")) {
    return "Niche & Target Audience";
  }
  return "Core Offering & Audience";
}

function formatSingleService(service: string): string {
  const map: Record<string, string> = {
    Branding: "branding",
    "Brand Strategy": "brand strategy",
    "Visual Identity": "visual identity",
    Logo: "logo design",
    "Marketing Strategy": "marketing strategy",
    "Social Media": "social media",
    Content: "content creation",
    Copywriting: "copywriting",
    "Meta Ads": "Meta advertising",
    Website: "a new website",
    "Web Development": "web development",
    "UI/UX": "UI/UX design",
    Automation: "automation",
    AI: "AI integration",
    Photography: "commercial photography",
    "Video Production": "video production",
    Reels: "reels production",
    "Commercial Production": "commercial production",
  };
  return map[service] || service.toLowerCase();
}

function formatServicesList(services: string[]): string {
  const cleaned = services.filter((s) => s !== "Not sure — recommend what we need");
  if (cleaned.length === 0) return "strategic digital services";
  const mapped = cleaned.map(formatSingleService);
  if (mapped.length === 1) return mapped[0];
  if (mapped.length === 2) return `${mapped[0]} and ${mapped[1]}`;
  return `${mapped.slice(0, -1).join(", ")}, and ${mapped[mapped.length - 1]}`;
}

/**
 * Generates a deterministic, consultant-grade brief summary from submitted answers.
 * No external AI API used.
 */
export function generateRequestSummary(data: Partial<DiscoveryAnswers>): string {
  // 1. Free-text path
  if (data.path_taken === "free_text") {
    const company = data.company?.trim();
    const desc = data.raw_description?.trim();
    const cleanDesc = desc
      ? `"${desc.length > 200 ? desc.slice(0, 197) + "..." : desc}"`
      : "direct project brief";
    const entity = company ? `${company}` : "The client";
    const timeline = data.timeline && data.timeline !== "This month"
      ? `They are looking to start ${data.timeline.toLowerCase()}.`
      : "They are looking to start this month.";
    const budget = data.budget_range
      ? `Allocated budget: ${data.budget_range}.`
      : data.budget_preference && data.budget_preference !== "Flexible"
      ? `Budget preference: ${data.budget_preference.toLowerCase()}.`
      : "";

    return `${entity} submitted a direct inquiry detailing their situation: ${cleanDesc}. ${timeline} ${budget}`
      .replace(/\s+/g, " ")
      .trim();
  }

  // 2. Quick path
  if (data.path_taken === "quick") {
    const company = data.company?.trim();
    const subject = company ? `${company}` : "The client";
    const services = data.services_needed && data.services_needed.length > 0
      ? formatServicesList(data.services_needed)
      : "strategic creative services";
    const priority =
      data.priority_service && data.priority_service !== "Not sure — recommend what we need"
        ? `, with ${formatSingleService(data.priority_service)} as the immediate focus`
        : "";
    const scope = data.raw_description?.trim()
      ? ` The inquiry notes: "${data.raw_description.trim()}."`
      : "";
    const timeline = data.timeline ? `They are looking to kick off ${data.timeline.toLowerCase()}` : "They are looking to start promptly";
    const budget = data.budget_range
      ? `with an allocated budget of ${data.budget_range}.`
      : data.budget_preference === "I'd like SADA to recommend an approach"
      ? "and requested SADA to advise on budget allocation."
      : ".";

    return `${subject} submitted a rapid inquiry requesting ${services}${priority}.${scope} ${timeline} ${budget}`
      .replace(/\s+/g, " ")
      .trim();
  }

  // 3. Guided path
  const company = data.company?.trim();

  // Business type natural naming
  const rawBiz =
    data.business_type === "Other"
      ? data.business_type_custom?.trim() || "business"
      : data.business_type || "business";
  const bizMap: Record<string, string> = {
    "Restaurant / Café": "restaurant and café",
    "Travel & Tourism": "travel agency",
    "Real Estate": "real estate business",
    "Technology / SaaS": "technology company",
    "E-commerce": "e-commerce brand",
    Healthcare: "healthcare practice",
    Education: "education and training provider",
    "B2B / Company": "B2B company",
    "Professional Services": "professional advisory firm",
    "Personal Brand / Creator": "personal brand",
  };
  const bizType = bizMap[rawBiz] || rawBiz.toLowerCase();

  // Stage descriptor
  const stage = data.business_stage || "";
  let stageDescriptor = "an established";
  if (stage === "Just starting") stageDescriptor = "a newly founded";
  else if (stage === "Already operating") stageDescriptor = "an operating";
  else if (stage === "Growing") stageDescriptor = "a growing";
  else if (stage === "Established") stageDescriptor = "an established";
  else if (stage === "Rebranding") stageDescriptor = "an established";
  else if (stage === "Launching something new") stageDescriptor = "an active business preparing to launch a new";

  // Goal phrasing
  const rawGoal = (data.main_problem || "").toLowerCase();
  let goalPhrase = "seeking to elevate its market presence";
  if (rawGoal.includes("trust")) goalPhrase = "looking to strengthen trust and present itself more professionally";
  else if (rawGoal.includes("brand image")) goalPhrase = "focused on elevating its brand image and market perception";
  else if (rawGoal.includes("online presence")) goalPhrase = "focused on building a stronger, more credible digital presence";
  else if (rawGoal.includes("sales")) goalPhrase = "focused on driving higher direct sales";
  else if (rawGoal.includes("customer")) goalPhrase = "looking to acquire more customers and expand its reach";
  else if (rawGoal.includes("qualified lead") || rawGoal.includes("lead")) goalPhrase = "focused on generating more qualified inbound leads";
  else if (rawGoal.includes("conversion")) goalPhrase = "aiming to improve customer conversion across its channels";
  else if (rawGoal.includes("launch")) goalPhrase = "preparing for a high-impact market launch";
  else if (rawGoal.includes("automate") || rawGoal.includes("time")) goalPhrase = "seeking to streamline operations and automate key client workflows";
  else if (rawGoal.includes("not sure")) goalPhrase = "seeking strategic guidance to identify its highest-leverage growth levers";

  // Sentence 1: Profile & Goal
  let sentence1 = "";
  if (company) {
    if (stage === "Rebranding") {
      sentence1 = `${company} is ${stageDescriptor} ${bizType} currently undergoing a strategic brand repositioning.`;
    } else {
      sentence1 = `${company} is ${stageDescriptor} ${bizType} ${goalPhrase}.`;
    }
  } else {
    if (stage === "Rebranding") {
      sentence1 = `An established ${bizType} undergoing a strategic brand repositioning.`;
    } else {
      const article = stageDescriptor.startsWith("a ") ? "A" : "An";
      sentence1 = `${article} ${stageDescriptor.replace(/^(a |an )/, "")} ${bizType} ${goalPhrase}.`;
    }
  }

  // Sentence 2: Challenge / Bottleneck
  const rawRoot = (data.root_problem || "").toLowerCase();
  let challengeSentence = "";
  if (rawRoot.includes("present the business")) {
    challengeSentence = "The main challenge is positioning the business clearly and building a stronger market presence.";
  } else if (rawRoot.includes("see us but don't order")) {
    challengeSentence = "The core bottleneck is that while prospective customers discover the brand, conversion into orders remains low.";
  } else if (rawRoot.includes("see us but don't contact")) {
    challengeSentence = "The primary bottleneck is converting initial awareness into direct inquiries.";
  } else if (rawRoot.includes("contact us but don't buy")) {
    challengeSentence = "The main challenge is that prospective clients reach out but drop off before purchasing.";
  } else if (rawRoot.includes("not enough visibility")) {
    challengeSentence = "The primary obstacle is a lack of sustained visibility and brand awareness in the market.";
  } else if (rawRoot.includes("content doesn't convert")) {
    challengeSentence = "Current content and social efforts are not translating into meaningful engagement or revenue.";
  } else if (rawRoot.includes("ads aren't working") || rawRoot.includes("poor roi")) {
    challengeSentence = "Paid advertising campaigns have yielded high acquisition costs without the desired return.";
  } else if (rawRoot.includes("website doesn't convert")) {
    challengeSentence = "The current website is underperforming and failing to convert visitors into customers.";
  } else if (rawRoot.includes("offer isn't clear")) {
    challengeSentence = "Their core offering and value proposition are not clearly understood by prospective clients.";
  } else if (rawRoot.includes("generate leads")) {
    challengeSentence = "The primary objective is turning web traffic into qualified inbound leads.";
  } else if (rawRoot.includes("sell products")) {
    challengeSentence = "The main focus is driving direct product sales through an optimized digital storefront.";
  } else if (rawRoot.includes("receive bookings")) {
    challengeSentence = "The primary requirement is an efficient online booking experience.";
  } else if (rawRoot.includes("build credibility")) {
    challengeSentence = "The primary focus is establishing market credibility and trust.";
  } else if (rawRoot.includes("starting from zero")) {
    challengeSentence = "They are building their brand and digital footprint from the ground up.";
  } else if (rawRoot.includes("everything")) {
    challengeSentence = "The project requires a comprehensive overhaul across branding, web presence, and content.";
  } else if (data.what_brought_here && data.what_brought_here.length > 0) {
    const cleanBrought = data.what_brought_here
      .filter((b) => b !== "Other" && b !== "We're not sure what the problem is")
      .map((b) => b.toLowerCase());
    if (cleanBrought.length > 0) {
      challengeSentence = `Key challenges identified include ${cleanBrought.join(" and ")}.`;
    }
  }

  // Sentence 3: Services & Priority
  let servicesSentence = "";
  const services = data.services_needed || [];
  const notSure = services.includes("Not sure — recommend what we need");

  if (notSure) {
    servicesSentence = "The team has requested SADA's strategic guidance to recommend the optimal service mix.";
  } else if (services.length === 1) {
    servicesSentence = `They are specifically seeking SADA's expertise in ${formatSingleService(services[0])}.`;
  } else if (services.length > 1) {
    const priority = data.priority_service && data.priority_service !== "Not sure — recommend what we need"
      ? data.priority_service
      : services[0];
    servicesSentence = `The team is considering ${formatServicesList(services)}, with ${formatSingleService(priority)} as the current priority.`;
  }

  // Sentence 4: Timeline & Budget
  let timelineText = "They are looking to begin this month";
  if (data.timeline === "ASAP") timelineText = "They are eager to start immediately";
  else if (data.timeline === "Within 2 weeks") timelineText = "They are aiming to kick off within the next two weeks";
  else if (data.timeline === "This month") timelineText = "They are looking to start this month";
  else if (data.timeline === "1–3 months") timelineText = "They are planning for a start over the next 1 to 3 months";
  else if (data.timeline === "Just exploring") timelineText = "They are currently in the planning and exploration phase";

  let budgetText = ".";
  if (data.budget_preference === "I have a budget" && data.budget_range) {
    budgetText = ` with a budget of ${data.budget_range}.`;
  } else if (data.budget_preference === "I'd like SADA to recommend an approach") {
    budgetText = ` and would like SADA to advise on the appropriate budget scope.`;
  } else if (data.budget_preference === "Not yet") {
    budgetText = ` with budget parameters open to discussion.`;
  }

  const sentence4 = `${timelineText}${budgetText}`;

  return [sentence1, challengeSentence, servicesSentence, sentence4]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

interface ServiceCandidate {
  title: string;
  category: "Marketing" | "Development" | "Production";
  score: number;
}

/**
 * Deterministically recommends 2 to 4 contextual SADA services based on intake answers.
 * Employs deterministic scoring based on business type, situation, problem, goal, and explicit signals.
 */
export function generateLikelyNeeds(data: Partial<DiscoveryAnswers>): string[] {
  const biz = (data.business_type || "").toLowerCase();
  const goal = (data.main_problem || "").toLowerCase();
  const root = (data.root_problem || "").toLowerCase();
  const situation = (data.business_situation_details || "").toLowerCase();
  const rawDesc = (data.raw_description || "").toLowerCase();
  const tried = (data.what_tried || []).map((t) => t.toLowerCase());
  const whatBrought = (data.what_brought_here || []).map((b) => b.toLowerCase());
  const servicesNeeded = data.services_needed || [];
  const priority = data.priority_service || "";
  const notSure = servicesNeeded.includes("Not sure — recommend what we need");

  // Candidate pool with contextual labels
  const candidates: Record<string, ServiceCandidate> = {
    branding: {
      title:
        biz.includes("real estate")
          ? "Brand Strategy & Premium Positioning"
          : biz.includes("restaurant") || biz.includes("cafe")
          ? "Visual Identity & Menu/Collateral Design"
          : "Brand Strategy & Visual Identity",
      category: "Marketing",
      score: 0,
    },
    website: {
      title:
        biz.includes("restaurant") || biz.includes("cafe")
          ? "Conversion-focused Website / Ordering Experience"
          : biz.includes("travel") || biz.includes("tourism")
          ? "Conversion-Focused Website & Inbound Booking Flow"
          : biz.includes("real estate")
          ? "High-End Property Showcase & Website"
          : biz.includes("e-commerce") || biz.includes("ecommerce")
          ? "High-Converting E-commerce Website"
          : biz.includes("education")
          ? "Student Acquisition Website & Landing Experience"
          : "Conversion-Focused Website & Web Development",
      category: "Development",
      score: 0,
    },
    ads: {
      title:
        biz.includes("restaurant") || biz.includes("cafe")
          ? "Meta Ads & Local Customer Acquisition"
          : biz.includes("travel") || biz.includes("tourism")
          ? "Meta Ads & Lead Generation Campaigns"
          : biz.includes("e-commerce") || biz.includes("ecommerce")
          ? "Meta Ads & Performance Marketing"
          : biz.includes("education")
          ? "Meta Ads & Student Enrollment Campaigns"
          : "Meta Ads & Paid Acquisition",
      category: "Marketing",
      score: 0,
    },
    content: {
      title:
        biz.includes("restaurant") || biz.includes("cafe")
          ? "Content & Social Conversion"
          : biz.includes("real estate")
          ? "Real Estate Content & Editorial Social"
          : "Content Creation & Social Media Strategy",
      category: "Marketing",
      score: 0,
    },
    video: {
      title:
        biz.includes("real estate")
          ? "Video Production & Architectural Reels"
          : biz.includes("restaurant") || biz.includes("cafe")
          ? "Food & Atmosphere Video Production"
          : "Video Production & High-Impact Reels",
      category: "Production",
      score: 0,
    },
    copywriting: {
      title: "Conversion Copywriting & Value Proposition",
      category: "Marketing",
      score: 0,
    },
    automation: {
      title: "Automation & Lead Workflow Integration",
      category: "Development",
      score: 0,
    },
  };

  // 1. Explicit priority signal (+60)
  if (priority && priority !== "Not sure — recommend what we need") {
    const p = priority.toLowerCase();
    if (p.includes("website") || p.includes("web") || p.includes("ui")) candidates.website.score += 60;
    else if (p.includes("brand") || p.includes("logo") || p.includes("identity")) candidates.branding.score += 60;
    else if (p.includes("ad")) candidates.ads.score += 60;
    else if (p.includes("content") || p.includes("social")) candidates.content.score += 60;
    else if (p.includes("video") || p.includes("reel") || p.includes("photo")) candidates.video.score += 60;
    else if (p.includes("copy")) candidates.copywriting.score += 60;
    else if (p.includes("auto") || p.includes("ai")) candidates.automation.score += 60;
  }

  // 2. Explicit services requested (+25 each)
  if (!notSure) {
    for (const s of servicesNeeded) {
      const low = s.toLowerCase();
      if (low.includes("website") || low.includes("web") || low.includes("ui")) candidates.website.score += 25;
      if (low.includes("brand") || low.includes("logo") || low.includes("identity")) candidates.branding.score += 25;
      if (low.includes("ad")) candidates.ads.score += 25;
      if (low.includes("content") || low.includes("social")) candidates.content.score += 25;
      if (low.includes("video") || low.includes("reel") || low.includes("photo")) candidates.video.score += 25;
      if (low.includes("copy")) candidates.copywriting.score += 25;
      if (low.includes("auto") || low.includes("ai")) candidates.automation.score += 25;
    }
  }

  // 3. Goal & Problem alignment
  if (goal.includes("sales") || goal.includes("customer") || goal.includes("lead") || goal.includes("conversion")) {
    if (root.includes("see us but don't order") || root.includes("website doesn't convert") || root.includes("see us but don't contact")) {
      candidates.website.score += 35;
      candidates.content.score += 25;
      candidates.ads.score += 20;
    } else if (root.includes("not enough visibility") || whatBrought.some((b) => b.includes("people don't know us"))) {
      candidates.ads.score += 35;
      candidates.video.score += 30;
      candidates.content.score += 25;
    } else if (root.includes("contact us but don't buy") || root.includes("offer isn't clear")) {
      candidates.copywriting.score += 35;
      candidates.branding.score += 30;
      candidates.website.score += 20;
    } else {
      candidates.website.score += 25;
      candidates.ads.score += 25;
    }
  }

  if (goal.includes("trust") || goal.includes("brand image") || whatBrought.some((b) => b.includes("brand doesn't represent us") || b.includes("rebrand"))) {
    candidates.branding.score += 45;
    candidates.website.score += 25;
    candidates.video.score += 20;
  }

  if (goal.includes("automate") || goal.includes("time") || root.includes("inquiries") || root.includes("booking")) {
    candidates.automation.score += 50;
    candidates.website.score += 25;
  }

  if (goal.includes("launch")) {
    candidates.branding.score += 30;
    candidates.website.score += 35;
    candidates.video.score += 25;
  }

  // 4. Industry nuances
  if (biz.includes("restaurant") || biz.includes("cafe")) {
    if (goal.includes("sales") || root.includes("order")) {
      candidates.website.score += 15;
      candidates.content.score += 15;
      candidates.ads.score += 10;
    }
  } else if (biz.includes("real estate")) {
    candidates.branding.score += 15;
    candidates.website.score += 15;
    candidates.video.score += 15;
  } else if (biz.includes("travel") || biz.includes("tourism")) {
    candidates.website.score += 20;
    candidates.ads.score += 20;
  } else if (biz.includes("e-commerce") || biz.includes("ecommerce")) {
    candidates.website.score += 25;
    candidates.ads.score += 25;
  } else if (biz.includes("education")) {
    candidates.website.score += 20;
    candidates.ads.score += 20;
  }

  // 5. What they tried nuances
  if (tried.some((t) => t.includes("meta ads") || t.includes("google ads"))) {
    candidates.copywriting.score += 15;
    candidates.website.score += 15;
  }
  if (tried.some((t) => t.includes("own website"))) {
    candidates.website.score += 20;
  }

  // 6. Free text / Raw description text keywords
  if (rawDesc || situation) {
    const text = `${rawDesc} ${situation}`;
    if (text.includes("video") || text.includes("cinema") || text.includes("film")) candidates.video.score += 30;
    if (text.includes("ad") || text.includes("campaign") || text.includes("acquisition")) candidates.ads.score += 25;
    if (text.includes("web") || text.includes("site") || text.includes("store")) candidates.website.score += 25;
    if (text.includes("brand") || text.includes("identity") || text.includes("story")) candidates.branding.score += 25;
  }

  // Sort candidate list by score descending
  const sorted = Object.values(candidates).sort((a, b) => b.score - a.score);

  // Take top 2 to 4 recommendations with positive score
  const results = sorted.filter((c) => c.score > 0).map((c) => c.title);

  if (results.length < 2) {
    return [candidates.website.title, candidates.branding.title];
  }

  return results.slice(0, 4);
}

/**
 * Formats a clean, readable text brief for the legacy message field (ensuring char_length >= 10 && <= 2000).
 */
export function formatDiscoveryBriefForMessage(data: Partial<DiscoveryAnswers>): string {
  const parts: string[] = [];

  const summary = generateRequestSummary(data);
  parts.push(`[REQUEST SUMMARY]\n${summary}`);

  if (data.raw_description) {
    parts.push(`\n[CLIENT DESCRIPTION]\n${data.raw_description}`);
  }

  if (data.business_situation_details) {
    const contextLabel = getIndustryContextLabel(data.business_type);
    parts.push(`\n[BUSINESS CONTEXT — ${contextLabel}]\n${data.business_situation_details}`);
  }

  if (data.what_brought_here && data.what_brought_here.length > 0) {
    parts.push(`\n[CHALLENGES]\n${data.what_brought_here.join(", ")}`);
  }

  if (data.what_tried && data.what_tried.length > 0) {
    parts.push(
      `\n[PREVIOUSLY TRIED]\n${data.what_tried.join(", ")}${
        data.what_tried_notes ? ` — Notes: ${data.what_tried_notes}` : ""
      }`
    );
  }

  if (data.additional_notes) {
    parts.push(`\n[ADDITIONAL NOTES]\n${data.additional_notes}`);
  }

  const result = parts.join("\n").trim();
  // Ensure between 10 and 1950 chars to be safely within DB limits
  if (result.length < 10) {
    return `${result} (Discovery inquiry submitted via SADA website)`;
  }
  return result.slice(0, 1950);
}

// -------------------------------------------------------------
// SADA Arabic Localization Dictionaries & Accessors for Discovery
// -------------------------------------------------------------

export const BUSINESS_TYPES_AR: Record<string, string> = {
  "E-commerce": "تجارة إلكترونية ومتاجر",
  "Restaurant / Café": "مطعم / مقهى وضيافة",
  "Travel & Tourism": "سياحة وسفر وحجوزات",
  "Real Estate": "عقارات وتطوير عقاري",
  "Healthcare": "رعاية صحية وعيادات",
  "Education": "تعليم وتدريب وأكاديميات",
  "Technology / SaaS": "تكنولوجيا وبرمجيات SaaS",
  "B2B / Company": "شركات B2B وخدمات مؤسسية",
  "Professional Services": "خدمات مهنية واستشارات",
  "Personal Brand / Creator": "علامة شخصية وصناع محتوى",
  Other: "مجال آخر",
};

export const BUSINESS_STAGES_AR: Record<string, string> = {
  "Just starting": "في مرحلة التأسيس والبداية",
  "Already operating": "قائم ونعمل حالياً",
  "Growing": "في مرحلة نمو وتوسع",
  "Established": "مؤسسة راسخة في السوق",
  "Rebranding": "إعادة بناء وتجديد العلامة التجارية",
  "Launching something new": "إطلاق مشروع أو منتج جديد",
};

export const WHAT_BROUGHT_OPTIONS_AR: Record<string, string> = {
  "People don't know us": "لا يعرفنا عدد كافٍ من الناس",
  "Our brand doesn't represent us": "هويتنا الحالية لا تعكس قيمتنا الحقيقية",
  "Social media isn't performing": "حسابات التواصل الاجتماعي لا تحقق نتائج",
  "We need more customers": "نحتاج إلى المزيد من العملاء والمبيعات",
  "We need more leads": "نحتاج إلى عملاء محتملين مهتمين (Leads)",
  "We need a website": "نحتاج إلى موقع إلكتروني احترافي",
  "We need better content": "نحتاج إلى إنتاج محتوى أعلى جودة",
  "We need advertising": "نحتاج إلى حملات إعلانية مدفوعة ومربحة",
  "We are launching something": "نحن بصدد إطلاق علامة أو منتج جديد",
  "We need a rebrand": "نحتاج إلى إعادة إطلاق هوية شاملة (Rebrand)",
  "We need automation / AI": "نحتاج إلى أتمتة العمليات وحلول الذكاء الاصطناعي",
  "We're not sure what the problem is": "لسنا متأكدين تماماً من سبب المشكلة",
  Other: "سبب آخر",
};

export const MAIN_PROBLEM_OPTIONS_AR: Record<string, string> = {
  "More customers": "عملاء أكثر ومبيعات أعلى",
  "More qualified leads": "استفسارات عملاء مؤهلين للشراء",
  "More sales": "زيادة المبيعات المباشرة",
  "More trust": "بناء الثقة ومصداقية العلامة",
  "Better brand image": "صورة وهوية أفخم للعلامة",
  "Better online presence": "تواجد رقمي قوي ومتكامل",
  "Better conversion": "رفع نسبة التحويل من زوار إلى عملاء",
  "Launch successfully": "إطلاق ناجح ومؤثر في السوق",
  "Save time / automate": "توفير الوقت وأتمتة المهام الروتينية",
  Other: "هدف آخر",
  "Not sure": "لست متأكداً",
};

export const TIMELINE_OPTIONS_AR: Record<string, string> = {
  ASAP: "في أسرع وقت ممكن (عاجل)",
  "Within 2 weeks": "خلال أسبوعين",
  "This month": "خلال هذا الشهر",
  "1–3 months": "خلال ١ إلى ٣ أشهر",
  "Just exploring": "أستكشف الخيارات المتاحة حالياً",
};

export const BUDGET_PREFERENCE_OPTIONS_AR: Record<string, string> = {
  "I have a budget": "لدي ميزانية محددة",
  "Not yet": "ليس بعد",
  "I'd like SADA to recommend an approach": "أفضل أن تقترح صدى النهج والحل الأنسب",
};

export const WHAT_TRIED_OPTIONS_AR: Record<string, string> = {
  "In-house social media": "إدارة السوشيال ميديا داخلياً",
  "Running Meta Ads": "إطلاق إعلانات ميتا (إنستغرام وفيسبوك)",
  "Running Google Ads": "إطلاق إعلانات جوجل",
  "Working with freelancers": "التعامل مع مستقلين",
  "Working with another agency": "التعامل مع وكالة أخرى",
  "Word of mouth / Referrals": "الاعتماد على التوصيات والمعارف",
  "Building our own website": "بناء الموقع بأنفسنا",
  "Cold outreach / Email": "التواصل المباشر والبريد الإلكتروني",
  "Nothing yet": "لم نجرب أي شيء بعد",
};

export const SADA_SERVICES_AR: Record<string, string> = {
  Marketing: "التسويق والاستراتيجية",
  Development: "التطوير البرمجي والتجربة الرقمية",
  Production: "الإنتاج وصناعة المحتوى الإبداعي",
  Branding: "بناء الهوية والعلامة التجارية",
  "Brand Strategy": "استراتيجية العلامة والتموضع",
  "Visual Identity": "الهوية البصرية والنظام التصميمي",
  Logo: "تصميم الشعار والعناصر البصرية",
  "Marketing Strategy": "الاستراتيجية التسويقية الشاملة",
  "Social Media": "إدارة وحضور وسائل التواصل الاجتماعي",
  Content: "صناعة المحتوى الإبداعي",
  Copywriting: "الكتابة الإعلانية والنصوص التسويقية",
  "Meta Ads": "إعلانات ميتا المدفوعة",
  Website: "موقع ويب احترافي",
  "Web Development": "تطوير وتصميم المواقع والتطبيقات",
  "UI/UX": "تصميم واجهة وتجربة المستخدم UI/UX",
  Automation: "أتمتة سير العمليات والربط التقني",
  AI: "حلول الذكاء الاصطناعي وتطبيقاته",
  Photography: "التصوير الفوتوغرافي الاحترافي",
  "Video Production": "الإنتاج المرئي وتصوير الفيديو",
  Reels: "إنتاج مقاطع الفيديو القصيرة (Reels)",
  "Commercial Production": "الإنتاج الإعلاني والتجاري الضخم",
};

export const ROOT_QUESTIONS_AR: Record<string, string> = {
  "What's stopping you from getting more customers today?": "ما الذي يمنعك من الحصول على المزيد من العملاء اليوم؟",
  "What should the website achieve?": "ما هو الهدف الأساسي الذي يجب أن يحققه الموقع الإلكتروني؟",
  "What needs to change with your brand?": "ما الذي يحتاج إلى تغيير في هويتك التجارية؟",
  "What's your biggest social media bottleneck?": "ما هي أكبر عقبة تواجهك في شبكات التواصل الاجتماعي؟",
  "What's happening with your advertising?": "ما الذي يحدث بالضبط مع إعلاناتك الممولة؟",
  "Where is your business losing the most time?": "أين يهدر مشروعك أو فريقك أكبر قدر من الوقت؟",
  "What is your key requirement for this launch?": "ما هو المطلب الجوهري لنجاح هذا الإطلاق؟",
  "What feels most broken or frustrating right now?": "ما هو الجانب الأكثر تعطيلاً أو إحباطاً في عملك حالياً؟",
};

export const ROOT_OPTIONS_AR: Record<string, string> = {
  "Not enough visibility": "ضعف الانتشار والظهور",
  "People see us but don't contact us": "الناس يروننا لكن لا يتواصلون معنا",
  "People contact us but don't buy": "يتواصلون معنا لكن لا تتم الصفقات",
  "Content doesn't convert": "المحتوى لا يجلب نتائج أو مبيعات",
  "Ads aren't working": "الإعلانات لا تحقق نتائج مجدية",
  "Website doesn't convert": "الموقع لا يحول الزوار إلى عملاء",
  "Offer isn't clear": "العرض التجاري غير واضح",
  "We don't know": "لا نعلم بالتحديد",
  "Generate leads": "جذب عملاء محتملين مؤهلين",
  "Sell products": "بيع المنتجات مباشرة",
  "Receive bookings": "استقبال الحجوزات والمواعيد",
  "Receive orders": "استقبال الطلبات",
  "Present the business": "تقديم الشركة بأرقى صورة مؤسسية",
  "Showcase work": "استعراض سابقة الأعمال والمشاريع",
  "Build credibility": "بناء الثقة والمصداقية",
  "Internal platform": "منصة عمل داخلية / بوابة مخصصة",
  "Logo": "الشعار والعناصر الأساسية",
  "Visual identity": "الهوية البصرية المتكاملة",
  "Positioning": "التموضع الاستراتيجي في السوق",
  "Brand strategy": "استراتيجية العلامة التجارية",
  "Everything": "تجديد شامل من البداية",
  "Starting from zero": "البدء من الصفر تماماً",
  "Reach & views": "الوصول والمشاهدات",
  "Engagement": "التفاعل والردود",
  "Content quality": "جودة وإنتاج المحتوى",
  "Consistency": "الاستمرارية والانتظام في النشر",
  "Conversion": "تحويل المتابعين إلى مشترين",
  "Strategy": "الخطة والاستراتيجية الواضحة",
  "Paid advertising": "الحملات الإعلانية الممولة",
  "Time & resources": "الوقت والموارد المتاحة",
  "Too expensive / poor ROI": "تكلفة مرتفعة ومردود استثماري ضعيف",
  "Not enough leads": "قلة عدد العملاء المحتملين",
  "Poor lead quality": "جودة العملاء المحتملين غير مناسبة",
  "Low sales conversion": "معدل إغلاق مبيعات منخفض",
  "Creative isn't working": "التصاميم والمحتوى الإعلاني لا يشد الانتباه",
  "Not sure": "لست متأكداً تماماً",
  "Repetitive customer inquiries": "استفسارات العملاء الروتينية المتكررة",
  "Manual booking & lead tracking": "إدارة المواعيد وتتبع العملاء يدوياً",
  "Content creation & publishing": "صناعة ونشر المحتوى باستمرار",
  "Disorganized tools & spreadsheets": "تشتت الأدوات وجداول البيانات غير المنظمة",
  "Full brand & web presence": "حضور متكامل للعلامة والموقع الإلكتروني",
  "High-converting landing page": "صفحة هبوط فائقة التحويل والإقناع",
  "Launch campaign & video": "حملة إطلاق شاملة وفيديو إعلاني احترافي",
  "Social media announcement": "إعلان وتجهيز حسابات التواصل الاجتماعي",
  "Credibility / trust isn't strong enough": "المصداقية والثقة بحاجة لتعزيز فوري",
  "Technical execution is lacking": "ضعف التنفيذ التقني والبرمجي",
  "Messaging doesn't click with clients": "الرسالة التسويقية لا تلامس تطلعات العملاء",
  "Other": "أخرى",
};

export function getLocalizedDiscoveryOption(val: string, lang: string): string {
  if (lang !== "ar") return val;
  return (
    BUSINESS_TYPES_AR[val] ||
    BUSINESS_STAGES_AR[val] ||
    WHAT_BROUGHT_OPTIONS_AR[val] ||
    MAIN_PROBLEM_OPTIONS_AR[val] ||
    TIMELINE_OPTIONS_AR[val] ||
    BUDGET_PREFERENCE_OPTIONS_AR[val] ||
    WHAT_TRIED_OPTIONS_AR[val] ||
    SADA_SERVICES_AR[val] ||
    ROOT_OPTIONS_AR[val] ||
    val
  );
}

