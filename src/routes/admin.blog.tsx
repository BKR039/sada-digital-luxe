import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/blog")({
  component: () => (
    <CrudPage table="blog_posts" title="Blog posts"
      display={(r) => ({ title: r.title, subtitle: r.excerpt, meta: r.published ? "Published" : "Draft" })}
      fields={[
        { name: "title", label: "Title", required: true },
        { name: "slug", label: "Slug" },
        { name: "excerpt", label: "Excerpt", type: "textarea" },
        { name: "content", label: "Content", type: "textarea" },
        { name: "cover_url", label: "Cover URL", type: "url" },
        { name: "published", label: "Published", type: "boolean" },
      ]} />
  )
});
