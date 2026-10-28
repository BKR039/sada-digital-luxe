import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/client-projects/$id")({
  beforeLoad: async ({ params }) => {
    const rawId = params.id;
    let targetClientId = rawId;

    try {
      const { data: project } = await (supabase as any)
        .from("client_projects")
        .select("client_id")
        .eq("id", rawId)
        .maybeSingle();

      if (project?.client_id) {
        targetClientId = project.client_id;
      }
    } catch {
      // Ignore lookup error, fallback to rawId
    }

    throw redirect({
      to: "/admin/client-workspaces/$id",
      params: { id: targetClientId },
      replace: true,
    });
  },
});
