import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { SmartMedia, isVideoUrl } from "./SmartMedia";

interface Props {
  items: string[];
}

export function MediaGallery({ items }: Props) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight") setActive((a) => (a === null ? a : (a + 1) % items.length));
      if (e.key === "ArrowLeft") setActive((a) => (a === null ? a : (a - 1 + items.length) % items.length));
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [active, items.length]);

  if (!items.length) return null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 [grid-auto-flow:dense]">
        {items.map((src, i) => {
          // Make a visually-rich masonry: every 5th item spans 2 columns
          const wide = i % 5 === 0 && items.length > 3;
          return (
            <button
              key={src + i}
              onClick={() => setActive(i)}
              className={`group relative rounded-2xl overflow-hidden glass hover:cyan-glow transition-all ${wide ? "md:col-span-2 aspect-video" : "aspect-square"}`}
            >
              <SmartMedia src={src} className="w-full h-full transition-transform duration-700 group-hover:scale-105" autoplay={false} />
              {isVideoUrl(src) && (
                <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/70 backdrop-blur text-white px-2 py-1 rounded-md">▶ VIDEO</span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {active !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl grid place-items-center p-4"
            onClick={() => setActive(null)}
          >
            <button onClick={() => setActive(null)} className="absolute top-4 right-4 size-10 grid place-items-center rounded-full glass-strong text-white hover:bg-destructive z-10">
              <X />
            </button>
            {items.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setActive((a) => (a! - 1 + items.length) % items.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 size-12 grid place-items-center rounded-full glass-strong text-white hover:cyan-glow"><ChevronLeft /></button>
                <button onClick={(e) => { e.stopPropagation(); setActive((a) => (a! + 1) % items.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 size-12 grid place-items-center rounded-full glass-strong text-white hover:cyan-glow"><ChevronRight /></button>
              </>
            )}
            <motion.div
              key={active}
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="relative max-w-6xl w-full max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {isVideoUrl(items[active]) ? (
                <video src={items[active]} autoPlay controls playsInline className="max-w-full max-h-[90vh] rounded-2xl" />
              ) : (
                <img src={items[active]} alt="" className="max-w-full max-h-[90vh] rounded-2xl object-contain" />
              )}
            </motion.div>
            <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-white/60">
              {active + 1} / {items.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
