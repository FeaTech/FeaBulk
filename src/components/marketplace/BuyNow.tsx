import { useEffect, useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/InfoTip";
import { getIdentity, getOrganizations, placeDirectOrder, type Organization } from "@/lib/marketplace";

type Tier = { minimum_quantity: number | string; maximum_quantity: number | string; unit_price: number | string };

export function BuyNow({ productId, slug, moq, available, unit, tiers }: { productId: string; slug: string; moq: number; available: number; unit: string; tiers: Tier[] }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "signed_out" | "not_buyer" | "ready">("loading");
  const [buyer, setBuyer] = useState<Organization | null>(null);
  const [quantity, setQuantity] = useState(String(moq));
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const user = await getIdentity();
      if (!user) return setState("signed_out");
      const org = (await getOrganizations()).find((item) => item.kind === "buyer");
      if (!org) return setState("not_buyer");
      setBuyer(org);
      setState("ready");
    })().catch(() => setState("signed_out"));
  }, []);

  const qty = Number(quantity);
  const tier = tiers.find((t) => qty >= Number(t.minimum_quantity) && qty <= Number(t.maximum_quantity))
    ?? [...tiers].sort((a, b) => Number(b.minimum_quantity) - Number(a.minimum_quantity)).find((t) => qty >= Number(t.minimum_quantity));
  const subtotal = tier ? Number(tier.unit_price) * qty : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!buyer) return;
    setBusy(true); setError("");
    try {
      await placeDirectOrder({ productId, buyerOrganizationId: buyer.id, quantity: qty, addressLine: address, pinCode: pin });
      await router.navigate({ to: "/buyer" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order could not be placed.");
    } finally { setBusy(false); }
  }

  if (state === "loading") return null;
  if (state === "signed_out") return <Button asChild variant="workspace" className="mt-6 h-11"><Link to="/auth" search={{ redirect: `/products/${slug}#buy-now` }}>Sign in to buy</Link></Button>;
  if (state === "not_buyer") return <p className="mt-6 border bg-card p-4 text-sm">Only buyer accounts can place orders.</p>;
  if (available < moq) return <p className="mt-6 border bg-card p-4 text-sm">Out of stock right now.</p>;

  return (
    <form onSubmit={submit} className="mt-6 grid gap-3 border bg-card p-5">
      <h2 className="text-lg font-bold">Buy now</h2>
      <label className="grid gap-1 text-sm font-semibold"><FieldLabel label="Quantity" hint="How many units you want to order. It must be at least the minimum and no more than the stock available.">Quantity ({unit}) — min {moq.toLocaleString("en-IN")}, {available.toLocaleString("en-IN")} available</FieldLabel>
        <input type="number" required min={moq} max={available} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="border border-border px-3 py-2 font-normal" />
      </label>
      <label className="grid gap-1 text-sm font-semibold"><FieldLabel label="Delivery address" hint="Full address where the goods should be delivered, including building, street and city." />
        <textarea required minLength={10} value={address} onChange={(e) => setAddress(e.target.value)} className="border border-border px-3 py-2 font-normal" rows={2} />
      </label>
      <label className="grid gap-1 text-sm font-semibold"><FieldLabel label="PIN code" hint="6-digit postal code of the delivery address." />
        <input required pattern="[1-9][0-9]{5}" value={pin} onChange={(e) => setPin(e.target.value)} className="border border-border px-3 py-2 font-normal" />
      </label>
      {subtotal !== null && qty >= moq && <p className="text-sm">Subtotal <b>₹{subtotal.toLocaleString("en-IN")}</b> + GST. The seller confirms and fulfils your order. You pay FeaBulk from your Orders screen.</p>}
      {error && <p role="alert" className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button variant="workspace" className="h-11" disabled={busy || !buyer}>{busy ? "Placing order…" : "Place order"}</Button>
    </form>
  );
}
