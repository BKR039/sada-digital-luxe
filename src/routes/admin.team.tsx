import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/team")({
  component: () => (
    <CrudPage table="team_members" title="Team members"
      orderBy="sort_order" ascending={true}
      searchKeys={["name", "position"]}
      display={(r) => ({ title: r.name, subtitle: r.position, meta: r.featured ? "Featured" : undefined, image: r.photo_url })}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "position", label: "Position", required: true, placeholder: "Creative Director" },
        { name: "photo_url", label: "Profile photo", type: "media", folder: "team" },
        { name: "bio", label: "Bio", type: "textarea" },
        { name: "socials", label: "Social links (JSON)", type: "json", placeholder: '{ "instagram": "https://...", "linkedin": "https://...", "twitter": "https://...", "website": "https://..." }' },
        { name: "sort_order", label: "Sort order", type: "number" },
        { name: "featured", label: "Featured", type: "boolean" },
        { name: "published", label: "Published", type: "boolean" },
      ]} />
  )
});
