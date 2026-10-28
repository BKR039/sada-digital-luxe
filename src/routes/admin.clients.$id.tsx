import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/clients/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/client-workspaces/$id",
      params: { id: params.id },
      replace: true,
    });
  },
});
