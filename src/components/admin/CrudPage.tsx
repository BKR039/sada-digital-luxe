import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Search } from "lucide-react";
import { MediaUpload, MediaUploadMulti } from "@/components/media/MediaUpload";
import { SmartMedia } from "@/components/media/SmartMedia";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "url" | "boolean" | "date" | "tags" | "media" | "media-list" | "json";
  required?: boolean;
  placeholder?: string;
  folder?: string;
  help?: string;
}

interface Props {
  table: string;
  title: string;
  fields: FieldDef[];
  display: (row: any) => { title: string; subtitle?: string; meta?: string; image?: string | null };
  orderBy?: string;
  ascending?: boolean;
  searchKeys?: string[];
}

export function CrudPage({ table, title, fields, display, orderBy = "created_at", ascending = false, searchKeys = ["title", "name"] }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from(table).select("*").order(orderBy, { ascending });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openNew = () => { setEditing(null); setDraft({}); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setDraft({ ...r }); setOpen(true); };

  const setField = (name: string, value: any) => setDraft((d) => ({ ...d, [name]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const body: any = { ...draft };
    for (const f of fields) {
      if (f.type === "media" || f.type === "media-list" || f.type === "json") continue; // handled in draft
      const v = fd.get(f.name);
      if (f.type === "boolean") body[f.name] = !!fd.get(f.name);
      else if (f.type === "number") body[f.name] = v ? Number(v) : null;
      else if (f.type === "tags") body[f.name] = v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : [];
      else body[f.name] = v || null;
    }
    if ((table === "blog_posts" || table === "projects") && body.title && !body.slug) {
      body.slug = String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    const op = editing
      ? (supabase as any).from(table).update(body).eq("id", editing.id)
      : (supabase as any).from(table).insert(body);
    const { error } = await op;
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setOpen(false); setEditing(null); setDraft({}); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const filtered = q
    ? rows.filter((r) => searchKeys.some((k) => String(r[k] || "").toLowerCase().includes(q.toLowerCase())))
    : rows;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length} item{rows.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
          </div>
          <button onClick={openNew} className="bg-gradient-primary text-white px-5 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2 neon-glow hover:scale-[1.03] transition-transform"><Plus className="size-4" />New</button>
        </div>
      </div>

      <div className="grid gap-3">
        {loading && <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">Loading…</div>}
        {!loading && filtered.length === 0 && <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">No items yet.</div>}
        {filtered.map((r) => {
          const d = display(r);
          return (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-3 flex items-center justify-between gap-4 soft-shadow hover:elevated-shadow hover:border-primary/30 transition-all">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {d.image !== undefined && (
                  <div className="size-16 shrink-0 rounded-xl overflow-hidden bg-muted">
                    <SmartMedia src={d.image} className="w-full h-full" autoplay={false} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{d.title}</div>
                  {d.subtitle && <div className="text-sm text-muted-foreground truncate">{d.subtitle}</div>}
                  {d.meta && <div className="text-xs text-primary font-medium mt-1">{d.meta}</div>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(r)} className="size-9 grid place-items-center rounded-lg border border-border bg-card hover:bg-primary hover:text-white hover:border-primary transition-colors" aria-label="Edit"><Pencil className="size-4" /></button>
                <button onClick={() => remove(r.id)} className="size-9 grid place-items-center rounded-lg border border-border bg-card hover:bg-destructive hover:text-white hover:border-destructive transition-colors" aria-label="Delete"><Trash2 className="size-4" /></button>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-foreground/40 backdrop-blur-md animate-in fade-in" onClick={() => setOpen(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-3xl elevated-shadow w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-in zoom-in-95 fade-in">
            <div className="flex items-center justify-between sticky top-0 bg-card/95 backdrop-blur px-6 py-4 z-10 rounded-t-3xl border-b border-border">
              <h2 className="font-display text-xl font-bold">{editing ? "Edit" : "New"} {title.replace(/s$/, "")}</h2>
              <button type="button" onClick={() => setOpen(false)} className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><X className="size-4" /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              {fields.map((f) => (
                <label key={f.name} className="block">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{f.label}{f.required && " *"}</span>
                  <div className="mt-1.5">
                    {f.type === "media" ? (
                      <MediaUpload value={draft[f.name] ?? ""} onChange={(v) => setField(f.name, v)} folder={f.folder || table} label={f.placeholder || `Upload ${f.label}`} />
                    ) : f.type === "media-list" ? (
                      <MediaUploadMulti value={draft[f.name] || []} onChange={(v) => setField(f.name, v)} folder={f.folder || table} />
                    ) : f.type === "textarea" ? (
                      <textarea name={f.name} defaultValue={editing?.[f.name] ?? ""} required={f.required} rows={4} placeholder={f.placeholder} className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
                    ) : f.type === "boolean" ? (
                      <input type="checkbox" name={f.name} defaultChecked={editing?.[f.name] ?? false} className="size-5 accent-primary" />
                    ) : f.type === "tags" ? (
                      <input name={f.name} defaultValue={(editing?.[f.name] || []).join(", ")} placeholder={f.placeholder || "comma, separated"} className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
                    ) : f.type === "json" ? (
                      <textarea name={f.name} defaultValue={editing?.[f.name] ? JSON.stringify(editing[f.name], null, 2) : ""} rows={4} placeholder={f.placeholder || '{ "instagram": "https://..." }'}
                        onBlur={(e) => { try { setField(f.name, e.target.value ? JSON.parse(e.target.value) : {}); } catch { /* keep raw */ } }}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono text-xs" />
                    ) : (
                      <input type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : "text"}
                        step="any" name={f.name} placeholder={f.placeholder}
                        defaultValue={editing?.[f.name] ?? ""} required={f.required}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
                    )}
                    {f.help && <div className="text-[11px] text-muted-foreground mt-1">{f.help}</div>}
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-6 flex gap-3 justify-end sticky bottom-0 bg-card/80 backdrop-blur -mx-6 -mb-6 px-6 py-4 rounded-b-3xl">
              <button type="button" onClick={() => setOpen(false)} className="px-5 py-2.5 rounded-xl glass">Cancel</button>
              <button type="submit" className="bg-gradient-primary px-6 py-2.5 rounded-xl font-semibold neon-glow">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
