import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const siteUrl = (process.env.SITE_URL || "https://carbrochurearchive.com").replace(/\/$/, "");
const sitemapPath = path.join(root, "sitemap.xml");
const redirectsPath = path.join(root, "_redirects");
const robotsPath = path.join(root, "robots.txt");

function fail(message) {
  console.error(`SEO audit failed: ${message}`);
  process.exitCode = 1;
}

function localPathFromUrl(url) {
  const parsed = new URL(url);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";
  return path.join(root, pathname.replace(/^\/+/, ""));
}

function canonicalFor(file) {
  const html = file.content;
  return html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || "";
}

async function readText(file) {
  return readFile(file, "utf8");
}

const sitemap = await readText(sitemapPath);
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const robots = await readText(robotsPath);

if (!urls.length) fail("sitemap.xml has no URLs.");

const duplicateUrls = urls.filter((url, index) => urls.indexOf(url) !== index);
if (duplicateUrls.length) fail(`sitemap.xml contains duplicate URLs: ${duplicateUrls.slice(0, 5).join(", ")}`);

const redirectTargets = existsSync(redirectsPath)
  ? (await readText(redirectsPath))
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean)
  : [];

for (const url of urls) {
  if (!url.startsWith(`${siteUrl}/`)) {
    fail(`sitemap URL is outside SITE_URL: ${url}`);
    continue;
  }
  if (/\/index\.html$/i.test(url)) fail(`sitemap should not list redirecting index.html URL: ${url}`);

  const localPath = localPathFromUrl(url);
  if (!existsSync(localPath)) {
    fail(`sitemap URL has no local HTML file: ${url}`);
    continue;
  }

  const html = await readText(localPath);
  const canonical = canonicalFor({ content: html });
  if (!canonical) fail(`missing canonical: ${localPath}`);
  if (canonical && canonical !== url) fail(`canonical mismatch for ${localPath}: expected ${url}, found ${canonical}`);
  if (/name="robots"\s+content="[^"]*noindex/i.test(html)) fail(`indexable sitemap page has noindex: ${localPath}`);
}

for (const redirectSource of redirectTargets) {
  const absolute = `${siteUrl}${redirectSource}`;
  if (urls.includes(absolute)) fail(`sitemap lists a redirect source: ${absolute}`);
}

for (const file of ["llms.txt", "llms-full.txt", "ai-index.json"]) {
  const filePath = path.join(root, file);
  if (!existsSync(filePath)) {
    fail(`missing GEO machine-readable file: ${file}`);
    continue;
  }
  const content = await readText(filePath);
  if (!content.includes("Car Brochure Archive")) fail(`${file} does not identify the site.`);
  if (!content.includes(`${siteUrl}/archive-report.html`)) fail(`${file} does not link to the archive data report.`);
}

for (const bot of ["ChatGPT-User", "GPTBot", "PerplexityBot", "ClaudeBot", "anthropic-ai", "Google-Extended", "Bingbot"]) {
  const pattern = new RegExp(`User-agent:\\s*${bot}[\\s\\S]{0,100}Allow:\\s*/`, "i");
  if (!pattern.test(robots)) fail(`robots.txt does not explicitly allow ${bot}.`);
}

if (!/LLMS:\s*https:\/\/carbrochurearchive\.com\/llms\.txt/i.test(robots)) {
  fail("robots.txt does not advertise llms.txt.");
}

if (!process.exitCode) {
  console.log(`SEO audit passed for ${urls.length} canonical URLs.`);
}
