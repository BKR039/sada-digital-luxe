import React from "react";
import * as LucideIcons from "lucide-react";
import { Sparkles } from "lucide-react";

export const AVAILABLE_CMS_ICONS = [
  "Users",
  "Briefcase",
  "TrendingUp",
  "Rocket",
  "Eye",
  "HeartHandshake",
  "Clock",
  "Award",
  "Sparkles",
  "Star",
  "Zap",
  "Shield",
  "Target",
  "Flame",
  "Activity",
  "Globe",
  "CheckCircle2",
  "Smile",
  "ThumbsUp",
  "BarChart3",
  "Trophy",
  "Workflow",
] as const;

export type CmsIconName = (typeof AVAILABLE_CMS_ICONS)[number];

interface DynamicIconProps extends Omit<React.SVGProps<SVGSVGElement>, "name"> {
  name?: string | null;
  className?: string;
  size?: number | string;
}

export function DynamicIcon({ name, className = "size-4", size, ...props }: DynamicIconProps) {
  if (!name) return <Sparkles className={className} {...(size ? { size } : {})} {...props} />;

  // Lookup in Lucide icons
  const Component = (LucideIcons as Record<string, any>)[name];
  if (!Component) {
    return <Sparkles className={className} {...(size ? { size } : {})} {...props} />;
  }

  return <Component className={className} {...(size ? { size } : {})} {...props} />;
}
