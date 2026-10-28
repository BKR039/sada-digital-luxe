import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portfolio/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/case-studies/$slug",
      params: { slug: params.slug },
      replace: true,
    });
  },
  component: () => null,
});
