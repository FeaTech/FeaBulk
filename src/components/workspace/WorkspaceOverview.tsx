import { ArrowRight, Clock3, FileText, Package, Plus, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Order, Product, ProductImage, Quote, Rfq } from "@/lib/marketplace";
import type { WorkspaceView } from "./WorkspaceLayout";

export function WorkspaceOverview({ buyer, rfqs, opportunities, quotes, products, productImages, orders, suppliers, setView, openRfq, openProduct, canCreate }: {
  buyer: boolean; rfqs: Rfq[]; opportunities: Rfq[]; quotes: Quote[]; products: Product[];
  productImages: Map<string, ProductImage[]>; orders: Order[]; suppliers: Array<{ id: string }>;
  setView: (view: WorkspaceView) => void; openRfq: () => void; openProduct: () => void; canCreate: boolean;
}) {
  const activeOrders = orders.filter(item => !["completed", "cancelled", "returned"].includes(item.status));
  const awaitingPayment = orders.filter(item => item.status === "awaiting_payment").length;
  const lowStock = products.filter(item => item.available_quantity <= item.minimum_order_quantity);
  const openRfqs = rfqs.filter(item => ["published", "receiving_quotes"].includes(item.status)).length;
  const stats: Array<{ label: string; value: number; view: WorkspaceView; warning?: boolean }> = buyer ? [
    { label: "Open quote requests", value: openRfqs, view: "rfqs" },
    { label: "Active orders", value: activeOrders.length, view: "orders" },
    { label: "Awaiting payment", value: awaitingPayment, view: "orders", warning: awaitingPayment > 0 },
    { label: "Verified suppliers", value: suppliers.length, view: "suppliers" },
  ] : [
    { label: "Buyer requests", value: opportunities.length, view: "opportunities" },
    { label: "Submitted quotes", value: quotes.length, view: "quotes" },
    { label: "Catalog products", value: products.length, view: "catalog" },
    { label: "Low stock", value: lowStock.length, view: "catalog", warning: lowStock.length > 0 },
  ];
  const requests = buyer ? rfqs : opportunities;
  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4 pb-7">
      <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{buyer ? "Purchasing activity" : "Sales activity"}</p><h2 className="mt-2 text-3xl font-bold text-workspace-brand">{buyer ? "Your purchasing overview" : "Your sales overview"}</h2></div>
      {canCreate && <Button variant="workspace" onClick={buyer ? openRfq : openProduct}><Plus />{buyer ? "Create quote request" : "Add product"}</Button>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(stat => <Button key={stat.label} variant="outline" onClick={() => setView(stat.view)} className={`h-auto min-h-28 flex-col items-start justify-between gap-3 whitespace-normal p-5 text-left shadow-none ${stat.warning ? "border-workspace-warning/30 bg-workspace-warning-soft" : "bg-card"}`}><span className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">{stat.label}<ArrowRight className="size-3.5 shrink-0" /></span><span className="text-3xl font-bold text-workspace-brand">{stat.value}</span></Button>)}
    </div>
    <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div>
        <div className="flex items-center justify-between gap-3 border-b pb-3"><h3 className="flex items-center gap-2 text-base font-bold"><Truck className="size-4 text-muted-foreground" />{buyer ? "Recent purchases" : "Recent orders"}</h3><Button variant="ghost" size="sm" onClick={() => setView("orders")}>View all<ArrowRight /></Button></div>
        {orders.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center gap-3 border-b py-8 text-center"><Truck className="size-7 text-muted-foreground" /><p className="text-sm text-muted-foreground">{buyer ? "No purchases yet" : "No orders yet"}</p><Button variant="outline" size="sm" onClick={() => setView(buyer ? "suppliers" : "opportunities")}>{buyer ? "Find suppliers" : "View buyer requests"}<ArrowRight /></Button></div> : orders.slice(0, 5).map(order => <Button key={order.id} variant="ghost" onClick={() => setView("orders")} className="h-auto w-full justify-between gap-4 whitespace-normal rounded-none border-b px-0 py-4 text-left"><span className="min-w-0"><span className="block font-bold text-workspace-brand">{order.order_number}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{order.order_lines[0]?.description ?? "Wholesale order"}</span></span><span className="shrink-0 text-right"><span className="block font-bold">₹{Number(order.grand_total).toLocaleString("en-IN")}</span><span className="mt-1 block text-xs font-normal capitalize text-muted-foreground">{order.status.replaceAll("_", " ")}</span></span></Button>)}
      </div>
      <div>
        <div className="flex items-center justify-between gap-3 border-b pb-3"><h3 className="flex items-center gap-2 text-base font-bold"><FileText className="size-4 text-muted-foreground" />{buyer ? "Recent quote requests" : "Latest buyer requests"}</h3><Button variant="ghost" size="sm" onClick={() => setView(buyer ? "rfqs" : "opportunities")}>View all<ArrowRight /></Button></div>
        {requests.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center gap-3 border-b py-8"><FileText className="size-7 text-muted-foreground" /><p className="text-sm text-muted-foreground">{buyer ? "No quote requests yet" : "No open buyer requests"}</p>{buyer && canCreate && <Button variant="outline" size="sm" onClick={openRfq}><Plus />Create request</Button>}</div> : requests.slice(0, 4).map(request => <Button key={request.id} variant="ghost" className="h-auto w-full flex-col items-start gap-1 whitespace-normal rounded-none border-b px-0 py-4 text-left" onClick={() => setView(buyer ? "rfqs" : "opportunities")}><span className="font-semibold text-workspace-brand">{request.title}</span><span className="text-xs font-normal text-muted-foreground">{request.required_quantity} {request.unit_of_measure} · {request.status.replaceAll("_", " ")}</span>{request.quote_deadline && <span className="mt-1 flex items-center gap-1 text-xs font-normal text-muted-foreground"><Clock3 className="size-3" />Closes {new Date(request.quote_deadline).toLocaleDateString()}</span>}</Button>)}
      </div>
    </div>
    {!buyer && products.length > 0 && <section className="mt-8"><div className="flex items-center justify-between border-b pb-3"><h3 className="flex items-center gap-2 font-bold"><Package className="size-4 text-muted-foreground" />Product snapshot</h3><Button variant="ghost" size="sm" onClick={() => setView("catalog")}>Manage products<ArrowRight /></Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{products.slice(0, 4).map(product => { const image = productImages.get(product.id)?.[0]; return <Button key={product.id} variant="outline" className="h-auto flex-col items-start gap-3 whitespace-normal bg-card p-3 text-left shadow-none" onClick={() => setView("catalog")}>{image ? <img src={image.url} alt={image.alt_text ?? product.name} className="aspect-[4/3] w-full rounded object-contain" /> : <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted"><Package className="size-8 text-muted-foreground" /></div>}<span className="font-semibold">{product.name}</span><span className={`text-xs font-normal ${product.available_quantity <= product.minimum_order_quantity ? "text-workspace-warning" : "text-muted-foreground"}`}>{product.available_quantity} in stock · {product.listing_status}</span></Button>; })}</div></section>}
    {buyer && <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y py-5"><h3 className="flex items-center gap-2 font-semibold text-workspace-brand"><Store className="size-5" />Verified supplier network</h3><Button asChild variant="outline"><a href="/marketplace">Browse marketplace<ArrowRight /></a></Button></div>}
  </section>;
}