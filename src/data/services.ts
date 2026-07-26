import { Megaphone, Code2, Clapperboard, type LucideIcon } from "lucide-react";

export interface Division {
  id: "marketing" | "development" | "production";
  number: string;
  name: string;
  icon: LucideIcon;
  oneLiner: string;
  services: string[];
  exploreCta: string;
  detail: {
    heading: string;
    problem: string;
    provides: string[];
    deliverables: string[];
    cta: string;
  };
}

export const DIVISIONS: Division[] = [
  {
    id: "marketing",
    number: "01",
    name: "Marketing",
    icon: Megaphone,
    oneLiner: "Build a brand people recognize and a strategy that moves it forward.",
    services: ["Brand Strategy", "Branding", "Content Strategy", "Social Media", "Advertising", "Growth"],
    exploreCta: "Explore Marketing",
    detail: {
      heading: "Marketing that starts with strategy.",
      problem:
        "Posting content without positioning, strategy or clear objectives creates activity — not necessarily growth.",
      provides: [
        "Brand Strategy",
        "Brand Positioning",
        "Visual Identity",
        "Marketing Strategy",
        "Content Strategy",
        "Social Media Management",
        "Paid Campaigns",
        "Growth Planning",
      ],
      deliverables: [
        "Strategy documents",
        "Brand systems",
        "Content calendars",
        "Campaign concepts",
        "Social media systems",
        "Ad creatives",
        "Performance reports",
      ],
      cta: "Discuss Your Marketing",
    },
  },
  {
    id: "development",
    number: "02",
    name: "Development",
    icon: Code2,
    oneLiner: "Turn ideas into digital experiences built around your business.",
    services: ["Web Design", "Development", "UI/UX", "Digital Products", "Automation", "AI Integration"],
    exploreCta: "Explore Development",
    detail: {
      heading: "Digital products built around the business.",
      problem:
        "A website or digital product should do more than look good. It should communicate clearly, work properly and support a business objective.",
      provides: [
        "UI/UX",
        "Web Design",
        "Web Development",
        "Landing Pages",
        "Web Apps",
        "Digital Products",
        "Automation",
        "AI Integration",
      ],
      deliverables: [
        "UX architecture",
        "Wireframes",
        "UI systems",
        "Responsive websites",
        "Landing pages",
        "Dashboards",
        "Web applications",
        "Automated workflows",
      ],
      cta: "Discuss Your Project",
    },
  },
  {
    id: "production",
    number: "03",
    name: "Production",
    icon: Clapperboard,
    oneLiner: "Turn strategy and ideas into content people experience.",
    services: ["Creative Direction", "Video", "Photography", "Reels", "Motion", "Campaign Production"],
    exploreCta: "Explore Production",
    detail: {
      heading: "Production with a reason behind every frame.",
      problem:
        "Good equipment alone does not create effective content. Strong production starts with concept, message, creative direction and execution.",
      provides: [
        "Creative Direction",
        "Reels",
        "Commercial Videos",
        "Photography",
        "Product Content",
        "Motion",
        "Campaign Production",
      ],
      deliverables: [
        "Concepts",
        "Scripts",
        "Storyboards",
        "Photography",
        "Edited videos",
        "Short-form content",
        "Campaign assets",
        "Motion graphics",
      ],
      cta: "Plan a Production",
    },
  },
];

export interface Scenario {
  number: string;
  question: string;
  combination: string[];
  cta: string;
}

export const SCENARIOS: Scenario[] = [
  {
    number: "01",
    question: "I'm launching a new business.",
    combination: ["Brand Strategy", "Visual Identity", "Website", "Launch Content"],
    cta: "Build My Brand",
  },
  {
    number: "02",
    question: "My business exists, but the brand feels weak.",
    combination: ["Brand Audit", "Brand Strategy", "Visual Identity", "Content System"],
    cta: "Strengthen My Brand",
  },
  {
    number: "03",
    question: "I need more visibility and customers.",
    combination: ["Marketing Strategy", "Content", "Social Media", "Advertising"],
    cta: "Grow My Business",
  },
  {
    number: "04",
    question: "I need a stronger digital presence.",
    combination: ["Website", "UI/UX", "Development", "Automation"],
    cta: "Build My Digital Presence",
  },
];

export const PROCESS: { number: string; name: string; description: string }[] = [
  { number: "01", name: "Discover", description: "Understand the business, audience and objective." },
  { number: "02", name: "Strategize", description: "Define the direction and priorities." },
  { number: "03", name: "Create", description: "Design, develop or produce the required solution." },
  { number: "04", name: "Launch", description: "Put the work into the market." },
  { number: "05", name: "Improve", description: "Measure, learn and optimize where applicable." },
];
