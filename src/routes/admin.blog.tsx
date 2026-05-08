import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/blog")({
  component: () => (
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
  )
});
