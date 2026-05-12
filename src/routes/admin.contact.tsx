import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/contact")({ component: Inquiries });

function Inquiries() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => supabase.from("contact_submissions").select("*").order("created_at", { ascending: false }).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);
  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("contact_submissions").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };
  return (
    <div>
      <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-2">Inquiries</h1>
      <p className="text-sm text-muted-foreground mb-8">{rows.length} message{rows.length === 1 ? "" : "s"}</p>
      <div className="space-y-3">
        {rows.length === 0 && <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">No inquiries yet.</div>}
        {rows.map(r => (
          <details key={r.id} className="rounded-2xl border border-border bg-card p-5 soft-shadow hover:elevated-shadow transition-all">
            <summary className="cursor-pointer flex items-center justify-between gap-4 list-none">
              <div className="min-w-0">
                <div className="font-semibold">{r.name} <span className="text-muted-foreground font-normal">· {r.email}</span></div>
                <div className="text-sm text-muted-foreground truncate">{r.business_name || "—"} · {r.service || "General"} · {r.budget || "—"}</div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleDateString()}</span>
            </summary>
            <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
              <p className="whitespace-pre-wrap">{r.message}</p>
              {r.phone && <p className="text-muted-foreground">Phone: {r.phone}</p>}
              <div className="flex gap-2 mt-3">
                <a href={`mailto:${r.email}`} className="inline-flex items-center gap-2 bg-gradient-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:scale-[1.03] transition-transform"><Mail className="size-3.5" />Reply</a>
                <button onClick={() => remove(r.id)} className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 rounded-lg text-sm hover:bg-destructive hover:text-white hover:border-destructive transition-colors"><Trash2 className="size-3.5" />Delete</button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
