import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/testimonials")({
  component: () => (
    <CrudPage table="testimonials" title="Testimonials"
      orderBy="sort_order" ascending={true}
      display={(r) => ({ title: r.client_name, subtitle: r.review, meta: `${r.rating}★` })}
      fields={[
        { name: "client_name", label: "Client name", required: true },
        { name: "company", label: "Company" },
        { name: "review", label: "Review", type: "textarea", required: true },
        { name: "rating", label: "Rating (1-5)", type: "number" },
        { name: "photo_url", label: "Photo URL", type: "url" },
        { name: "sort_order", label: "Sort order", type: "number" },
        { name: "published", label: "Published", type: "boolean" },
      ]} />
  )
});
