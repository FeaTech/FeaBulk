import type { SupplierRating as Rating } from "@/lib/marketplace";

export function SupplierRating({ rating }: { rating: Rating | undefined }) {
  if (!rating || rating.review_count === 0)
    return <span className="text-sm text-[#526178]">No reviews yet</span>;
  const reviews = `${rating.review_count} ${rating.review_count === 1 ? "review" : "reviews"}`;
  return (
    <span
      className="text-sm font-bold text-[#102B52]"
      aria-label={`Rated ${rating.rating.toFixed(1)} out of 5 from ${reviews}`}
    >
      <span className="text-[#F87908]" aria-hidden="true">
        ★
      </span>{" "}
      {rating.rating.toFixed(1)} <span className="font-normal text-[#526178]">({reviews})</span>
    </span>
  );
}
