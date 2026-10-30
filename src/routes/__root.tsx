import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider, useTranslation } from "@/i18n";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Toaster } from "@/components/ui/sonner";
import { DirectionProvider } from "@radix-ui/react-direction";
import { initPwaInstallPromptListener } from "@/lib/pwa-service";
import { CookieConsentBanner } from "@/components/site/CookieConsentBanner";
import { PageLoadingIndicator } from "@/components/site/PageLoadingIndicator";
import { PwaLaunchScreen } from "@/components/site/PwaLaunchScreen";

function NotFoundComponent() {
  return (
    <I18nProvider>
      <NotFoundContent />
    </I18nProvider>
  );
}

function NotFoundContent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("notFound.subtitle")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("notFound.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[RootErrorComponent]", error);
  return (
    <I18nProvider>
      <ErrorContent error={error} reset={reset} />
    </I18nProvider>
  );
}

function ErrorContent({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground font-display">
          {t("error.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("error.subtitle")}
        </p>

        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-left text-xs font-mono text-destructive overflow-auto max-h-60">
            <div className="font-bold mb-1">{error.name}: {error.message}</div>
            {error.stack && (
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-tight mt-2 opacity-80">
                {error.stack}
              </pre>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.tryAgain")}
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl border border-input bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("error.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "SADA — Where Real Identity Begins" },
      { name: "description", content: "Creative digital agency. Branding, content creation, social growth, web design, and paid ads — built to be noticed." },
      { property: "og:title", content: "SADA — Where Real Identity Begins" },
      { property: "og:description", content: "Creative digital agency. Branding, content creation, social growth, web design, and paid ads — built to be noticed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SADA — Where Real Identity Begins" },
      { name: "twitter:description", content: "Creative digital agency. Branding, content creation, social growth, web design, and paid ads — built to be noticed." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/nBfSu4bCMqZYpLcFALispwceRHz1/social-images/social-1783872933528-Artboard_1.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/nBfSu4bCMqZYpLcFALispwceRHz1/social-images/social-1783872933528-Artboard_1.webp" },
      // PWA & Mobile Web App Meta Tokens
      { name: "theme-color", content: "#222830" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "SADA OS" },
      { name: "application-name", content: "SADA OS" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest?v=5" },
      { id: "sada-favicon-ico", rel: "icon", href: "/favicon.ico?v=4", sizes: "any" },
      { id: "sada-favicon-32", rel: "icon", href: "/favicon-32x32.png?v=4", type: "image/png", sizes: "32x32" },
      { id: "sada-favicon-16", rel: "icon", href: "/favicon-16x16.png?v=4", type: "image/png", sizes: "16x16" },
      { id: "sada-favicon-192", rel: "icon", href: "/icons/pwa-icon-192x192.png?v=5", type: "image/png", sizes: "192x192" },
      { id: "sada-favicon-svg", rel: "icon", href: "/favicon.svg?v=4", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icons/pwa-icon-180x180.png?v=5", sizes: "180x180" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;700&family=Manrope:wght@400;500;600&display=swap" },
      { rel: "alternate", hrefLang: "en", href: "/?lang=en" },
      { rel: "alternate", hrefLang: "ar", href: "/?lang=ar" },
      { rel: "alternate", hrefLang: "x-default", href: "/" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('sada-theme');var isDark=t==='dark'||(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(isDark){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}try{var l=localStorage.getItem('sada-lang')||(new URLSearchParams(window.location.search).get('lang'));if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';document.documentElement.setAttribute('data-lang','ar');document.documentElement.classList.add('rtl');var p=document.createElement('link');p.rel='preload';p.href='/fonts/thmanyahseriftext-Regular.otf';p.as='font';p.type='font/otf';p.crossOrigin='anonymous';document.head.appendChild(p);}else{document.documentElement.lang='en';document.documentElement.dir='ltr';document.documentElement.setAttribute('data-lang','en');document.documentElement.classList.remove('rtl');}}catch(e){}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(e){console.warn('[PWA SW]',e);});});}`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootInner() {
  const { direction, isRTL } = useTranslation();

  useEffect(() => {
    const cleanup = initPwaInstallPromptListener();
    return cleanup;
  }, []);

  return (
    <DirectionProvider dir={direction}>
      <AuthProvider>
        <PwaLaunchScreen />
        <PageLoadingIndicator />
        <SiteLayout />
        <CookieConsentBanner />
        <Toaster position={isRTL ? "top-left" : "top-right"} dir={direction} />
      </AuthProvider>
    </DirectionProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <RootInner />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
