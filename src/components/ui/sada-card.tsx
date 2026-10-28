import * as React from "react";
import { cn } from "@/lib/utils";

export interface SADACardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  glow?: boolean;
}

export function SADACard({
  className,
  hoverable = false,
  glow = false,
  ...props
}: SADACardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl sm:rounded-3xl border border-border bg-card text-card-foreground shadow-2xs elevated-shadow",
        "transition-all duration-200",
        hoverable && "hover:border-primary/40 hover:shadow-md hover:scale-[1.005]",
        glow && "neon-glow border-primary/40",
        className
      )}
      {...props}
    />
  );
}

export function SADACardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1 p-3.5 sm:p-6 border-b border-border/60", className)}
      {...props}
    />
  );
}

export function SADACardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-sm sm:text-lg font-bold tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function SADACardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-[11px] sm:text-xs text-muted-foreground leading-relaxed", className)}
      {...props}
    />
  );
}

export function SADACardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-3.5 sm:p-6", className)} {...props} />;
}

export function SADACardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between p-3.5 sm:p-6 pt-0 border-t border-border/40 mt-2 sm:mt-4", className)}
      {...props}
    />
  );
}
