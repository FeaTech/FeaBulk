import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { getIdentity, getOperationsAccess, getOrganizations } from "@/lib/marketplace";

// After sign-in everyone lands here and is sent to their own screen.
export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Opening your workspace | FEA Bulk" },
      { name: "description", content: "Taking you to your FEA Bulk buyer, seller or admin screen." },
      { property: "og:title", content: "Opening your workspace | FEA Bulk" },
      { property: "og:description", content: "Taking you to your FEA Bulk buyer, seller or admin screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkspaceRedirect,
});

function WorkspaceRedirect() {
  const router = useRouter();
  useEffect(() => {
    void (async () => {
      const user = await getIdentity();
      if (!user) return router.navigate({ to: "/auth", replace: true });
      if (await getOperationsAccess(user.id)) return router.navigate({ to: "/admin", replace: true });
      const orgs = await getOrganizations();
      const to = orgs[0]?.kind === "seller" ? "/seller" : "/buyer";
      return router.navigate({ to, replace: true });
    })().catch(() => router.navigate({ to: "/buyer", replace: true }));
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center text-sm font-bold text-[#405069]">
      Opening your workspace…
    </main>
  );
}
