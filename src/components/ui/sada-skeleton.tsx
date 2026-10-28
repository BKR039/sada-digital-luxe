import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// BASE SKELETON PRIMITIVE
// ============================================================================

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
  width?: string | number;
  height?: string | number;
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
}

const roundedMap = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
};

/**
 * Base Skeleton primitive
 * Hardware-accelerated shimmer, zero layout shift, theme-adaptive
 */
export function Skeleton({
  className,
  shimmer = true,
  width,
  height,
  rounded = "xl",
  style,
  ...props
}: SkeletonProps) {
  const inlineStyle: React.CSSProperties = {
    ...(width !== undefined ? { width: typeof width === "number" ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === "number" ? `${height}px` : height } : {}),
    ...style,
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "sada-skeleton-base block select-none pointer-events-none max-w-full",
        roundedMap[rounded] || "rounded-xl",
        shimmer && "sada-skeleton-shimmer",
        className
      )}
      style={inlineStyle}
      {...props}
    />
  );
}

// Canonical Aliases
export const SADASkeleton = Skeleton;
export const SadaSkeleton = Skeleton;

// ============================================================================
// SKELETON TEXT & TYPOGRAPHY
// ============================================================================

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
  lastLineWidth?: string;
  gap?: string;
  size?: "xs" | "sm" | "md" | "lg";
  shimmer?: boolean;
}

const textSizeMap = {
  xs: "h-2.5",
  sm: "h-3",
  md: "h-3.5",
  lg: "h-4",
};

/**
 * Multi-line text block with organic line-width variation
 */
export function SkeletonText({
  lines = 3,
  lastLineWidth = "65%",
  gap = "space-y-2",
  size = "md",
  shimmer = true,
  className,
  ...props
}: SkeletonTextProps) {
  const heights = textSizeMap[size] || "h-3.5";
  const widths = ["w-full", "w-[94%]", "w-[88%]", "w-[96%]", "w-[82%]"];

  return (
    <div aria-hidden="true" className={cn("w-full", gap, className)} {...props}>
      {Array.from({ length: lines }).map((_, idx) => {
        const isLast = idx === lines - 1;
        const widthClass = isLast ? "" : widths[idx % widths.length];

        return (
          <Skeleton
            key={idx}
            height={heights}
            shimmer={shimmer}
            rounded="md"
            className={cn("w-full", widthClass)}
            style={isLast ? { width: lastLineWidth } : undefined}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// SKELETON TITLE
// ============================================================================

export interface SkeletonTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
  width?: string;
  eyebrow?: boolean;
  subtitle?: boolean;
  shimmer?: boolean;
}

const titleSizeMap = {
  sm: "h-4 w-36",
  md: "h-6 w-48",
  lg: "h-8 w-64",
  xl: "h-9 sm:h-10 w-80",
};

export function SkeletonTitle({
  size = "lg",
  width,
  eyebrow = false,
  subtitle = false,
  shimmer = true,
  className,
  ...props
}: SkeletonTitleProps) {
  return (
    <div aria-hidden="true" className={cn("space-y-2", className)} {...props}>
      {eyebrow && <Skeleton className="h-3.5 w-24 rounded-md" shimmer={shimmer} />}
      <Skeleton
        className={cn(titleSizeMap[size] || "h-8 w-64", width && "w-auto")}
        style={width ? { width } : undefined}
        rounded="xl"
        shimmer={shimmer}
      />
      {subtitle && <Skeleton className="h-3.5 w-72 rounded-md opacity-80" shimmer={shimmer} />}
    </div>
  );
}

// ============================================================================
// SKELETON AVATAR
// ============================================================================

export interface SkeletonAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "rounded";
  shimmer?: boolean;
}

const avatarSizeMap = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
  xl: "size-16",
};

export function SkeletonAvatar({
  size = "md",
  shape = "circle",
  shimmer = true,
  className,
  ...props
}: SkeletonAvatarProps) {
  return (
    <Skeleton
      aria-hidden="true"
      className={cn(avatarSizeMap[size] || "size-10", shape === "circle" ? "rounded-full" : "rounded-2xl", className)}
      shimmer={shimmer}
      {...props}
    />
  );
}

// ============================================================================
// SKELETON BUTTON
// ============================================================================

export interface SkeletonButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "icon";
  width?: string;
  shimmer?: boolean;
}

const buttonSizeMap = {
  sm: "h-8 px-3 rounded-lg w-20",
  md: "h-9 px-4 rounded-xl w-24",
  lg: "h-11 px-5 rounded-xl w-32",
  icon: "size-9 rounded-xl",
};

export function SkeletonButton({
  size = "md",
  width,
  shimmer = true,
  className,
  style,
  ...props
}: SkeletonButtonProps) {
  return (
    <Skeleton
      aria-hidden="true"
      className={cn(buttonSizeMap[size] || "h-9 w-24 rounded-xl", className)}
      style={{ ...(width ? { width } : {}), ...style }}
      shimmer={shimmer}
      {...props}
    />
  );
}

// ============================================================================
// SKELETON CARD
// ============================================================================

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hasHeader?: boolean;
  hasFooter?: boolean;
  shimmer?: boolean;
}

export function SkeletonCard({
  hasHeader = true,
  hasFooter = false,
  shimmer = true,
  className,
  children,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        "p-5 rounded-3xl border border-border bg-card soft-shadow space-y-4 relative overflow-hidden",
        className
      )}
      {...props}
    >
      <span className="sr-only">Loading card content...</span>
      <div aria-hidden="true" className="space-y-4">
      {hasHeader && (
        <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-3">
          <Skeleton className="h-4 w-32 rounded-lg" shimmer={shimmer} />
          <Skeleton className="size-6 rounded-lg" shimmer={shimmer} />
        </div>
      )}
      {children || (
        <div className="space-y-3 py-1">
          <Skeleton className="h-8 w-3/4 rounded-xl" shimmer={shimmer} />
          <Skeleton className="h-3.5 w-1/2 rounded-md opacity-80" shimmer={shimmer} />
        </div>
      )}
      {hasFooter && (
        <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-3">
          <Skeleton className="h-3.5 w-20 rounded-md" shimmer={shimmer} />
          <Skeleton className="h-3.5 w-16 rounded-md" shimmer={shimmer} />
        </div>
      )}
      </div>
    </div>
  );
}

// Canonical Aliases
export const SADACardSkeleton = SkeletonCard;
export const SadaCardSkeleton = SkeletonCard;

// ============================================================================
// SKELETON METRIC (KPI CARD)
// ============================================================================

export interface SkeletonMetricProps extends React.HTMLAttributes<HTMLDivElement> {
  hasTrend?: boolean;
  hasIcon?: boolean;
  hasSubtext?: boolean;
  shimmer?: boolean;
}

/**
 * Exact layout match for SADA Financial & Operations KPI cards
 */
export function SkeletonMetric({
  hasTrend = true,
  hasIcon = true,
  hasSubtext = true,
  shimmer = true,
  className,
  ...props
}: SkeletonMetricProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        "p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border bg-card soft-shadow space-y-3 sm:space-y-3.5 flex flex-col justify-between relative overflow-hidden",
        className
      )}
      {...props}
    >
      <span className="sr-only">Loading metric data...</span>
      <div aria-hidden="true" className="space-y-3 sm:space-y-3.5 flex flex-col justify-between h-full">
        {/* Top: Label + Icon */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3.5 w-20 sm:w-24 rounded-md" shimmer={shimmer} />
          {hasIcon && <Skeleton className="size-6 sm:size-7 rounded-lg sm:rounded-xl" shimmer={shimmer} />}
        </div>

        {/* Main KPI Value */}
        <div className="space-y-1 py-0.5">
          <Skeleton className="h-7 sm:h-8 w-24 sm:w-32 rounded-xl" shimmer={shimmer} />
        </div>

        {/* Bottom: Trend Badge + Subtitle */}
        {(hasTrend || hasSubtext) && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
            {hasTrend && <Skeleton className="h-4 w-14 sm:w-16 rounded-md" shimmer={shimmer} />}
            {hasSubtext && <Skeleton className="h-3 w-16 sm:w-24 rounded-md opacity-80" shimmer={shimmer} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON ROW & TABLE
// ============================================================================

export interface SkeletonRowProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: number;
  hasCheckbox?: boolean;
  hasActions?: boolean;
  shimmer?: boolean;
}

export function SkeletonRow({
  cols = 5,
  hasCheckbox = false,
  hasActions = true,
  shimmer = true,
  className,
  ...props
}: SkeletonRowProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("p-4 flex items-center gap-4 transition-colors", className)}
      {...props}
    >
      {hasCheckbox && <Skeleton className="size-4 rounded-md shrink-0" shimmer={shimmer} />}
      <Skeleton className="h-4 w-32 rounded-md shrink-0" shimmer={shimmer} />
      {Array.from({ length: Math.max(1, cols - 1) }).map((_, c) => (
        <Skeleton key={c} className="h-3.5 flex-1 rounded-md" shimmer={shimmer} />
      ))}
      {hasActions && <Skeleton className="h-7 w-16 rounded-lg shrink-0" shimmer={shimmer} />}
    </div>
  );
}

export interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number;
  cols?: number;
  hasHeader?: boolean;
  hasCheckbox?: boolean;
  hasActions?: boolean;
  shimmer?: boolean;
}

export function SkeletonTable({
  rows = 5,
  cols = 5,
  hasHeader = true,
  hasCheckbox = false,
  hasActions = true,
  shimmer = true,
  className,
  ...props
}: SkeletonTableProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn("w-full space-y-3", className)}
      {...props}
    >
      <span className="sr-only">Loading table records...</span>

      {/* Desktop Tabular Skeleton */}
      <div
        aria-hidden="true"
        className="hidden md:block w-full border border-border rounded-3xl bg-card overflow-hidden soft-shadow divide-y divide-border/40"
      >
        {hasHeader && (
          <div className="p-4 bg-muted/40 flex items-center gap-4 border-b border-border/60">
            {hasCheckbox && <Skeleton className="size-4 rounded-md shrink-0" shimmer={shimmer} />}
            <Skeleton className="h-4 w-28 rounded-md shrink-0" shimmer={shimmer} />
            {Array.from({ length: Math.max(1, cols - 1) }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 flex-1 rounded-md" shimmer={shimmer} />
            ))}
            {hasActions && <Skeleton className="h-4 w-16 rounded-md shrink-0" shimmer={shimmer} />}
          </div>
        )}
        <div className="divide-y divide-border/30">
          {Array.from({ length: rows }).map((_, r) => (
            <SkeletonRow
              key={r}
              cols={cols}
              hasCheckbox={hasCheckbox}
              hasActions={hasActions}
              shimmer={shimmer}
            />
          ))}
        </div>
      </div>

      {/* Mobile Card Skeleton */}
      <div aria-hidden="true" className="md:hidden space-y-3">
        {Array.from({ length: Math.min(rows, 4) }).map((_, r) => (
          <div
            key={r}
            className="p-3.5 sm:p-4 rounded-2xl border border-border bg-card soft-shadow space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-36 rounded-md" shimmer={shimmer} />
              <Skeleton className="h-5 w-16 rounded-md" shimmer={shimmer} />
            </div>
            <div className="space-y-1.5 py-1">
              <Skeleton className="h-3.5 w-full rounded-md opacity-80" shimmer={shimmer} />
              <Skeleton className="h-3.5 w-2/3 rounded-md opacity-70" shimmer={shimmer} />
            </div>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-20 rounded-md" shimmer={shimmer} />
              <Skeleton className="h-7 w-20 rounded-lg" shimmer={shimmer} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Canonical Aliases
export const SADATableSkeleton = SkeletonTable;
export const SadaTableSkeleton = SkeletonTable;

// ============================================================================
// SKELETON CHART
// ============================================================================

export interface SkeletonChartProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "bar" | "area" | "line" | "donut";
  height?: number | string;
  hasLegend?: boolean;
  hasTitle?: boolean;
  shimmer?: boolean;
}

export function SkeletonChart({
  type = "bar",
  height = 280,
  hasLegend = true,
  hasTitle = true,
  shimmer = true,
  className,
  ...props
}: SkeletonChartProps) {
  const chartHeight = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        "p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border bg-card soft-shadow space-y-4 sm:space-y-5 relative overflow-hidden",
        className
      )}
      {...props}
    >
      <span className="sr-only">Loading analytics visualization...</span>
      <div aria-hidden="true" className="space-y-4 sm:space-y-5">
        {/* Chart Top Bar */}
        {hasTitle && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-36 rounded-md" shimmer={shimmer} />
              <Skeleton className="h-3 w-48 max-w-full rounded-md opacity-80" shimmer={shimmer} />
            </div>
            {hasLegend && (
              <div className="flex items-center gap-2 sm:gap-3">
                <Skeleton className="h-3 w-14 sm:w-16 rounded-md" shimmer={shimmer} />
                <Skeleton className="h-3 w-14 sm:w-16 rounded-md" shimmer={shimmer} />
              </div>
            )}
          </div>
        )}

        {/* Chart Visual Simulation */}
        {type === "donut" ? (
          <div className="flex items-center justify-center py-4 sm:py-6" style={{ height: chartHeight }}>
            <div className="relative size-36 sm:size-44 rounded-full border-10 sm:border-12 border-muted/70 flex items-center justify-center">
              <Skeleton className="size-16 sm:size-20 rounded-full" shimmer={shimmer} />
            </div>
          </div>
        ) : (
          <div
            className="w-full flex items-end justify-between gap-2 sm:gap-2.5 pt-4 sm:pt-6 pb-2 border-b border-border/40"
            style={{ height: chartHeight }}
          >
            {Array.from({ length: 8 }).map((_, i) => {
              const barHeights = ["h-[45%]", "h-[70%]", "h-[55%]", "h-[85%]", "h-[40%]", "h-[90%]", "h-[65%]", "h-[75%]"];
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1.5 sm:gap-2 h-full justify-end",
                    i >= 5 ? "hidden xs:flex" : "flex"
                  )}
                >
                  <Skeleton
                    className={cn("w-full max-w-[42px] rounded-t-xl", barHeights[i % barHeights.length])}
                    shimmer={shimmer}
                  />
                  <Skeleton className="h-2.5 w-6 sm:w-8 rounded-sm opacity-60" shimmer={shimmer} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LIST
// ============================================================================

export interface SkeletonListProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: number;
  hasAvatar?: boolean;
  hasAction?: boolean;
  shimmer?: boolean;
}

export function SkeletonList({
  items = 4,
  hasAvatar = true,
  hasAction = true,
  shimmer = true,
  className,
  ...props
}: SkeletonListProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn("space-y-3", className)}
      {...props}
    >
      <span className="sr-only">Loading list items...</span>
      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-border bg-card soft-shadow flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {hasAvatar && <SkeletonAvatar size="sm" shimmer={shimmer} />}
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-1/3 rounded-md" shimmer={shimmer} />
                <Skeleton className="h-3 w-1/2 rounded-md opacity-80" shimmer={shimmer} />
              </div>
            </div>
            {hasAction && <SkeletonButton size="sm" shimmer={shimmer} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Canonical Aliases
export const SADAListSkeleton = SkeletonList;
export const SadaListSkeleton = SkeletonList;

// ============================================================================
// SKELETON PAGE HEADER
// ============================================================================

export interface SkeletonPageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  hasBadge?: boolean;
  hasSubtitle?: boolean;
  actionCount?: number;
  hasTabs?: boolean;
  shimmer?: boolean;
}

export function SkeletonPageHeader({
  hasBadge = true,
  hasSubtitle = true,
  actionCount = 2,
  hasTabs = false,
  shimmer = true,
  className,
  ...props
}: SkeletonPageHeaderProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-4 pb-6 border-b border-border/60", className)}
      {...props}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Eyebrow + Title + Subtitle */}
        <div className="space-y-2">
          {hasBadge && (
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28 rounded-md" shimmer={shimmer} />
            </div>
          )}
          <Skeleton className="h-8 sm:h-9 w-56 sm:w-72 rounded-xl" shimmer={shimmer} />
          {hasSubtitle && <Skeleton className="h-3.5 w-64 sm:w-96 rounded-md opacity-80" shimmer={shimmer} />}
        </div>

        {/* Right: Actions */}
        {actionCount > 0 && (
          <div className="flex items-center gap-2.5 flex-wrap">
            {Array.from({ length: actionCount }).map((_, i) => (
              <SkeletonButton key={i} size={i === 0 ? "md" : "sm"} shimmer={shimmer} />
            ))}
          </div>
        )}
      </div>

      {/* Optional Tabs Bar */}
      {hasTabs && (
        <div className="flex items-center gap-2 pt-2 overflow-x-auto scrollbar-none">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-xl" shimmer={shimmer} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SMOOTH CONTENT TRANSITION WRAPPER
// ============================================================================

export interface SADAContentTransitionProps {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  role?: string;
  "aria-live"?: "polite" | "assertive" | "off";
}

/**
 * Accessible, smooth transition wrapper between skeleton preview and real UI
 */
export function SADAContentTransition({
  loading,
  skeleton,
  children,
  className,
  role = "status",
  "aria-live": ariaLive = "polite",
}: SADAContentTransitionProps) {
  if (loading) {
    return (
      <div
        role={role}
        aria-live={ariaLive}
        aria-busy="true"
        className={cn("w-full transition-opacity duration-200", className)}
      >
        <span className="sr-only">Loading content, please wait...</span>
        {skeleton}
      </div>
    );
  }

  return (
    <div
      aria-busy="false"
      className={cn("w-full animate-in fade-in duration-200", className)}
    >
      {children}
    </div>
  );
}
