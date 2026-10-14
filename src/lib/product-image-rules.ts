// Mirrors the product-images bucket limits and add_product_image_command, so sellers hear
// about a bad file before anything is uploaded.
export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_LIMIT = 6;

type FileFacts = { name: string; type: string; size: number };

/** Why a chosen file cannot be used as a product photo, or null when it is fine. */
export function productImageFileProblem(file: FileFacts): string | null {
  if (!(PRODUCT_IMAGE_TYPES as readonly string[]).includes(file.type))
    return `"${file.name}" is not a JPEG, PNG or WebP image.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > PRODUCT_IMAGE_MAX_BYTES)
    return `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. Photos can be at most 5 MB.`;
  return null;
}

/** Every problem with a selection of files for a product that already has some photos. */
export function productImageSelectionProblems(files: FileFacts[], existingCount: number): string[] {
  const problems = files.map(productImageFileProblem).filter((item): item is string => !!item);
  const room = PRODUCT_IMAGE_LIMIT - existingCount;
  if (files.length > room)
    problems.push(
      room <= 0
        ? `This product already has ${PRODUCT_IMAGE_LIMIT} photos, the most allowed. Remove one first.`
        : `You chose ${files.length} photos but only ${room} more can be added (${PRODUCT_IMAGE_LIMIT} per product).`,
    );
  return problems;
}

/** A seller-readable explanation for an error raised by Storage or the image commands. */
export function productImageErrorMessage(raw: string): string {
  if (/locked after submission/i.test(raw))
    return "Photos are locked once a product is submitted for review.";
  if (/at most 6 images/i.test(raw))
    return `A product can have at most ${PRODUCT_IMAGE_LIMIT} photos. Remove one first.`;
  if (/row-level security|unauthori[sz]ed|access denied|403/i.test(raw))
    return "You can only add photos to your own business's products while they are drafts that have not been submitted.";
  if (/mime|content type|not supported/i.test(raw))
    return "Only JPEG, PNG or WebP images can be uploaded.";
  if (/maximum allowed size|too large|payload|413/i.test(raw))
    return "The photo is larger than 5 MB. Choose a smaller file.";
  if (/has not been uploaded|object not found/i.test(raw))
    return "The photo did not finish uploading. Please try again.";
  if (/failed to fetch|network|timed? ?out|load failed/i.test(raw))
    return "The upload stopped because the connection dropped. Check your internet connection and try again.";
  return `The photo could not be uploaded: ${raw}`;
}
