import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Mail, MessageCircle, Phone, Send, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  business_name: z.string().trim().max(120).optional().or(z.literal("")),
  service: z.string().max(80).optional().or(z.literal("")),
  budget: z.string().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(2000),
});

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — SADA" }, { name: "description", content: "Get in touch with SADA. We reply within 24 hours." }] }),
  component: Contact,
});

const SERVICES = ["Content Creation", "Branding", "Social Media", "Web Design", "Paid Ads", "Full Package"];
const BUDGETS = ["< $1k", "$1k–$5k", "$5k–$15k", "$15k+"];

type FormState = {
  name: string; email: string; phone: string;
  business_name: string; service: string; budget: string; message: string;
};

function Contact() {
  const [form, setForm] = useState<FormState>({ name: "", email: "", phone: "", business_name: "", service: "", budget: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("contact_submissions").insert(parsed.data);
    setLoading(false);
    if (error) {
      toast.error("Something went wrong. Try again.");
      return;
    }
    setDone(true);
    toast.success("Message sent. We'll be in touch within 24h.");
  };

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-5 gap-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="lg:col-span-2 space-y-5">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary">CONTACT</p>
          <h1 className="text-5xl md:text-6xl font-bold leading-[1.05]">Let's build <span className="text-gradient">your brand.</span></h1>
          <p className="text-muted-foreground">Tell us about your brand. We typically reply within 24 hours.</p>
          <div className="space-y-3 pt-4">
            {[
              { Icon: Mail, label: "Email", value: "hello@sada.media", href: "mailto:hello@sada.media" },
              { Icon: MessageCircle, label: "WhatsApp", value: "Chat now", href: "https://wa.me/" },
              { Icon: Phone, label: "Phone", value: "Schedule a call", href: "tel:+0" },
            ].map(({ Icon, label, value, href }) => (
              <a key={label} href={href}
                 className="group rounded-2xl p-4 flex items-center gap-4 border border-border bg-card soft-shadow hover:elevated-shadow hover:-translate-y-0.5 transition-all">
                <div className="size-11 rounded-xl bg-gradient-primary grid place-items-center shrink-0">
                  <Icon className="size-5 text-white" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="font-semibold">{value}</div>
                </div>
              </a>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
          className="lg:col-span-3 rounded-3xl border border-border bg-card p-6 sm:p-8 elevated-shadow">
          {done ? (
            <div className="text-center py-12">
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }}>
                <CheckCircle2 className="size-16 text-primary mx-auto mb-5" />
              </motion.div>
              <h2 className="font-display text-3xl font-bold">Message received.</h2>
              <p className="mt-3 text-muted-foreground">We'll get back to you very soon.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="grid sm:grid-cols-2 gap-4">
                <FloatField id="name" label="Full name" required value={form.name} onChange={(v) => set("name", v)} />
                <FloatField id="email" label="Email address" type="email" required value={form.email} onChange={(v) => set("email", v)} />
                <FloatField id="phone" label="Phone (optional)" value={form.phone} onChange={(v) => set("phone", v)} />
                <FloatField id="business" label="Business name" value={form.business_name} onChange={(v) => set("business_name", v)} />
                <FloatSelect id="service" label="Service needed" value={form.service} onChange={(v) => set("service", v)} options={SERVICES} />
                <FloatSelect id="budget" label="Budget range" value={form.budget} onChange={(v) => set("budget", v)} options={BUDGETS} />
              </div>
              <FloatField id="message" label="Tell us about your project" required textarea value={form.message} onChange={(v) => set("message", v)} />
              <button disabled={loading} type="submit"
                className="group w-full bg-gradient-primary text-white py-4 rounded-2xl font-semibold neon-glow hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
                {loading
                  ? <><Loader2 className="size-4 animate-spin" /> Sending…</>
                  : <>Send message <Send className="size-4 group-hover:translate-x-0.5 transition-transform" /></>}
              </button>
              <p className="text-[11px] text-center text-muted-foreground">By sending, you agree to be contacted by our team.</p>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Premium floating-label fields ---------- */

const baseField =
  "peer w-full bg-transparent border border-border rounded-xl px-4 pt-5 pb-2 text-sm text-foreground " +
  "outline-none transition-all duration-200 " +
  "focus:border-primary focus:ring-4 focus:ring-primary/15 " +
  "hover:border-foreground/20";

const baseLabel =
  "pointer-events-none absolute left-4 top-3.5 text-xs uppercase tracking-wider text-muted-foreground " +
  "transition-all duration-200 " +
  "peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal " +
  "peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-primary";

function FloatField({
  id, label, value, onChange, type = "text", required = false, textarea = false,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; textarea?: boolean;
}) {
  return (
    <div className={`relative ${textarea ? "sm:col-span-2" : ""}`}>
      {textarea ? (
        <textarea
          id={id} required={required} rows={5}
          placeholder=" "
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseField + " resize-none min-h-[140px] pt-6"}
        />
      ) : (
        <input
          id={id} type={type} required={required}
          placeholder=" "
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseField}
        />
      )}
      <label htmlFor={id} className={baseLabel}>
        {label}{required && <span className="text-primary"> *</span>}
      </label>
    </div>
  );
}

function FloatSelect({
  id, label, value, onChange, options,
}: { id: string; label: string; value: string; onChange: (v: string) => void; options: string[]; }) {
  const filled = value.length > 0;
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={baseField + " appearance-none cursor-pointer pr-10"}
      >
        <option value="" />
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <label htmlFor={id}
        className={
          "pointer-events-none absolute left-4 transition-all duration-200 " +
          (filled
            ? "top-1.5 text-[10px] uppercase tracking-wider text-primary"
            : "top-4 text-sm text-muted-foreground")
        }>
        {label}
      </label>
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">▾</span>
    </div>
  );
}
