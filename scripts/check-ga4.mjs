import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const id = "G-G48WRLCRGQ";
const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
for (const url of urls) {
  const route = decodeURIComponent(url.pathname);
  const file = path.join(root, route.endsWith("/") ? `${route}index.html` : route);
  const html = await readFile(file, "utf8");
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  assert.equal([...head.matchAll(/src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-G48WRLCRGQ"/g)].length, 1, url.href);
  const script = [...head.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(code => code.includes("function gtag()"));
  assert(script, `Missing GA4 initialization: ${url.href}`);
  for (const [protocol, pathname, expected] of [["https:", route, 1], ["https:", "/test/index.html", 0], ["file:", route, 0]]) {
    const window = {};
    const context = { window, location: { protocol, pathname } };
    Object.defineProperty(context, "dataLayer", { get: () => window.dataLayer });
    vm.runInNewContext(script, context);
    assert.equal(window.dataLayer.filter(args => args[0] === "config" && args[1] === id).length, expected, url.href);
  }
}
console.log(`GA4 passed for ${urls.length} canonical pages: one tag, one config, local/redirect aliases excluded.`);
