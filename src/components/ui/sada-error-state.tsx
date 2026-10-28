import * as React from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SADAButton } from "./sada-button";

export interface SADAErrorStateProps {
  title?: string;
  message?: string;
  technicalDetails?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function SADAErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred while loading this section. Please try again.",
  technicalDetails,
  onRetry,
  className,
  compact = false,
}: SADAErrorStateProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div
      className={cn(
        "rounded-3xl border border-destructive/25 bg-destructive/5 text-destructive-foreground",
        "flex flex-col items-center justify-center text-center",
        compact ? "p-4 sm:p-6 space-y-2.5" : "p-8 sm:p-10 space-y-4 my-2",
        className
      )}
    >
      <div
        className={cn(
          "rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 grid place-items-center shrink-0",
          compact ? "size-9" : "size-12"
        )}
      >
        <AlertTriangle className={compact ? "size-4.5" : "size-6"} />
      </div>

      <div className="space-y-1 max-w-md">
        <h4 className="font-display font-bold text-foreground text-sm sm:text-base">
          {title}
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {message}
        </p>
      </div>

      {onRetry && (
        <SADAButton
          size={compact ? "xs" : "sm"}
          variant="outline"
          onClick={onRetry}
          leftIcon={<RefreshCw className="size-3" />}
          className="mt-1"
        >
          Try Again
        </SADAButton>
      )}

      {technicalDetails && (
        <div className="w-full max-w-md pt-2 text-left rtl:text-right">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{showDetails ? "Hide technical diagnostic" : "Show technical diagnostic"}</span>
            {showDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          {showDetails && (
            <pre className="mt-1.5 p-2.5 rounded-xl bg-background/80 border border-border text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {technicalDetails}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
