import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/products/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$id", params: { id: params.id } });
  },
});
