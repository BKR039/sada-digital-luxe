import { useEffect, useRef, useState } from "react";

export function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

interface SmartMediaProps {
  src?: string | null;
  alt?: string;
  className?: string;
  /** object-fit behaviour: cover (default) crops, contain shows full asset */
  fit?: "cover" | "contain";
  /** muted autoplay loop for video previews */
  autoplay?: boolean;
  /** show controls on video */
  controls?: boolean;
  poster?: string;
  loading?: "lazy" | "eager";
}

/**
 * Universal media renderer. Detects videos vs images, lazy-loads on viewport,
 * and never stretches the source — uses object-fit + a neutral background so
 * portrait, landscape, square, and cinematic ratios all look right.
 */
export function SmartMedia({
  src,
  alt = "",
  className = "",
  fit = "cover",
  autoplay = true,
  controls = false,
  poster,
  loading = "lazy",
}: SmartMediaProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(loading === "eager");

  useEffect(() => {
    if (visible || !ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

  const fitClass = fit === "cover" ? "object-cover" : "object-contain";

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-gradient-to-br from-primary/15 to-accent/15 ${className}`}
    >
      {!src ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground/60 text-xs uppercase tracking-widest">
          No media
        </div>
      ) : isVideoUrl(src) ? (
        visible && (
          <video
            src={src}
            poster={poster}
            autoPlay={autoplay}
            muted
            loop={autoplay}
            playsInline
            controls={controls}
            preload="metadata"
            className={`w-full h-full ${fitClass}`}
          />
        )
      ) : (
        visible && (
          <img
            src={src}
            alt={alt}
            loading={loading}
            decoding="async"
            className={`w-full h-full ${fitClass}`}
          />
        )
      )}
    </div>
  );
}
