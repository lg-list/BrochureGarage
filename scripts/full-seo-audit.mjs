import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const siteUrl = "https://carbrochurearchive.com";
const seoDir = path.join(root, "seo");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "pdfs", "tools", ".tools"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

function rel(file) { return path.relative(root, file).replaceAll(path.sep, "/"); }
function stripTags(html) { return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function attr(html, pattern) { return html.match(pattern)?.[1]?.trim() || ""; }
function localTarget(href, from) {
  if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) return null;
  if (/^https?:\/\//i.test(href)) return href.startsWith(siteUrl) ? new URL(href).pathname : null;
  return new URL(href, `https://local.test/${rel(from)}`).pathname;
}
function targetFile(url) {
  if (!url) return null;
  const clean = decodeURIComponent(url.split("#")[0].split("?")[0]).replace(/^\//, "");
  if (!clean) return path.join(root, "index.html");
  if (clean.endsWith("/")) return path.join(root, clean, "index.html");
  return path.join(root, clean);
}

const files = await walk(root);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const pageHtmlFiles = htmlFiles.filter((file) => !/^google[a-f0-9]+\.html$/i.test(path.basename(file)));
const pdfFiles = (await walk(path.join(root, "pdfs")).catch(() => [])).filter((file) => file.toLowerCase().endsWith(".pdf"));
const imageFiles = files.filter((file) => /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(file));
const cssFiles = files.filter((file) => file.endsWith(".css"));
const jsFiles = files.filter((file) => file.endsWith(".js"));
const pageRows = [];
const titleMap = new Map();
const descriptionMap = new Map();
const outgoing = new Map();
const incoming = new Map();
const broken = [];
const pdfLandingPages = new Set();
let pdfLinks = 0;
let totalHtmlBytes = 0;

for (const file of pageHtmlFiles) {
  const html = await readFile(file, "utf8");
  const relative = rel(file);
  const canonical = attr(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i);
  const title = attr(html, /<title[^>]*>([^<]+)/i);
  const description = attr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
  const robots = attr(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i);
  const h1 = [...html.matchAll(/<h1\b/gi)].length;
  const schema = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["']/gi)].length;
  const og = [...html.matchAll(/<meta[^>]+property=["']og:/gi)].length;
  const textLength = stripTags(html).length;
  totalHtmlBytes += Buffer.byteLength(html);
  if (title) titleMap.set(title, [...(titleMap.get(title) || []), relative]);
  if (description) descriptionMap.set(description, [...(descriptionMap.get(description) || []), relative]);
  const indexable = !/\bnoindex\b/i.test(robots);
  pageRows.push({ url: canonical, canonical, file: relative, indexable, title, description, h1, schema, og, textLength });
  const links = [...html.matchAll(/\bhref=["']([^"']+)["']/gi)].map((match) => match[1]);
  const targets = new Set();
  for (const href of links) {
    if (/\.pdf(?:[?#]|$)/i.test(href)) pdfLinks += 1;
    const url = localTarget(href, file);
    if (!url) continue;
    const target = targetFile(url);
    if (!target) continue;
    const targetRel = rel(target);
    targets.add(targetRel);
    incoming.set(targetRel, (incoming.get(targetRel) || 0) + 1);
    if (/\.pdf$/i.test(targetRel)) pdfLandingPages.add(relative);
    else if (!(await stat(target).then(() => true).catch(() => false))) broken.push({ from: relative, href, target: targetRel });
  }
  outgoing.set(relative, [...targets]);
}

const indexed = pageRows.filter((row) => row.indexable && row.canonical);
const orphanPages = indexed.filter((row) => !incoming.has(row.file) && row.file !== "index.html").map((row) => row.file);
const duplicates = (map) => [...map.entries()].filter(([, paths]) => paths.length > 1).map(([value, paths]) => ({ value, paths }));
const missing = {
  title: pageRows.filter((row) => !row.title).map((row) => row.file),
  description: pageRows.filter((row) => !row.description).map((row) => row.file),
  canonical: pageRows.filter((row) => row.indexable && !row.url).map((row) => row.file),
  h1: pageRows.filter((row) => row.indexable && row.h1 !== 1).map((row) => `${row.file} (${row.h1})`),
  schema: pageRows.filter((row) => row.indexable && !row.schema).map((row) => row.file),
  og: pageRows.filter((row) => row.indexable && row.og < 2).map((row) => row.file)
};

const linkRows = pageRows.map((row) => ({
  url: row.url || `${siteUrl}/${row.file}`,
  file: row.file,
  incoming_internal_links: incoming.get(row.file) || 0,
  outgoing_internal_links: outgoing.get(row.file)?.length || 0,
  orphan_status: orphanPages.includes(row.file) ? "orphan" : "connected"
}));
await writeFile(path.join(seoDir, "internal-link-report.json"), JSON.stringify({ generated_at: new Date().toISOString(), pages: linkRows }, null, 2));
await writeFile(path.join(seoDir, "pages.json"), JSON.stringify({ generated_at: new Date().toISOString(), pages: pageRows }, null, 2));
await writeFile(path.join(seoDir, "broken-links.json"), JSON.stringify({ generated_at: new Date().toISOString(), broken }, null, 2));

const severity = { critical: [], high: [], medium: [], low: [] };
if (!exists("robots.txt")) severity.critical.push("robots.txt is missing.");
if (!exists("sitemap.xml")) severity.critical.push("sitemap.xml is missing.");
if (broken.length) severity.high.push(`${broken.length} broken local HTML links found.`);
if (missing.canonical.length) severity.high.push(`${missing.canonical.length} indexable pages have no canonical.`);
if (orphanPages.length) severity.high.push(`${orphanPages.length} indexable pages have no incoming internal link.`);
if (duplicates(titleMap).length) severity.medium.push(`${duplicates(titleMap).length} duplicate title value(s) found.`);
if (duplicates(descriptionMap).length) severity.medium.push(`${duplicates(descriptionMap).length} duplicate description value(s) found.`);
if (missing.h1.length) severity.medium.push(`${missing.h1.length} indexable pages do not have exactly one H1.`);
if (missing.schema.length) severity.medium.push(`${missing.schema.length} indexable pages have no JSON-LD schema.`);
if (missing.og.length) severity.low.push(`${missing.og.length} indexable pages have incomplete Open Graph metadata.`);
severity.low.push("PDF files are served as documents; only model/brand HTML pages are currently used as landing pages.");
severity.low.push("Performance checks here are static proxies; verify Core Web Vitals in Search Console and PageSpeed Insights.");

function exists(name) { return files.some((file) => rel(file) === name); }
function section(name, items) { return `## ${name}\n${items.length ? items.map((item) => `- ${item}`).join("\n") : "- None detected."}\n`; }
const report = `# SEO Audit\n\nGenerated: ${new Date().toISOString()}\n\n## Scope and baseline\n- HTML pages: ${htmlFiles.length}\n- Indexable pages with canonicals: ${indexed.length}\n- PDF files on disk: ${pdfFiles.length}\n- PDF links in HTML: ${pdfLinks}\n- PDF-linked landing pages: ${pdfLandingPages.size}\n- Image assets: ${imageFiles.length}\n- CSS files: ${cssFiles.length}\n- JavaScript files: ${jsFiles.length}\n- Total HTML bytes: ${totalHtmlBytes}\n- Current URL architecture: Home -> Brand -> Model -> brochure records. Existing URLs are preserved.\n\n${section("Critical", severity.critical)}\n${section("High", severity.high)}\n${section("Medium", severity.medium)}\n${section("Low", severity.low)}\n## Checks\n- Duplicate titles: ${duplicates(titleMap).length}\n- Duplicate descriptions: ${duplicates(descriptionMap).length}\n- Broken local links: ${broken.length}\n- Orphan indexable pages: ${orphanPages.length}\n- Missing title: ${missing.title.length}\n- Missing description: ${missing.description.length}\n- Missing canonical: ${missing.canonical.length}\n- Incorrect H1 count: ${missing.h1.length}\n- Missing JSON-LD: ${missing.schema.length}\n- Incomplete Open Graph: ${missing.og.length}\n\n## Safe fixes applied\n- Preserved existing brand/model/history URLs, PDF paths, image paths, and CSS structure.\n- Kept redirecting index.html URLs out of the sitemap.\n- Kept the 404 page noindex,follow and ad-free.\n- Utility/legal pages remain ad-free to avoid monetizing low-intent pages.\n\n## Limitations\nThis repository audit cannot see Search Console coverage, query positions, server headers, crawl logs, or real Core Web Vitals. Use the GSC CSV workflow for query-based opportunities; no keyword opportunity is invented without Search Console data.\n`;
await writeFile(path.join(root, "SEO-AUDIT.md"), report);
console.log(`SEO audit report written: ${indexed.length} indexable pages, ${broken.length} broken links, ${orphanPages.length} orphan pages.`);
