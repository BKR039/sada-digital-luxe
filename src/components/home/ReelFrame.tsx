import { memo } from "react";
import { Play, Instagram, Sparkles } from "lucide-react";
import { SmartMedia } from "@/components/media/SmartMedia";
import type { Tables } from "@/integrations/supabase/types";
import { useTranslation } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";

type SocialReel = Tables<"social_reels">;

interface ReelFrameProps {
  reel: SocialReel;
  isActive?: boolean;
  onClick: (reel: SocialReel) => void;
  priority?: boolean;
}

export const ReelFrame = memo(function ReelFrame({
  reel,
  isActive = false,
  onClick,
  priority = false,
}: ReelFrameProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";
  const localizedTitle = getLocalizedContent(reel, "title", language);
  const localizedCaption = getLocalizedContent(reel, "caption", language);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Watch Reel: ${localizedTitle}`}
      onClick={() => onClick(reel)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(reel);
        }
      }}
      className={`group relative cursor-pointer select-none text-left rtl:text-right rounded-[26px] sm:rounded-[30px] p-2.5 sm:p-3.5 transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 w-full ${
        isActive
          ? "bg-[#0B1120] border border-cyan-400/50 shadow-[0_14px_45px_rgba(24,199,247,0.22)] ring-1 ring-cyan-400/25 z-20"
          : "bg-[#0F172A]/90 dark:bg-[#0B1120]/90 border border-white/10 shadow-[0_10px_35px_rgba(27,109,255,0.1)] hover:border-cyan-400/35 hover:shadow-[0_14px_45px_rgba(27,109,255,0.2)] hover:scale-[1.025] hover:-translate-y-1 z-10"
      }`}
    >
      {/* Ambient SADA Blue/Cyan Glow under active/hovered frame */}
      <div
        className={`absolute -inset-1 rounded-[32px] bg-gradient-to-br from-cyan-500/20 via-blue-600/10 to-transparent blur-xl pointer-events-none transition-opacity duration-300 ${
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"
        }`}
        aria-hidden="true"
      />

      {/* Inner Reel 9:16 Canvas */}
      <div className="relative aspect-[9/16] w-full rounded-[18px] sm:rounded-[22px] overflow-hidden bg-black/80">
        {/* Reel Thumbnail Image */}
        <SmartMedia
          src={reel.thumbnail_url}
          alt={reel.title}
          fit="cover"
          className="w-full h-full object-center transition-transform duration-500 ease-out group-hover:scale-105"
          loading={priority ? "eager" : "lazy"}
          autoplay={false}
        />

        {/* Ambient Gradient Scrim */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40 pointer-events-none"
          aria-hidden="true"
        />

        {/* Top Badges */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-10">
          {reel.category ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-black/65 backdrop-blur-md text-cyan-300 border border-white/15 shadow-sm">
              {reel.is_featured && <Sparkles className="size-2.5 text-cyan-400" />}
              {reel.category}
            </span>
          ) : (
            <div />
          )}

          <div className="size-7 rounded-full bg-black/65 backdrop-blur-md border border-white/15 grid place-items-center text-white/90 shadow-sm">
            <Instagram className="size-3.5 text-cyan-400" />
          </div>
        </div>

        {/* Center Hover Action Pill */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-semibold border border-white/30 shadow-xl">
            <div className="size-5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 grid place-items-center text-white shadow-sm">
              <Play className="size-2.5 fill-white ml-0.5 rtl:mr-0.5 rtl:ml-0" />
            </div>
            <span>{isAr ? "مشاهدة الريل" : "Watch Reel"}</span>
          </div>
        </div>

        {/* Bottom Content / Title */}
        <div className="absolute bottom-3 inset-x-3 pointer-events-none z-10">
          <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 drop-shadow-md">
            {localizedTitle}
          </h3>
          {localizedCaption && (
            <p className="mt-1 text-[11px] text-slate-300 line-clamp-1 opacity-85">
              {localizedCaption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
