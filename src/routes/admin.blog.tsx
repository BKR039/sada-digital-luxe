import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/blog")({
  component: BlogAdmin,
});

function BlogVisibilityToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any)
      .from("site_settings")
      .select("enabled")
      .eq("key", "blog")
      .maybeSingle()
      .then(({ data }: { data: { enabled: boolean } | null }) => {
        setEnabled(!!data?.enabled);
        setLoading(false);
      });
  }, []);

  const toggle = async () => {
    const next = !enabled;
    const { error } = await (supabase as any).from("site_settings").update({ enabled: next }).eq("key", "blog");
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnabled(next);
    toast.success(next ? "Blog is now visible on the site" : "Blog is now hidden from the site");
  };

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4 soft-shadow">
      <div>
        <div className="font-semibold">Blog visibility</div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {loading
            ? "Checking status…"
            : enabled
              ? "The blog is live and linked from navigation and the footer."
              : "The blog is hidden from navigation, the footer, and direct links. Turn this on to relaunch it."}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle blog visibility"
        className={`relative w-14 h-8 rounded-full transition-colors duration-200 shrink-0 ${enabled ? "bg-gradient-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? "translate-x-6" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

function BlogAdmin() {
  return (
    <div>
      <BlogVisibilityToggle />
      <CrudPage table="blog_posts" title="Blog posts"
        orderBy="published_at" ascending={false}
        searchKeys={["title"]}
        display={(r) => ({ title: r.title, subtitle: r.excerpt, meta: r.published ? "Published" : "Draft", image: r.cover_url })}
        fields={[
          { name: "title", label: "Title", required: true },
          { name: "slug", label: "Slug" },
          { name: "cover_url", label: "Cover image", type: "media", folder: "blog" },
          { name: "excerpt", label: "Excerpt", type: "textarea" },
          { name: "content", label: "Content", type: "textarea" },
          { name: "published_at", label: "Publish date", type: "date" },
          { name: "published", label: "Published", type: "boolean" },
        ]} />
    </div>
  );
}
