import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Save,
  Eye,
  Globe,
  Trash2,
  MoreHorizontal,
  Copy,
  ChevronRight,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ContentStatusBadge } from "./ContentShell";
import type { ContentStatus } from "./content-utils";

// ============================================================
// SADA OS — Content Editor Shell
// The full-page editor furniture: sticky command bar, section nav,
// section cards and field primitives. Shared by all three CMS editors
// so CREATE → EDIT → SAVE DRAFT → PREVIEW → PUBLISH behaves identically.
// ============================================================

export interface EditorSectionDef<K extends string = string> {
  id: K;
  label: string;
  icon: LucideIcon;
}

export function EditorCommandBar({
  backTo,
  backLabel,
  title,
  fallbackTitle,
  subtitle,
  status,
  dirty,
  saving,
  canEdit,
  canDelete,
  previewUrl,
  onSaveDraft,
  onPublish,
  onUnpublish,
  onDuplicate,
  onDelete,
  publishLabel = "Publish",
  extraActions,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  fallbackTitle: string;
  subtitle: string;
  status: ContentStatus;
  dirty: boolean;
  saving: boolean;
  canEdit: boolean;
  canDelete: boolean;
  previewUrl?: string | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  publishLabel?: string;
  extraActions?: ReactNode;
}) {
  const isLive = status === "published" || status === "scheduled";

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-md px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={backTo}
            className="p-2 rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title={backLabel}
            aria-label={backLabel}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-bold text-base sm:text-lg truncate max-w-[42vw] sm:max-w-none">
                {title.trim() ? title : fallbackTitle}
              </h1>
              <ContentStatusBadge status={status} />
              {dirty && (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  • Unsaved
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-mono truncate">{subtitle}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors inline-flex items-center gap-1.5"
            >
              <Eye className="size-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </a>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-xl border border-border/90 bg-muted/40 hover:bg-muted text-xs font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              <span>{saving ? "Saving..." : "Save Draft"}</span>
            </button>
          )}

          {canEdit &&
            (isLive ? (
              <button
                type="button"
                onClick={onUnpublish}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-xl border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                onClick={onPublish}
                disabled={saving}
                className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Globe className="size-3.5" /> {publishLabel}
              </button>
            ))}

          {isLive && canEdit && (
            <button
              type="button"
              onClick={onPublish}
              disabled={saving}
              className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              Update
            </button>
          )}

          {(onDuplicate || (canDelete && onDelete) || extraActions) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {extraActions}
                {onDuplicate && (
                  <DropdownMenuItem onSelect={onDuplicate} className="gap-2">
                    <Copy className="size-4" /> Duplicate
                  </DropdownMenuItem>
                )}
                {canDelete && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={onDelete}
                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="size-4" /> Delete permanently
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}

/** Mobile pill nav + desktop sidebar nav over the editor sections. */
export function EditorSectionNav<K extends string>({
  sections,
  active,
  onSelect,
  readiness,
}: {
  sections: EditorSectionDef<K>[];
  active: K;
  onSelect: (id: K) => void;
  readiness?: { passed: number; total: number; allPassed: boolean };
}) {
  return (
    <>
      <div className="md:hidden -mx-1 flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-border/60 bg-card/40 p-1.5">
        {sections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => onSelect(sec.id)}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors shrink-0 ${
              active === sec.id
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      <aside className="hidden md:block">
        <div className="sticky top-20 rounded-2xl border border-border/80 bg-card/60 p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Content Sections
          </div>
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isCurrent = active === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSelect(sec.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{sec.label}</span>
                </div>
                {isCurrent && <ChevronRight className="size-3.5 shrink-0" />}
              </button>
            );
          })}

          {readiness && (
            <div className="mt-4 pt-4 border-t border-border/60 px-3 pb-1">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-muted-foreground">Publish Readiness</span>
                <span
                  className={readiness.allPassed ? "text-green-600 font-bold" : "text-amber-600"}
                >
                  {readiness.passed}/{readiness.total}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${readiness.allPassed ? "bg-green-500" : "bg-amber-500"}`}
                  style={{ width: `${(readiness.passed / Math.max(1, readiness.total)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function EditorSection({
  id,
  index,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-3xl border border-border/80 bg-card/60 p-5 sm:p-7 space-y-6 scroll-mt-24"
    >
      <div className="border-b border-border/60 pb-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
          <Icon className="size-4" /> Section {index}
        </div>
        <h2 className="text-xl font-bold font-display">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function EditorField({
  label,
  required,
  hint,
  counter,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  counter?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label
          htmlFor={htmlFor}
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {counter && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{counter}</span>
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

export const editorInputClass =
  "w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20";

export const editorTextareaClass =
  "w-full text-sm px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed";

/** Slug field with a fixed public-path prefix, matching the Case Studies editor. */
export function SlugField({
  prefix,
  value,
  onChange,
  placeholder,
}: {
  prefix: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center rounded-xl border border-border bg-muted/20 px-3 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
      <span className="text-xs font-mono text-muted-foreground/70 select-none shrink-0">
        {prefix}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 text-sm font-mono py-2.5 px-1 bg-transparent focus:outline-none"
      />
    </div>
  );
}

/** Add/remove list editor for text[] columns (deliverables, includes, features, tags). */
export function TagListEditor({
  items,
  onChange,
  placeholder,
  addLabel = "Add",
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed || items.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...items, trimmed]);
    setDraft("");
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={editorInputClass}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 px-3 py-2 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-muted transition-colors inline-flex items-center gap-1.5"
        >
          <Plus className="size-3.5" /> {addLabel}
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-xs font-medium text-foreground"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(items.filter((i) => i !== item))}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${item}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Google-style SERP preview so SEO copy is written against what it renders as. */
export function SerpPreview({
  url,
  title,
  description,
}: {
  url: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Search result preview
      </div>
      <div className="text-xs text-muted-foreground font-mono truncate">{url}</div>
      <div className="text-[17px] text-primary font-medium mt-0.5 truncate">
        {title || "Untitled"}
      </div>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
        {description || "No meta description set — search engines will pick their own snippet."}
      </p>
    </div>
  );
}

/** A labelled on/off row used for Featured / Published style switches. */
export function ToggleRow({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
          checked ? "bg-primary" : "bg-muted border border-border"
        }`}
      >
        <span
          className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Warns before a tab close / reload while the editor holds unsaved changes.
 * In-app navigation is guarded by the command bar's own confirmation.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/**
 * Tracks whether the editor differs from the last saved snapshot.
 * `snapshot` is a cheap serialisation of the form state.
 */
export function useDirtyTracker(snapshot: string, ready: boolean) {
  const baseline = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (baseline.current === null) {
      baseline.current = snapshot;
      return;
    }
    setDirty(baseline.current !== snapshot);
  }, [snapshot, ready]);

  const commit = (nextSnapshot: string) => {
    baseline.current = nextSnapshot;
    setDirty(false);
  };

  return { dirty, commit };
}
