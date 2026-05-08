import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/admin/CrudPage";

export const Route = createFileRoute("/admin/team")({
  component: () => (
    <CrudPage table="team_members" title="Team members"
      orderBy="sort_order" ascending={true}
      display={(r) => ({ title: r.name, subtitle: r.position })}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "position", label: "Position", required: true },
        { name: "bio", label: "Bio", type: "textarea" },
        { name: "photo_url", label: "Photo URL", type: "url" },
        { name: "sort_order", label: "Sort order", type: "number" },
        { name: "published", label: "Published", type: "boolean" },
      ]} />
  )
});
