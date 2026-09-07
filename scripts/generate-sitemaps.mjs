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
const files = [];
for (const [name, items] of Object.entries(groups)) {
  const file = `sitemap-${name}.xml`;
  files.push(file);
  await writeFile(file, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join("\n")}\n</urlset>\n`);
}
await writeFile("sitemap-index.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map((file) => `  <sitemap><loc>${siteUrl}/${file}</loc></sitemap>`).join("\n")}\n</sitemapindex>\n`);
console.log(`Generated ${files.length} segmented sitemaps from ${entries.length} canonical URLs.`);
