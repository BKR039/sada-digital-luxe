import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Mail, MessageCircle } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-border bg-gradient-soft">
      <div className="mx-auto max-w-7xl px-4 py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 text-muted-foreground max-w-md text-sm">
            SADA is a creative digital agency where real identity begins. Content, branding, and growth — built for brands that refuse to be ignored.
          </p>
          <div className="mt-6 flex gap-2">
            {[Instagram, Linkedin, Mail, MessageCircle].map((Icon, i) => (
              <a key={i} href="#" className="size-10 rounded-xl border border-border bg-card grid place-items-center hover:bg-muted transition-colors">
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold mb-4 tracking-widest text-muted-foreground">EXPLORE</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/services" className="text-muted-foreground hover:text-foreground transition-colors">Services</Link></li>
            <li><Link to="/portfolio" className="text-muted-foreground hover:text-foreground transition-colors">Portfolio</Link></li>
            <li><Link to="/store" className="text-muted-foreground hover:text-foreground transition-colors">Products</Link></li>
            <li><Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
            <li><Link to="/team" className="text-muted-foreground hover:text-foreground transition-colors">Team</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold mb-4 tracking-widest text-muted-foreground">CONTACT</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>hello@sada.media</li>
            <li>@sada.media.production</li>
            <li><Link to="/contact" className="text-primary hover:underline">Start a project →</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SADA Media Production. Content · Branding · Growth.
      </div>
    </footer>
  );
}
