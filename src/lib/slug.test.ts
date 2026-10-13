import assert from "node:assert/strict";
import { test } from "node:test";
import { slugCandidate, slugify } from "./slug.ts";

const VALID_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

test("turns a product name into a lowercase hyphenated slug", () => {
  assert.equal(slugify("Steel Hex Bolts, M8 x 30 mm"), "steel-hex-bolts-m8-x-30-mm");
  assert.equal(slugify("  A4 Copier Paper (80 GSM)  "), "a4-copier-paper-80-gsm");
});

test("handles accents, ampersands and repeated separators", () => {
  assert.equal(slugify("Café & Crème -- Sachets"), "cafe-and-creme-sachets");
  assert.equal(slugify("[TEST] Cotton_Tote/Bag"), "test-cotton-tote-bag");
});

test("returns an empty slug when the name has no usable characters", () => {
  assert.equal(slugify("---"), "");
  assert.equal(slugify("螺栓"), "");
});

test("keeps long names within the limit without a trailing hyphen", () => {
  const slug = slugify(`${"bolt ".repeat(30)}`);
  assert.ok(slug.length <= 80);
  assert.match(slug, VALID_SLUG);
});

test("first attempt uses the base slug and later attempts add a number", () => {
  assert.equal(slugCandidate("steel-bolts", 1), "steel-bolts");
  assert.equal(slugCandidate("steel-bolts", 2), "steel-bolts-2");
  assert.equal(slugCandidate("steel-bolts", 11), "steel-bolts-11");
});

test("cleans a hand-typed slug and falls back when nothing is left", () => {
  assert.equal(slugCandidate("Steel Bolts!", 1), "steel-bolts");
  assert.equal(slugCandidate("螺栓", 1), "product");
  assert.equal(slugCandidate("螺栓", 3), "product-3");
});

test("numbered slugs still fit the limit and stay valid", () => {
  const candidate = slugCandidate("a".repeat(80), 12);
  assert.equal(candidate.length, 80);
  assert.ok(candidate.endsWith("-12"));
  assert.match(candidate, VALID_SLUG);
});
