import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/products")({
  component: () => (
    <CrudPage table="products" title="Products"
      orderBy="sort_order" ascending={true}
      display={(r) => ({ title: r.title, subtitle: r.category, meta: r.price ? `${r.currency} ${r.price}` : "Free" })}
      fields={[
        { name: "title", label: "Title", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "price", label: "Price", type: "number" },
        { name: "currency", label: "Currency" },
        { name: "category", label: "Category" },
        { name: "thumbnail_url", label: "Thumbnail URL", type: "url" },
        { name: "gumroad_url", label: "Gumroad URL", type: "url" },
        { name: "sort_order", label: "Sort order", type: "number" },
        { name: "published", label: "Published", type: "boolean" },
      ]} />
  )
});
