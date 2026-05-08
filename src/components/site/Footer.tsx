import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Mail, MessageCircle } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative mt-32 border-t border-border/50">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-16 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 text-muted-foreground max-w-md">
            SADA is a creative digital agency where real identity begins. Content, branding, and growth — built for brands that refuse to be ignored.
          </p>
          <div className="mt-6 flex gap-3">
            {[Instagram, Linkedin, Mail, MessageCircle].map((Icon, i) => (
              <a key={i} href="#" className="glass w-10 h-10 rounded-xl grid place-items-center hover:cyan-glow hover:-translate-y-0.5 transition-all">
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-bold mb-4 tracking-widest">EXPLORE</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/services" className="hover:text-accent">Services</Link></li>
            <li><Link to="/portfolio" className="hover:text-accent">Portfolio</Link></li>
            <li><Link to="/about" className="hover:text-accent">About</Link></li>
            <li><Link to="/team" className="hover:text-accent">Team</Link></li>
            <li><Link to="/store" className="hover:text-accent">Store</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold mb-4 tracking-widest">CONTACT</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>hello@sada.media</li>
            <li>@sada.media.production</li>
            <li><Link to="/contact" className="hover:text-accent">Start a project →</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SADA Media Production. Content · Branding · Growth.
      </div>
    </footer>
  );
}
