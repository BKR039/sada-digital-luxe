import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/projects")({
  component: () => (
    <CrudPage table="projects" title="Projects"
      orderBy="sort_order" ascending={true}
      searchKeys={["title", "client", "category"]}
      display={(r) => ({ title: r.title, subtitle: r.client || r.category, meta: r.published ? "Published" : "Draft", image: r.thumbnail_url || r.cover_url })}
      fields={[
        { name: "title", label: "Project title", required: true, placeholder: "e.g. Nova Coffee — Brand Identity" },
        { name: "slug", label: "Slug", help: "Auto-generated from title if left empty" },
        { name: "client", label: "Client name", placeholder: "Nova Coffee Co." },
        { name: "category", label: "Category", placeholder: "Branding · Web · Content" },
        { name: "thumbnail_url", label: "Thumbnail (grid cover)", type: "media", folder: "projects", placeholder: "Optimized cover for cards" },
        { name: "cover_url", label: "Hero cover (detail page)", type: "media", folder: "projects" },
        { name: "gallery", label: "Project media gallery", type: "media-list", folder: "projects", help: "Add images and videos. They appear inside the project detail page." },
        { name: "description", label: "Description", type: "textarea" },
        { name: "results", label: "Results", type: "textarea", placeholder: "+340% engagement, 2.3M impressions…" },
        { name: "services", label: "Services used", type: "tags", placeholder: "Branding, Content, Paid Ads" },
        { name: "tags", label: "Tags", type: "tags" },
        { name: "external_url", label: "External link", type: "url", placeholder: "https://client.com" },
        { name: "project_date", label: "Project date", type: "date" },
        { name: "sort_order", label: "Sort order", type: "number" },
        { name: "featured", label: "Featured on homepage", type: "boolean" },
        { name: "published", label: "Published", type: "boolean" },
      ]} />
  )
});
