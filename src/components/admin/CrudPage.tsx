import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X } from "lucide-react";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "url" | "boolean" | "date" | "tags";
  required?: boolean;
}

interface Props {
  table: string;
  title: string;
  fields: FieldDef[];
  display: (row: any) => { title: string; subtitle?: string; meta?: string };
  orderBy?: string;
  ascending?: boolean;
}

export function CrudPage({ table, title, fields, display, orderBy = "created_at", ascending = false }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from(table).select("*").order(orderBy, { ascending });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const body: any = {};
    for (const f of fields) {
      const v = fd.get(f.name);
      if (f.type === "boolean") body[f.name] = fd.get(f.name) === "on";
      else if (f.type === "number") body[f.name] = v ? Number(v) : null;
      else if (f.type === "tags") body[f.name] = v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : [];
      else body[f.name] = v || null;
    }
    if (table === "blog_posts" || table === "projects") {
      if (body.title && !body.slug) body.slug = String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    const op = editing
      ? (supabase as any).from(table).update(body).eq("id", editing.id)
      : (supabase as any).from(table).insert(body);
    const { error } = await op;
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-primary px-5 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2 neon-glow"><Plus className="size-4" />New</button>
      </div>

      <div className="grid gap-3">
        {rows.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">No items yet.</div>}
        {rows.map((r) => {
          const d = display(r);
          return (
            <div key={r.id} className="glass rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{d.title}</div>
                {d.subtitle && <div className="text-sm text-muted-foreground truncate">{d.subtitle}</div>}
                {d.meta && <div className="text-xs text-accent mt-1">{d.meta}</div>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setEditing(r); setOpen(true); }} className="size-9 grid place-items-center rounded-lg glass-strong hover:bg-primary/20"><Pencil className="size-4" /></button>
                <button onClick={() => remove(r.id)} className="size-9 grid place-items-center rounded-lg glass-strong hover:bg-destructive/20"><Trash2 className="size-4" /></button>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="glass-strong rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold">{editing ? "Edit" : "New"} {title.replace(/s$/, "")}</h2>
              <button type="button" onClick={() => setOpen(false)} className="size-8 grid place-items-center rounded-lg hover:bg-white/10"><X className="size-4" /></button>
            </div>
            <div className="space-y-3">
              {fields.map((f) => (
                <label key={f.name} className="block">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{f.label}{f.required && " *"}</span>
                  <div className="mt-1.5">
                    {f.type === "textarea" ? (
                      <textarea name={f.name} defaultValue={editing?.[f.name] ?? ""} required={f.required} rows={4} className="w-full glass rounded-xl px-3 py-2" />
                    ) : f.type === "boolean" ? (
                      <input type="checkbox" name={f.name} defaultChecked={editing?.[f.name] ?? false} className="size-5" />
                    ) : f.type === "tags" ? (
                      <input name={f.name} defaultValue={(editing?.[f.name] || []).join(", ")} placeholder="comma, separated" className="w-full glass rounded-xl px-3 py-2" />
                    ) : (
                      <input type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : "text"}
                        step="any" name={f.name}
                        defaultValue={editing?.[f.name] ?? ""} required={f.required}
                        className="w-full glass rounded-xl px-3 py-2" />
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button type="button" onClick={() => setOpen(false)} className="px-5 py-2.5 rounded-xl glass">Cancel</button>
              <button type="submit" className="bg-gradient-primary px-6 py-2.5 rounded-xl font-semibold">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
