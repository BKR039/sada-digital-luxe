import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/products")({
  component: () => (
    <CrudPage table="products" title="Digital products"
      orderBy="sort_order" ascending={true}
      searchKeys={["title", "category"]}
      display={(r) => ({ title: r.title, subtitle: r.category, meta: r.price ? `${r.currency || "USD"} ${r.price}` : "Free", image: r.thumbnail_url })}
      fields={[
        { name: "title", label: "Product title", required: true },
        { name: "thumbnail_url", label: "Product thumbnail", type: "media", folder: "products" },
        { name: "description", label: "Short description", type: "textarea" },
        { name: "price", label: "Price", type: "number", placeholder: "29" },
        { name: "currency", label: "Currency", placeholder: "USD" },
        { name: "category", label: "Category", placeholder: "Brand kit · Templates · Presets" },
        { name: "gumroad_url", label: "Gumroad product link", type: "url", required: true, placeholder: "https://gumroad.com/l/..." },
        { name: "sort_order", label: "Sort order", type: "number" },
        { name: "published", label: "Published", type: "boolean" },
      ]} />
  )
});
