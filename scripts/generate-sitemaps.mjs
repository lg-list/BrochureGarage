import { readFile, writeFile } from "node:fs/promises";

const siteUrl = "https://carbrochurearchive.com";
const xml = await readFile("sitemap.xml", "utf8");
const entries = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)].map((match) => match[0]);
const groups = {
  pages: entries.filter((entry) => !/\/brands\/|\/models\/|\/history\//.test(entry)),
  brands: entries.filter((entry) => /\/brands\//.test(entry)),
  models: entries.filter((entry) => /\/models\//.test(entry)),
  history: entries.filter((entry) => /\/history\//.test(entry))
};
let recovery = null;
try {
  recovery = JSON.parse(await readFile("data/indexing-recovery-targets.json", "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (recovery) {
  const requested = new Set(recovery.urls);
  const selected = [];
  for (const entry of entries) {
    const url = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!requested.has(url)) continue;
    const relative = url.slice(siteUrl.length + 1) || "index.html";
    if (!url.startsWith(siteUrl + "/") || relative.includes("..")) throw new Error("Invalid recovery URL");
    const file = relative.endsWith("/") ? relative + "index.html" : relative;
    const html = await readFile(file, "utf8");
    if (/<meta[^>]+name=["'](?:robots|googlebot)["'][^>]+content=["'][^"']*noindex/i.test(html)) throw new Error(`Recovery URL is noindex: ${url}`);
    if (!html.includes(`rel="canonical" href="${url}"`)) throw new Error(`Recovery canonical mismatch: ${url}`);
    selected.push(entry);
  }
  if (selected.length !== requested.size) throw new Error("Some recovery URLs are missing from the canonical sitemap");
  groups.recovery = selected;
}
const files = [];
for (const [name, items] of Object.entries(groups)) {
  const file = `sitemap-${name}.xml`;
  files.push(file);
  await writeFile(file, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join("\n")}\n</urlset>\n`);
}
await writeFile("sitemap-index.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map((file) => `  <sitemap><loc>${siteUrl}/${file}</loc></sitemap>`).join("\n")}\n</sitemapindex>\n`);
console.log(`Generated ${files.length} segmented sitemaps from ${entries.length} canonical URLs.`);
