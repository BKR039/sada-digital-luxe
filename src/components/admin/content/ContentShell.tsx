import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Star, type LucideIcon } from "lucide-react";
import { SADASelect, type SADASelectOption } from "@/components/ui/sada-select";
import { SADASearch } from "@/components/ui/sada-search";
import { Skeleton } from "@/components/ui/sada-skeleton";
import { STATUS_META, type ContentStatus } from "./content-utils";

// ============================================================
// SADA OS — Content System Shell
// The list-workspace furniture shared by the Blog, Digital Products
// and Client Proof CMS: header, KPIs, toolbar, badges, empty state.
// Matches the Case Studies CMS visual grammar exactly — this is not a
// new visual language, it is the existing one factored into one place.
// ============================================================

export function ContentHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
          {eyebrow}
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      {action}
    </div>
  );
}

export interface ContentKpi {
  label: string;
  value: number;
  tone?: "neutral" | "published" | "draft" | "scheduled" | "featured";
  subtitle?: string;
}

const KPI_TONES: Record<NonNullable<ContentKpi["tone"]>, string> = {
  neutral: "text-foreground",
  published: "text-green-600 dark:text-green-400",
  draft: "text-amber-600 dark:text-amber-400",
  scheduled: "text-sky-600 dark:text-sky-400",
  featured: "text-purple-600 dark:text-purple-400",
};

export function ContentKpiGrid({ items }: { items: ContentKpi[] }) {
  return (
    <div
      className={`grid gap-3 sm:gap-4 grid-cols-2 ${items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      {items.map((kpi) => {
        const tone = KPI_TONES[kpi.tone || "neutral"];
        return (
          <div key={kpi.label} className="p-4 rounded-2xl border border-border/70 bg-card/60 flex flex-col justify-between">
            <div>
              <div
                className={`text-xs uppercase font-bold tracking-wider ${kpi.tone && kpi.tone !== "neutral" ? tone : "text-muted-foreground"}`}
              >
                {kpi.label}
              </div>
              <div className={`text-2xl sm:text-3xl font-bold font-display mt-1 ${tone}`}>
                {kpi.value}
              </div>
            </div>
            {kpi.subtitle && (
              <div className="text-[11px] text-muted-foreground mt-1.5 font-medium">
                {kpi.subtitle}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${meta.badgeClass}`}
    >
      <span className={`size-1.5 rounded-full ${meta.dotClass}`} />
      {meta.label}
    </span>
  );
}

export function ContentFeaturedBadge({ label = "Featured" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
      <Star className="size-3 fill-current" /> {label}
    </span>
  );
}

export interface StatusTab {
  value: string;
  label: string;
  count: number;
  tone?: "neutral" | "published" | "draft" | "scheduled" | "featured";
}

/**
 * Search + status tabs + filter selects. Every dropdown here is a SADASelect —
 * no native <select> ever reaches the DOM in these workspaces.
 */
export function ContentToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  tabs,
  activeTab,
  onTabChange,
  filters,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  tabs: StatusTab[];
  activeTab: string;
  onTabChange: (value: string) => void;
  filters?: {
    key: string;
    value: string;
    onChange: (value: string) => void;
    options: SADASelectOption[];
    ariaLabel: string;
    minWidth?: string;
  }[];
}) {
  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-card/40">
      <div className="flex-1 lg:max-w-md">
        <SADASearch
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          size="compact"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
        <div className="inline-flex items-center p-1 rounded-xl bg-muted/60 border border-border/60 text-xs shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value;
            const tone =
              tab.tone && tab.tone !== "neutral" ? KPI_TONES[tab.tone] : "text-foreground";
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onTabChange(tab.value)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? `bg-card shadow-xs font-semibold ${tone}`
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        {filters?.map((filter) => (
          <SADASelect
            key={filter.key}
            value={filter.value}
            onChange={filter.onChange}
            size="compact"
            aria-label={filter.ariaLabel}
            className={`w-auto shrink-0 ${filter.minWidth || "min-w-[150px]"}`}
            options={filter.options}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Contextual empty state — explains what the system is for and offers the
 * action that resolves it. Never a bare "No items yet."
 */
export function ContentEmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: { label: string; to: string; params?: Record<string, string> };
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 sm:p-14 text-center">
      <div className="size-12 rounded-2xl bg-muted grid place-items-center mx-auto text-muted-foreground mb-3">
        <Icon className="size-6" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
        {primaryAction && (
          <Link
            to={primaryAction.to}
            params={primaryAction.params as never}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
          >
            {primaryAction.label}
          </Link>
        )}
        {secondaryAction}
      </div>
    </div>
  );
}

export function ContentListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading content…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex items-center gap-4"
        >
          <Skeleton className="size-20 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md opacity-80" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ContentErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-10 text-center">
      <h3 className="text-base font-bold text-destructive">Could not load this content</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
