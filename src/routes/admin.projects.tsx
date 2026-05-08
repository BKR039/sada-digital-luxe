import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/projects")({
  component: () => (
    <CrudPage table="projects" title="Projects"
      orderBy="sort_order" ascending={true}
      display={(r) => ({ title: r.title, subtitle: r.client || r.category, meta: r.published ? "Published" : "Draft" })}
      fields={[
        { name: "title", label: "Title", required: true },
        { name: "slug", label: "Slug" },
        { name: "client", label: "Client" },
        { name: "category", label: "Category" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "results", label: "Results", type: "textarea" },
        { name: "cover_url", label: "Cover URL", type: "url" },
        { name: "services", label: "Services", type: "tags" },
        { name: "tags", label: "Tags", type: "tags" },
        { name: "project_date", label: "Project date", type: "date" },
        { name: "sort_order", label: "Sort order", type: "number" },
        { name: "featured", label: "Featured", type: "boolean" },
        { name: "published", label: "Published", type: "boolean" },
      ]} />
  )
});
