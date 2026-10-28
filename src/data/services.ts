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

export const DIVISIONS_AR: Division[] = [
  {
    id: "marketing",
    number: "01",
    name: "التسويق",
    icon: Megaphone,
    oneLiner: "بناء علامة تجارية يثق بها الجمهور واستراتيجية تدفعها للأمام بثبات.",
    services: ["استراتيجية العلامة", "بناء الهوية", "استراتيجية المحتوى", "التواصل الاجتماعي", "الإعلانات الممولة", "النمو"],
    exploreCta: "استكشف خدمات التسويق",
    detail: {
      heading: "تسويق يبدأ من الاستراتيجية والتموضع الحقيقي.",
      problem:
        "نشر المحتوى دون تموضع واستراتيجية وأهداف واضحة يخلق نشاطاً وحركة — لكنه لا يصنع نمواً حقيقياً لأعمالك.",
      provides: [
        "استراتيجية العلامة التجارية",
        "تموضع السوق والمنافسة",
        "الهوية البصرية المتكاملة",
        "الخطة التسويقية الاستراتيجية",
        "استراتيجية صناعة المحتوى",
        "إدارة شبكات التواصل الاجتماعي",
        "الحملات الإعلانية الممولة",
        "تخطيط وتوسيع قنوات النمو",
      ],
      deliverables: [
        "وثائق الاستراتيجية الشاملة",
        "كتيب إرشادات العلامة (Brand Guidelines)",
        "جداول وخطط المحتوى الشهري",
        "مفاهيم الحملات التسويقية",
        "منظومات إدارة المحتوى",
        "تصاميم ونصوص الإعلانات الممولة",
        "تقارير تحليل الأداء والعائد",
      ],
      cta: "ناقش خطتك التسويقية",
    },
  },
  {
    id: "development",
    number: "02",
    name: "البرمجة والتطوير",
    icon: Code2,
    oneLiner: "تحويل الأفكار إلى منصات وتجارب رقمية مصممة خصيصاً لخدمة أهداف عملك.",
    services: ["تصميم واجهات المستخدم", "تطوير المواقع", "تجربة المستخدم", "المنتجات الرقمية", "الأتمتة", "تكامل الذكاء الاصطناعي"],
    exploreCta: "استكشف خدمات البرمجة",
    detail: {
      heading: "منتجات وتطبيقات رقمية مهيأة للأداء والسرعة والتحويل.",
      problem:
        "الموقع أو المنتج الرقمي يجب ألا يقتصر على المظهر الجميل فحسب، بل يجب أن يتواصل بوضوح، ويعمل بكفاءة مطلقة، ويدعم أهداف العمل بفعالية.",
      provides: [
        "تصميم تجربة المستخدم (UI/UX)",
        "تصميم وتطوير المواقع الفاخرة",
        "تطوير الويب فائق السرعة",
        "صفحات الهبوط المخصصة للتحويل",
        "تطبيقات الويب والمنصات السحابية",
        "المنتجات والأدوات الرقمية",
        "أتمتة العمليات الرقمية",
        "تكامل تقنيات الذكاء الاصطناعي",
      ],
      deliverables: [
        "هيكلية تجربة المستخدم (UX Architecture)",
        "المخططات الهيكلية (Wireframes)",
        "أنظمة التصميم الرقمي (UI Systems)",
        "مواقع متجاوبة فائقة السرعة",
        "صفحات هبوط عالية التحويل",
        "لوحات تحكم وإدارة مخصصة",
        "تطبيقات ومنصات ويب متكاملة",
        "سير عمل مؤتمت لتقليل التكاليف",
      ],
      cta: "ناقش مشروعك البرمجي",
    },
  },
  {
    id: "production",
    number: "03",
    name: "الإنتاج المرئي",
    icon: Clapperboard,
    oneLiner: "تحويل الاستراتيجية والأفكار إلى تجارب بصرية سينمائية تستوقف المشاهدين.",
    services: ["الإخراج الإبداعي", "الفيديو السينمائي", "التصوير الفوتوغرافي", "فيديوهات الريلز", "الموشن جرافيك", "إنتاج الحملات الإعلانية"],
    exploreCta: "استكشف خدمات الإنتاج",
    detail: {
      heading: "إنتاج سينمائي ينبض بالمعنى في كل لقطة وإطار.",
      problem:
        "المعدات المتطورة وحدها لا تصنع محتوى مؤثراً. الإنتاج القوي يبدأ من الفكرة الذكية، الرسالة الصادقة، والإخراج الإبداعي المتقن والتنفيذ الاحترافي.",
      provides: [
        "الإشراف والإخراج الإبداعي",
        "إنتاج فيديوهات الريلز القصيرة",
        "الفيديوهات والإعلانات التجارية",
        "التصوير الفوتوغرافي الاحترافي",
        "محتوى المنتجات والخدمات",
        "الموشن جرافيك والمؤثرات البصرية",
        "الإنتاج الكامل للحملات",
      ],
      deliverables: [
        "الأفكار والرؤى البصرية",
        "السيناريوهات والنصوص المكتوبة",
        "لوحات القصة (Storyboards)",
        "ألبومات الصور المعالجة بأعلى دقة",
        "فيديوهات سينمائية مكتملة المونتاج",
        "محتوى مرئي قصير للمنصات",
        "أصول ومواد الحملات الرقمية",
        "رسوم متحركة وموشن جرافيك",
      ],
      cta: "خطط لإنتاجك المرئي",
    },
  },
];

export const SCENARIOS_AR: Scenario[] = [
  {
    number: "01",
    question: "أطلق نشاطاً تجارياً أو مشروعاً جديداً.",
    combination: ["استراتيجية العلامة", "الهوية البصرية", "موقع إلكتروني", "محتوى الإطلاق"],
    cta: "ابنِ علامتي التجارية",
  },
  {
    number: "02",
    question: "عملي قائم بالفعل، لكن الحضور الرقمي يبدو باهتاً.",
    combination: ["تدقيق العلامة", "استراتيجية العلامة", "تحديث الهوية", "منظومة المحتوى"],
    cta: "عزّز علامتي التجارية",
  },
  {
    number: "03",
    question: "أحتاج إلى وصول أكبر واكتساب عملاء جدد.",
    combination: ["الخطة التسويقية", "صناعة المحتوى", "التواصل الاجتماعي", "الإعلانات الممولة"],
    cta: "نمِّ أعمالي التجارية",
  },
  {
    number: "04",
    question: "أحتاج إلى منصة وحضور رقمي أقوى وأكثر احترافية.",
    combination: ["موقع إلكتروني", "تصميم UI/UX", "تطوير المنصة", "أتمتة العمليات"],
    cta: "ابنِ منصتي الرقمية",
  },
];

export const PROCESS_AR = [
  { number: "01", name: "الاستكشاف والتحليل", description: "فهم طبيعة العمل، الجمهور المستهدف، والأهداف الاستراتيجية." },
  { number: "02", name: "التخطيط والاستراتيجية", description: "رسم المسار، تحديد الأولويات، ووضع خطة العمل الدقيقة." },
  { number: "03", name: "التنفيذ الإبداعي", description: "تصميم، برمجة، أو إنتاج الحل المتفق عليه بأعلى معايير الإتقان." },
  { number: "04", name: "الإطلاق في السوق", description: "طرح الأعمال في السوق باحترافية وضمان جاهزيتها الكاملة." },
  { number: "05", name: "القياس والتحسين", description: "تتبع الأداء، قياس ردود الأفعال، وتحسين العائد الاستثماري." },
];

export function getLocalizedDivisions(lang: "en" | "ar"): Division[] {
  return lang === "ar" ? DIVISIONS_AR : DIVISIONS;
}

export function getLocalizedScenarios(lang: "en" | "ar"): Scenario[] {
  return lang === "ar" ? SCENARIOS_AR : SCENARIOS;
}

export function getLocalizedProcess(lang: "en" | "ar"): { number: string; name: string; description: string }[] {
  return lang === "ar" ? PROCESS_AR : PROCESS;
}
