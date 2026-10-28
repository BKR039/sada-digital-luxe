import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portfolio")({
  beforeLoad: () => {
    throw redirect({ to: "/case-studies", replace: true });
  },
  component: () => null,
});
