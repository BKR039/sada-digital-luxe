import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/testimonials")({
  component: () => (
    <CrudPage table="testimonials" title="Testimonials"
      orderBy="sort_order" ascending={true}
      searchKeys={["client_name", "company"]}
      display={(r) => ({ title: r.client_name, subtitle: r.company, meta: `★ ${r.rating}`, image: r.photo_url })}
      fields={[
        { name: "client_name", label: "Client name", required: true },
        { name: "company", label: "Company" },
        { name: "photo_url", label: "Photo", type: "media", folder: "testimonials" },
        { name: "review", label: "Review", type: "textarea", required: true },
        { name: "rating", label: "Rating (1–5)", type: "number" },
        { name: "sort_order", label: "Sort order", type: "number" },
        { name: "published", label: "Published", type: "boolean" },
      ]} />
  )
});
