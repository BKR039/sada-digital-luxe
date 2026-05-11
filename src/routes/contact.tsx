import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Mail, MessageCircle, Phone, Send, CheckCircle2 } from "lucide-react";
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

function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", business_name: "", service: "", budget: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 space-y-5">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary">CONTACT</p>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">Let's build <span className="text-gradient">your brand.</span></h1>
          <p className="text-muted-foreground">Tell us about your brand. We typically reply within 24 hours.</p>
          <div className="space-y-3 pt-4">
            <a href="mailto:hello@sada.media" className="glass rounded-2xl p-4 flex items-center gap-4 hover:cyan-glow transition-all">
              <div className="size-11 rounded-xl bg-gradient-primary grid place-items-center"><Mail className="size-5" /></div>
              <div><div className="text-xs text-muted-foreground">Email</div><div className="font-semibold">hello@sada.media</div></div>
            </a>
            <a href="https://wa.me/" className="glass rounded-2xl p-4 flex items-center gap-4 hover:cyan-glow transition-all">
              <div className="size-11 rounded-xl bg-gradient-primary grid place-items-center"><MessageCircle className="size-5" /></div>
              <div><div className="text-xs text-muted-foreground">WhatsApp</div><div className="font-semibold">Chat now</div></div>
            </a>
            <a href="tel:+0" className="glass rounded-2xl p-4 flex items-center gap-4 hover:cyan-glow transition-all">
              <div className="size-11 rounded-xl bg-gradient-primary grid place-items-center"><Phone className="size-5" /></div>
              <div><div className="text-xs text-muted-foreground">Phone</div><div className="font-semibold">Schedule a call</div></div>
            </a>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-3 glass-strong rounded-3xl p-8">
          {done ? (
            <div className="text-center py-12">
              <CheckCircle2 className="size-16 text-accent mx-auto mb-5" />
              <h2 className="font-display text-3xl font-bold">Message received.</h2>
              <p className="mt-3 text-muted-foreground">We'll get back to you very soon.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Name *"><input required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></Field>
                <Field label="Email *"><input required type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} /></Field>
                <Field label="Phone"><input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} /></Field>
                <Field label="Business name"><input value={form.business_name} onChange={(e) => setForm(f => ({ ...f, business_name: e.target.value }))} className={inputCls} /></Field>
                <Field label="Service needed">
                  <select value={form.service} onChange={(e) => setForm(f => ({ ...f, service: e.target.value }))} className={inputCls}>
                    <option value="">Select</option>
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Budget">
                  <select value={form.budget} onChange={(e) => setForm(f => ({ ...f, budget: e.target.value }))} className={inputCls}>
                    <option value="">Select</option>
                    {BUDGETS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Tell us about your project *">
                <textarea required rows={5} value={form.message} onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))} className={inputCls} />
              </Field>
              <button disabled={loading} type="submit"
                className="w-full bg-gradient-primary py-4 rounded-2xl font-semibold neon-glow hover:scale-[1.01] transition-transform disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {loading ? "Sending..." : <>Send message <Send className="size-4" /></>}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}

const inputCls = "w-full glass rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/60";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span><div className="mt-1.5">{children}</div></label>;
}
