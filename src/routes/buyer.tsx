import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace/BusinessWorkspace";

export const Route = createFileRoute("/buyer")({
  head: () => ({
    meta: [
      { title: "Buyer Workspace | FEA Bulk" },
      { name: "description", content: "Your FEA Bulk buyer screen: quotes, orders, messages and team." },
      { property: "og:title", content: "Buyer Workspace | FEA Bulk" },
      { property: "og:description", content: "Your FEA Bulk buyer screen: quotes, orders, messages and team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuyerPage,
});

function BuyerPage() {
  return <Workspace expected="buyer" />;
}
