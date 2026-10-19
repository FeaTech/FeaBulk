import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AUCTION_MAX_DAYS, type LotType } from "@/lib/auction-rules";

export type ProductSaleType = "regular" | "auction";
const field = "w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 font-normal text-foreground";

export function ProductSaleFields({ saleType, onSaleTypeChange }: {
  saleType: ProductSaleType;
  onSaleTypeChange: (value: ProductSaleType) => void;
}) {
  const [lotType, setLotType] = useState<LotType>("lot");
  return <>
    <fieldset className="min-w-0 sm:col-span-2">
      <legend className="mb-2 text-sm font-semibold">Sale type</legend>
      <RadioGroup name="sale_type" value={saleType} onValueChange={value => onSaleTypeChange(value === "auction" ? "auction" : "regular")} className="flex flex-wrap gap-5" aria-label="Sale type">
        <label className="flex cursor-pointer items-center gap-2"><RadioGroupItem value="regular" /> Regular sale</label>
        <label className="flex cursor-pointer items-center gap-2"><RadioGroupItem value="auction" /> Auction</label>
      </RadioGroup>
    </fieldset>
    {saleType === "regular" ? <>
      <label className="grid gap-1 text-sm font-semibold text-muted-foreground">Minimum order quantity<input name="moq" type="number" min={1} step={1} required className={field} /></label>
      <label className="grid gap-1 text-sm font-semibold text-muted-foreground">Unit price (₹, before GST)<input name="unit_price" type="number" min="0.01" step="0.01" required className={field} /></label>
    </> : <>
      <label className="grid gap-1 text-sm font-semibold text-muted-foreground sm:col-span-2">What buyers bid on
        <select name="lot_type" value={lotType} onChange={e => setLotType(e.target.value === "per_unit" ? "per_unit" : "lot")} className={field}>
          <option value="lot">Whole lot — one total price</option><option value="per_unit">Per-unit price — for the full quantity</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-muted-foreground">Auction quantity<input name="auction_quantity" type="number" min={1} step={1} required className={field} /></label>
      <label className="grid gap-1 text-sm font-semibold text-muted-foreground">Starting price (₹ {lotType === "lot" ? "for the lot" : "per unit"}, before GST)<input name="start_price" type="number" min={1} step="0.01" required className={field} /></label>
      <label className="grid gap-1 text-sm font-semibold text-muted-foreground">Minimum bid increase (₹)<input name="bid_step" type="number" min={1} step="0.01" required className={field} /></label>
      <label className="grid gap-1 text-sm font-semibold text-muted-foreground">Token amount to join (₹)<input name="token_amount" type="number" min={1} step="0.01" required className={field} /></label>
      <label className="grid gap-1 text-sm font-semibold text-muted-foreground">Duration (days, 1–{AUCTION_MAX_DAYS})<input name="duration_days" type="number" min={1} max={AUCTION_MAX_DAYS} defaultValue={7} required className={field} /></label>
      <label className="grid gap-1 text-sm font-semibold text-muted-foreground">Start time (optional)<input name="starts_at" type="datetime-local" className={field} /></label>
    </>}
  </>;
}