import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Search } from "lucide-react";
import { MediaUpload, MediaUploadMulti } from "@/components/media/MediaUpload";
import { SmartMedia } from "@/components/media/SmartMedia";
import { SADADatePicker, SADASwitch, SADAInput, SADATextarea, SADACounter, SADADialog, SADAConfirmDialog } from "@/components/ui/sada-ui";

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

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    const { error } = await (supabase as any).from(table).delete().eq("id", deleteTargetId);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Deleted");
      setDeleteTargetId(null);
      load();
    }
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
                <button onClick={() => openEdit(r)} className="size-9 grid place-items-center rounded-lg border border-border bg-card hover:bg-primary hover:text-white hover:border-primary transition-colors cursor-pointer" aria-label="Edit"><Pencil className="size-4" /></button>
                <button onClick={() => setDeleteTargetId(r.id)} className="size-9 grid place-items-center rounded-lg border border-border bg-card hover:bg-destructive hover:text-white hover:border-destructive transition-colors cursor-pointer" aria-label="Delete"><Trash2 className="size-4" /></button>
              </div>
            </div>
          );
        })}
      </div>

      <SADADialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setEditing(null);
            setDraft({});
          }
        }}
        size="large"
        title={`${editing ? "Edit" : "New"} ${title.replace(/s$/, "")}`}
        footer={
          <div className="flex gap-2.5 justify-end w-full">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditing(null);
                setDraft({});
              }}
              className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="crud-form"
              className="bg-primary text-white px-5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Save changes
            </button>
          </div>
        }
      >
        <form id="crud-form" onSubmit={save} className="space-y-4">
          {fields.map((f) => (
            <label key={f.name} className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{f.label}{f.required && " *"}</span>
              <div className="mt-1.5">
                {f.type === "media" ? (
                  <MediaUpload value={draft[f.name] ?? ""} onChange={(v) => setField(f.name, v)} folder={f.folder || table} label={f.placeholder || `Upload ${f.label}`} />
                ) : f.type === "media-list" ? (
                  <MediaUploadMulti value={draft[f.name] || []} onChange={(v) => setField(f.name, v)} folder={f.folder || table} />
                ) : f.type === "textarea" ? (
                  <SADATextarea
                    name={f.name}
                    defaultValue={editing?.[f.name] ?? ""}
                    required={f.required}
                    rows={4}
                    placeholder={f.placeholder}
                    onChange={(e) => setField(f.name, e.target.value)}
                  />
                ) : f.type === "boolean" ? (
                  <div className="pt-1">
                    <SADASwitch
                      id={`crud-bool-${f.name}`}
                      name={f.name}
                      checked={Boolean(draft[f.name] ?? editing?.[f.name] ?? false)}
                      onCheckedChange={(val) => setField(f.name, val)}
                      label={f.label}
                    />
                  </div>
                ) : f.type === "number" ? (
                  <SADACounter
                    name={f.name}
                    value={draft[f.name] !== undefined ? Number(draft[f.name]) : (editing?.[f.name] !== undefined ? Number(editing[f.name]) : 0)}
                    onChange={(val) => setField(f.name, val)}
                    className="w-full"
                  />
                ) : f.type === "tags" ? (
                  <SADAInput
                    name={f.name}
                    defaultValue={(editing?.[f.name] || []).join(", ")}
                    placeholder={f.placeholder || "comma, separated"}
                    onChange={(e) => setField(f.name, e.target.value.split(",").map(t => t.trim()).filter(Boolean))}
                  />
                ) : f.type === "json" ? (
                  <SADATextarea
                    name={f.name}
                    defaultValue={editing?.[f.name] ? JSON.stringify(editing[f.name], null, 2) : ""}
                    rows={4}
                    placeholder={f.placeholder || '{ "instagram": "https://..." }'}
                    onBlur={(e) => {
                      if (!e.target.value.trim()) { setField(f.name, null); return; }
                      try { setField(f.name, JSON.parse(e.target.value)); }
                      catch { toast.error(`${f.label} is not valid JSON — this field won't be saved until it's fixed.`); }
                    }}
                    className="font-mono text-xs"
                  />
                ) : f.type === "date" ? (
                  <SADADatePicker
                    name={f.name}
                    value={draft[f.name] ?? editing?.[f.name] ?? ""}
                    onChange={(val) => setField(f.name, val)}
                    placeholder={f.placeholder || `Select ${f.label.toLowerCase()}...`}
                  />
                ) : (
                  <SADAInput
                    type={f.type === "url" ? "url" : "text"}
                    name={f.name}
                    placeholder={f.placeholder}
                    defaultValue={editing?.[f.name] ?? ""}
                    required={f.required}
                    onChange={(e) => setField(f.name, e.target.value)}
                  />
                )}
                {f.help && <div className="text-[11px] text-muted-foreground mt-1">{f.help}</div>}
              </div>
            </label>
          ))}
        </form>
      </SADADialog>

      <SADAConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(isOpen) => !isOpen && setDeleteTargetId(null)}
        title="Delete Item?"
        description="Are you sure you want to permanently delete this item? This action cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete Item"}
        variant="destructive"
        isLoading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
