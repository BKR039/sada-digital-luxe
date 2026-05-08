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
      <h1 className="font-display text-3xl font-bold mb-8">Inquiries</h1>
      <div className="space-y-3">
        {rows.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">No inquiries yet.</div>}
        {rows.map(r => (
          <details key={r.id} className="glass rounded-2xl p-5">
            <summary className="cursor-pointer flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold">{r.name} <span className="text-muted-foreground font-normal">· {r.email}</span></div>
                <div className="text-sm text-muted-foreground truncate">{r.business_name || "—"} · {r.service || "General"} · {r.budget || "—"}</div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleDateString()}</span>
            </summary>
            <div className="mt-4 pt-4 border-t border-border/50 space-y-2 text-sm">
              <p className="whitespace-pre-wrap">{r.message}</p>
              {r.phone && <p className="text-muted-foreground">Phone: {r.phone}</p>}
              <div className="flex gap-2 mt-3">
                <a href={`mailto:${r.email}`} className="inline-flex items-center gap-2 glass-strong px-4 py-2 rounded-lg text-sm"><Mail className="size-3.5" />Reply</a>
                <button onClick={() => remove(r.id)} className="inline-flex items-center gap-2 glass-strong px-4 py-2 rounded-lg text-sm hover:bg-destructive/20"><Trash2 className="size-3.5" />Delete</button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
