import * as React from "react";
import { Search, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SADAButton } from "./sada-button";

export interface SADAFilterBarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  rightActions?: React.ReactNode;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  className?: string;
}

export function SADAFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search records...",
  children,
  rightActions,
  hasActiveFilters = false,
  onResetFilters,
  className,
}: SADAFilterBarProps) {
  return (
    <div
      className={cn(
        "p-3.5 sm:p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-3",
        className
      )}
    >
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Left: Search input & filter controls */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {onSearchChange !== undefined && (
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="size-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-background border border-border rounded-xl ps-9 pe-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          {/* Additional Filter Dropdowns / Selects passed as children */}
          {children}

          {/* Reset button if filters active */}
          {hasActiveFilters && onResetFilters && (
            <SADAButton
              variant="ghost"
              size="xs"
              onClick={onResetFilters}
              leftIcon={<RotateCcw className="size-3" />}
              className="text-muted-foreground hover:text-foreground"
            >
              Reset
            </SADAButton>
          )}
        </div>

        {/* Right: Actions / View Switcher / New Record button */}
        {rightActions && (
          <div className="flex items-center gap-2 shrink-0 justify-end">
            {rightActions}
          </div>
        )}
      </div>
    </div>
  );
}
