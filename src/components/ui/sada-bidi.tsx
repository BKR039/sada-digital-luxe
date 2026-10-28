import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * LTRText — Enforces strict left-to-right rendering with unicode isolation
 * Essential for IDs (INV-2026-001), phone numbers (+216 ...), emails, URLs, SKU codes.
 */
export function LTRText({
  children,
  className,
  as: Component = "span",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  if (children === null || children === undefined) return null;
  return (
    <Component
      dir="ltr"
      className={cn("inline-block [unicode-bidi:isolate] text-left", className)}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * AutoText — Direction-aware wrapper (dir="auto")
 * Automatically renders Arabic text as RTL and Latin text as LTR.
 * Essential for user-generated content: task titles, project notes, client comments.
 */
export function AutoText({
  children,
  className,
  as: Component = "span",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  if (children === null || children === undefined) return null;
  return (
    <Component
      dir="auto"
      className={cn("inline-block [unicode-bidi:plaintext]", className)}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * Wrap a string with LTR directional marks (\u200E) to prevent punctuation hopping
 */
export function isolateLTR(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return "";
  return `\u200E${text}\u200E`;
}

/**
 * Format phone numbers safely for mixed LTR/RTL viewing
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "—";
  return `\u200E${phone.trim()}\u200E`;
}

/**
 * Format technical identifiers (INV-..., TASK-..., CLI-...) safely
 */
export function formatIdentifier(id: string | null | undefined): string {
  if (!id) return "—";
  return `\u200E${id.trim()}\u200E`;
}
