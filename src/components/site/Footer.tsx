import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Mail, MessageCircle } from "lucide-react";
import { Logo } from "./Logo";

const COLUMNS = [
  {
    heading: "Company",
    links: [
      { to: "/", label: "Home" },
      { to: "/services", label: "Services" },
      { to: "/portfolio", label: "Case Studies" },
      { to: "/store", label: "Products" },
      { to: "/team", label: "Team" },
      { to: "/pricing", label: "Pricing" },
      { to: "/about", label: "About" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { to: "/blog", label: "Articles" },
      { to: "/blog", label: "Guides" },
      { to: "/store", label: "Assets" },
      { to: "/store", label: "Courses" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { to: "/", label: "Privacy Policy" },
      { to: "/", label: "Terms of Service" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-border bg-gradient-soft">
      <div className="mx-auto max-w-7xl px-4 py-14 grid gap-10 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 text-muted-foreground max-w-md text-sm">
            SADA is a creative digital agency where real identity begins. Content, branding, and growth — built for brands that refuse to be ignored.
          </p>
          <div className="mt-6 flex gap-2">
            {[Instagram, Linkedin, Mail, MessageCircle].map((Icon, i) => (
              <a key={i} href="#" aria-label="Social link" className="size-10 rounded-xl border border-border bg-card grid place-items-center hover:bg-muted transition-colors">
                <Icon className="size-4" />
              </a>
            ))}
          </div>
          <div className="mt-6 text-sm text-muted-foreground space-y-1">
            <div>hello@sada.media</div>
            <div>@sada.media.production</div>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h4 className="text-xs font-bold mb-4 tracking-widest text-muted-foreground">{col.heading.toUpperCase()}</h4>
            <ul className="space-y-2 text-sm">
              {col.links.map((l, i) => (
                <li key={`${l.to}-${i}`}>
                  <Link to={l.to} className="text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SADA Media Production. Content · Branding · Growth.
      </div>
    </footer>
  );
}
