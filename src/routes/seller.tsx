import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace/BusinessWorkspace";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Seller Workspace | FEA Bulk" },
      { name: "description", content: "Your FEA Bulk seller screen: quotes, orders, messages and team." },
      { property: "og:title", content: "Seller Workspace | FEA Bulk" },
      { property: "og:description", content: "Your FEA Bulk seller screen: quotes, orders, messages and team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SellerPage,
});

function SellerPage() {
  return <Workspace expected="seller" />;
}
