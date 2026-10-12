import { createFileRoute, redirect } from "@tanstack/react-router";

// Old admin address — kept so existing links still work.
export const Route = createFileRoute("/operations")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
});
