import assert from "node:assert/strict";
import { test } from "node:test";
import {
  productImageErrorMessage,
  productImageFileProblem,
  productImageSelectionProblems,
  resolveProductImageUrl,
} from "./product-image-rules.ts";

const photo = (name: string, type = "image/jpeg", size = 200_000) => ({ name, type, size });

test("accepts JPEG, PNG and WebP photos up to 5 MB", () => {
  assert.equal(productImageFileProblem(photo("a.jpg")), null);
  assert.equal(productImageFileProblem(photo("a.png", "image/png")), null);
  assert.equal(productImageFileProblem(photo("a.webp", "image/webp", 5 * 1024 * 1024)), null);
});

test("names the file and the reason when a photo is refused", () => {
  assert.match(
    productImageFileProblem(photo("a.gif", "image/gif")) ?? "",
    /"a\.gif" is not a JPEG/,
  );
  assert.match(productImageFileProblem(photo("doc.pdf", "application/pdf")) ?? "", /doc\.pdf/);
  assert.match(
    productImageFileProblem(photo("big.jpg", "image/jpeg", 7.3 * 1024 * 1024)) ?? "",
    /7\.3 MB/,
  );
  assert.match(productImageFileProblem(photo("empty.jpg", "image/jpeg", 0)) ?? "", /empty/);
});

test("enforces six photos per product across existing and new ones", () => {
  assert.deepEqual(productImageSelectionProblems([photo("a.jpg"), photo("b.jpg")], 4), []);
  assert.match(
    productImageSelectionProblems([photo("a.jpg"), photo("b.jpg")], 5)[0] ?? "",
    /only 1 more/,
  );
  assert.match(productImageSelectionProblems([photo("a.jpg")], 6)[0] ?? "", /already has 6/);
});

test("turns storage and database errors into plain explanations", () => {
  assert.match(productImageErrorMessage("new row violates row-level security policy"), /drafts/);
  assert.match(productImageErrorMessage("Images are locked after submission"), /locked once/);
  assert.match(productImageErrorMessage("A listing can have at most 6 images"), /at most 6/);
  assert.match(productImageErrorMessage("TypeError: Failed to fetch"), /connection/);
  assert.match(
    productImageErrorMessage("mime type image/gif is not supported"),
    /JPEG, PNG or WebP/,
  );
  assert.match(
    productImageErrorMessage("The object exceeded the maximum allowed size"),
    /larger than 5 MB/,
  );
  assert.equal(
    productImageErrorMessage("Something odd"),
    "The photo could not be uploaded: Something odd",
  );
});

test("builds a loadable address for each kind of stored image path", () => {
  const publicUrl = (key: string) => `https://cdn.example/product-images/${key}`;
  assert.equal(
    resolveProductImageUrl("4b03/abc.png", publicUrl),
    "https://cdn.example/product-images/4b03/abc.png",
  );
  assert.equal(
    resolveProductImageUrl("https://images.example/a.jpg", publicUrl),
    "https://images.example/a.jpg",
  );
  assert.equal(resolveProductImageUrl("/__l5e/assets-v1/x/paper.jpg", publicUrl), null);
  assert.equal(resolveProductImageUrl("//cdn.example/a.jpg", publicUrl), null);
  assert.equal(resolveProductImageUrl("   ", publicUrl), null);
});
