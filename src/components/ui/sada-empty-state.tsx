import * as React from "react";
import { type LucideIcon, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SADAButton } from "./sada-button";

export interface SADAEmptyStateProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    icon?: React.ReactNode;
    variant?: "primary" | "secondary" | "outline";
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  };
  compact?: boolean;
  className?: string;
}

export function SADAEmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
}: SADAEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-2xl sm:rounded-3xl border border-dashed border-border/80 bg-card/40 backdrop-blur-xs",
        compact ? "p-4 sm:p-6 space-y-2.5" : "p-5 sm:p-10 space-y-3 sm:space-y-4 my-1 sm:my-2",
        className
      )}
    >
      <div
        className={cn(
          "rounded-2xl bg-primary/10 text-primary border border-primary/20 grid place-items-center shadow-xs",
          compact ? "size-10" : "size-12"
        )}
      >
        <Icon className={compact ? "size-5" : "size-6"} />
      </div>

      <div className="space-y-1 max-w-sm">
        <h4 className="font-display font-bold text-foreground text-sm sm:text-base">
          {title}
        </h4>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action && (
            <SADAButton
              size={compact ? "xs" : "sm"}
              variant={action.variant || "primary"}
              onClick={action.onClick}
              leftIcon={action.icon}
            >
              {action.label}
            </SADAButton>
          )}

          {secondaryAction && (
            <SADAButton
              size={compact ? "xs" : "sm"}
              variant="outline"
              onClick={secondaryAction.onClick}
              leftIcon={secondaryAction.icon}
            >
              {secondaryAction.label}
            </SADAButton>
          )}
        </div>
      )}
    </div>
  );
}
