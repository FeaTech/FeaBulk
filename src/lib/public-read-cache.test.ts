import assert from "node:assert/strict";
import { test } from "node:test";
import { createPublicReadCache } from "./public-read-cache.ts";

test("public read cache deduplicates, expires, retries failures, and stays bounded", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  try {
    let calls = 0;
    const cache = createPublicReadCache(15, 2);
    const load = async () => ++calls;
    assert.deepEqual(await Promise.all([cache.read("a", load), cache.read("a", load)]), [1, 1]);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(await cache.read("a", load), 2);
    await assert.rejects(cache.read("bad", async () => { throw new Error("offline"); }));
    assert.equal(await cache.read("bad", load), 3);
    await cache.read("c", load);
    assert.equal(await cache.read("a", load), 5);
    cache.clear();
    assert.equal(await cache.read("a", load), 6);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("server reads are never shared", async () => {
  const cache = createPublicReadCache();
  let calls = 0;
  assert.equal(await cache.read("server", async () => ++calls), 1);
  assert.equal(await cache.read("server", async () => ++calls), 2);
});