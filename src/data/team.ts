import { Compass, Target, Film, type LucideIcon } from "lucide-react";

export interface TeamMember {
  name: string;
  role: string;
  specialty: string;
  icon: LucideIcon;
  profileType: "linkedin" | "behance";
  profileUrl: string;
}

// Real SADA team data. Replace profileUrl with each member's actual LinkedIn/Behance link when available.
export const teamMembers: TeamMember[] = [
  {
    name: "Yara El-Sayed",
    role: "Creative Director",
    specialty: "Brand & Art Direction",
    icon: Compass,
    profileType: "linkedin",
    profileUrl: "https://linkedin.com/",
  },
  {
    name: "Omar Khaled",
    role: "Brand Strategist",
    specialty: "Positioning & Growth",
    icon: Target,
    profileType: "linkedin",
    profileUrl: "https://linkedin.com/",
  },
  {
    name: "Mira Haddad",
    role: "Motion & Video Editor",
    specialty: "Cinematic Edits & Reels",
    icon: Film,
    profileType: "linkedin",
    profileUrl: "https://linkedin.com/",
  },
];
