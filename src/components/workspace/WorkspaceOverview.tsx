import { ArrowRight, Package, Plus, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Order, Product, ProductImage, Quote, Rfq } from "@/lib/marketplace";
import type { WorkspaceView } from "./WorkspaceLayout";

export function WorkspaceOverview({ buyer, products, productImages, orders, suppliers, setView, openProduct, canCreate }: {
  buyer: boolean; rfqs: Rfq[]; opportunities: Rfq[]; quotes: Quote[]; products: Product[];
  productImages: Map<string, ProductImage[]>; orders: Order[]; suppliers: Array<{ id: string }>;
  setView: (view: WorkspaceView) => void; openRfq: () => void; openProduct: () => void; canCreate: boolean;
}) {
  const activeOrders = orders.filter(item => !["completed", "cancelled", "returned"].includes(item.status));
  const awaitingPayment = orders.filter(item => item.status === "awaiting_payment").length;
  const lowStock = products.filter(item => item.available_quantity <= item.minimum_order_quantity);
  const stats: Array<{ label: string; value: number; view: WorkspaceView; warning?: boolean }> = buyer ? [
    { label: "Active orders", value: activeOrders.length, view: "orders" },
    { label: "Awaiting payment", value: awaitingPayment, view: "orders", warning: awaitingPayment > 0 },
    { label: "Verified suppliers", value: suppliers.length, view: "suppliers" },
  ] : [
    { label: "Active orders", value: activeOrders.length, view: "orders" },
    { label: "Awaiting your confirmation", value: orders.filter(item => item.status === "awaiting_seller_confirmation").length, view: "orders", warning: orders.some(item => item.status === "awaiting_seller_confirmation") },
    { label: "Catalog products", value: products.length, view: "catalog" },
    { label: "Low stock", value: lowStock.length, view: "catalog", warning: lowStock.length > 0 },
  ];
  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4 pb-7">
      <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{buyer ? "Purchasing activity" : "Sales activity"}</p><h2 className="mt-2 text-3xl font-bold text-workspace-brand">{buyer ? "Your purchasing overview" : "Your sales overview"}</h2></div>
      {buyer ? <Button asChild variant="workspace"><a href="/marketplace"><Store />Shop products</a></Button> : canCreate && <Button variant="workspace" onClick={openProduct}><Plus />Add product</Button>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(stat => <Button key={stat.label} variant="outline" onClick={() => setView(stat.view)} className={`h-auto min-h-28 flex-col items-start justify-between gap-3 whitespace-normal p-5 text-left shadow-none ${stat.warning ? "border-workspace-warning/30 bg-workspace-warning-soft" : "bg-card"}`}><span className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">{stat.label}<ArrowRight className="size-3.5 shrink-0" /></span><span className="text-3xl font-bold text-workspace-brand">{stat.value}</span></Button>)}
    </div>
    <div className="mt-8 grid gap-8 ">
      <div>
        <div className="flex items-center justify-between gap-3 border-b pb-3"><h3 className="flex items-center gap-2 text-base font-bold"><Truck className="size-4 text-muted-foreground" />{buyer ? "Recent purchases" : "Recent orders"}</h3><Button variant="ghost" size="sm" onClick={() => setView("orders")}>View all<ArrowRight /></Button></div>
        {orders.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center gap-3 border-b py-8 text-center"><Truck className="size-7 text-muted-foreground" /><p className="text-sm text-muted-foreground">{buyer ? "No purchases yet" : "No orders yet"}</p>{buyer ? <Button asChild variant="outline" size="sm"><a href="/marketplace">Shop products<ArrowRight /></a></Button> : <Button variant="outline" size="sm" onClick={() => setView("catalog")}>Manage products<ArrowRight /></Button>}</div> : orders.slice(0, 5).map(order => <Button key={order.id} variant="ghost" onClick={() => setView("orders")} className="h-auto w-full justify-between gap-4 whitespace-normal rounded-none border-b px-0 py-4 text-left"><span className="min-w-0"><span className="block font-bold text-workspace-brand">{order.order_number}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{order.order_lines[0]?.description ?? "Wholesale order"}</span></span><span className="shrink-0 text-right"><span className="block font-bold">₹{Number(order.grand_total).toLocaleString("en-IN")}</span><span className="mt-1 block text-xs font-normal capitalize text-muted-foreground">{order.status.replaceAll("_", " ")}</span></span></Button>)}
      </div>
    </div>
    {!buyer && products.length > 0 && <section className="mt-8"><div className="flex items-center justify-between border-b pb-3"><h3 className="flex items-center gap-2 font-bold"><Package className="size-4 text-muted-foreground" />Product snapshot</h3><Button variant="ghost" size="sm" onClick={() => setView("catalog")}>Manage products<ArrowRight /></Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{products.slice(0, 4).map(product => { const image = productImages.get(product.id)?.[0]; return <Button key={product.id} variant="outline" className="h-auto flex-col items-start gap-3 whitespace-normal bg-card p-3 text-left shadow-none" onClick={() => setView("catalog")}>{image ? <img src={image.url} alt={image.alt_text ?? product.name} className="aspect-[4/3] w-full rounded object-contain" /> : <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted"><Package className="size-8 text-muted-foreground" /></div>}<span className="font-semibold">{product.name}</span><span className={`text-xs font-normal ${product.available_quantity <= product.minimum_order_quantity ? "text-workspace-warning" : "text-muted-foreground"}`}>{product.available_quantity} in stock · {product.listing_status}</span></Button>; })}</div></section>}
    {buyer && <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y py-5"><h3 className="flex items-center gap-2 font-semibold text-workspace-brand"><Store className="size-5" />Verified supplier network</h3><Button asChild variant="outline"><a href="/marketplace">Browse marketplace<ArrowRight /></a></Button></div>}
  </section>;
}