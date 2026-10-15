import { useState } from "react";

/**
 * A product photo that falls back to the product's first letter when the file cannot be
 * loaded, instead of the browser's broken-image icon.
 */
export function ProductThumb({
  src,
  alt,
  name,
  className,
  loading = "lazy",
}: {
  src: string | undefined;
  alt: string;
  name: string;
  className: string;
  loading?: "lazy" | "eager";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src)
    return (
      <div
        className={`${className} flex items-center justify-center bg-workspace-info-soft font-bold text-workspace-brand`}
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={`${className} bg-workspace-info-soft object-cover`}
    />
  );
}
