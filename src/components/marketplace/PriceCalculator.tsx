import { useState } from "react";
import { estimatePrice, formatInr, type PriceTier } from "@/lib/pricing";

export function PriceCalculator({
  tiers,
  minimumOrderQuantity,
  unit,
  gstRate,
}: {
  tiers: PriceTier[];
  minimumOrderQuantity: number;
  unit: string;
  gstRate: number | null;
}) {
  const [value, setValue] = useState(String(minimumOrderQuantity));
  const estimate = estimatePrice(tiers, Number(value), { minimumOrderQuantity, gstRate });

  return (
    <section className="mt-6 border bg-white p-5" aria-labelledby="price-calculator-heading">
      <h2 id="price-calculator-heading" className="text-lg font-black">
        Price calculator
      </h2>
      <label className="mt-3 grid gap-1 text-sm font-semibold text-[#405069]">
        Quantity ({unit})
        <input
          type="number"
          inputMode="numeric"
          min={minimumOrderQuantity}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-full border border-[#C9D3DF] bg-white px-3 py-2 text-[#17233A]"
        />
      </label>
      <div className="mt-4 text-sm" role="status" aria-live="polite">
        {estimate.status === "invalid" && <p>Enter a whole number of {unit}.</p>}
        {estimate.status === "below_minimum" && (
          <p>
            The minimum order is {estimate.minimumQuantity.toLocaleString("en-IN")} {unit}.
          </p>
        )}
        {estimate.status === "quote_required" && (
          <p>
            {estimate.reason === "no_tiers"
              ? "This supplier prices by quotation."
              : "This quantity is outside the published price tiers."}{" "}
            Request a quote to get a price.
          </p>
        )}
        {estimate.status === "priced" && (
          <>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-1">
              <dt>Unit price</dt>
              <dd className="text-right font-bold">{formatInr(estimate.unitPrice)}</dd>
              <dt>Subtotal</dt>
              <dd className="text-right font-bold">{formatInr(estimate.subtotal)}</dd>
              {estimate.gstRate !== null && (
                <>
                  <dt>GST ({estimate.gstRate}%)</dt>
                  <dd className="text-right font-bold">{formatInr(estimate.gstAmount)}</dd>
                </>
              )}
              <dt className="border-t pt-2 font-black text-[#102B52]">
                {estimate.gstRate === null ? "Total before GST" : "Estimated total"}
              </dt>
              <dd className="border-t pt-2 text-right text-lg font-black text-[#102B52]">
                {formatInr(estimate.total)}
              </dd>
            </dl>
            {estimate.nextTier && (
              <p className="mt-3 border-l-2 border-[#F87908] pl-3">
                Order {estimate.nextTier.minimumQuantity.toLocaleString("en-IN")} {unit} or more to
                pay {formatInr(estimate.nextTier.unitPrice)} per unit.
              </p>
            )}
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-[#526178]">
        Indicative only. Freight is extra and the supplier&apos;s quote sets the final price.
      </p>
    </section>
  );
}
