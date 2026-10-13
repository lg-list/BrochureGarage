import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const site = "https://carbrochurearchive.com";
const baseline = JSON.parse(await readFile("seo/url-baseline.json", "utf8"));
const policy = JSON.parse(await readFile("data/adsense-policy.json", "utf8"));
const library = JSON.parse(await readFile("data/brochures.json", "utf8"));
const verified = JSON.parse(await readFile("data/verified-brochures.json", "utf8"));
const sitemap = await readFile("sitemap.xml", "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const originalData = JSON.stringify(library);
const failures = [];
const pages = [];
const slug = text => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const adPages = [];
const allowed = policy.allowedPages.map(p => `${site}/${p}`);
for (const url of urls) {
  const relative = url.slice(site.length + 1) || "index.html";
  const file = path.join(root, relative.endsWith("/") ? relative + "index.html" : relative);
  if (!existsSync(file)) { failures.push(`Missing ${url}`); continue; }
  const html = await readFile(file, "utf8");
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1];
  if (canonical !== url) failures.push(`Canonical mismatch ${url}`);
  const ad = html.includes("pagead/js/adsbygoogle.js");
  if (ad) { adPages.push(url); if (!allowed.includes(url)) failures.push(`Unreviewed advertising page ${url}`); }
  if (!html.includes(`name="google-adsense-account" content="ca-${policy.publisherId}"`)) failures.push(`Missing account verification ${url}`);
  if (/\/history\/(?!acura\/)/.test(url) && url !== `${site}/history/` && html.includes("The history page provides a simple reference layer")) failures.push(`Unchanged generic history ${url}`);
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(match[1]); } catch { failures.push(`Invalid schema ${url}`); }
  }
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
  const text = main.replace(/<script[\s\S]*?<\/script>|<[^>]+>/g," ").replace(/\s+/g," ").trim();
  pages.push({url,advertising:ad,mainTextWords:text.split(/\s+/).length,htmlBytes:Buffer.byteLength(html)});
}
const missingOriginalUrls = baseline.urls.filter(url => !urls.includes(url));
failures.push(...missingOriginalUrls.map(url=>`Original URL lost ${url}`));
let preservedRecords = 0;
for (const [brand,entries] of Object.entries(library)) {
  if (!entries.length) continue;
  const brandHtml = await readFile(`brands/${slug(brand)}/index.html`,"utf8");
  for (const entry of entries) {
    const expected = `https://pub-b4d0d3d7cb284abc8a79724880c09cb7.r2.dev/pdfs/${encodeURI(`${brand}/${entry.file}`)}`;
    if (!brandHtml.includes(expected)) failures.push(`PDF link changed: ${brand}/${entry.file}`);
    else preservedRecords++;
  }
}
const sizesMatch = Object.values(library).flat().length === baseline.pdfRecords;
if (!sizesMatch || originalData !== JSON.stringify(baseline.catalog)) failures.push("Original catalog data changed");
if (adPages.length !== allowed.length) failures.push("Advertising allowlist does not match generated pages");
const rights = Object.entries(library).flatMap(([brand,entries])=>entries.map(entry=>({brand,file:entry.file,title:entry.title,rightsEvidence:"not_documented_in_repository"})));
await mkdir("seo", {recursive:true});
await writeFile("seo/rights-inventory.json", JSON.stringify({description:"Evidence inventory, not a determination of copyright infringement or legal permission.",records:rights},null,2)+"\n");
const report = {checkedOn:"2026-10-13",technicalPassed:failures.length === 0,readyToResubmit:false,
  originalUrls:baseline.urls.length,currentUrls:urls.length,missingOriginalUrls,preservedPdfRecords:preservedRecords,
  advertisingPages:adPages,reviewedPdfs:verified.length,failures,
  unresolved:["Redistribution rights for imported PDFs are not documented in this repository.","Operator identity and the contact mailbox have not been confirmed by the owner.","Technical checks and word counts do not determine Google's unique-content or audience assessment."],pages};
await writeFile("seo/adsense-audit.json", JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({technicalPassed:report.technicalPassed,originalUrls:report.originalUrls,currentUrls:report.currentUrls,preservedPdfRecords:preservedRecords,advertisingPages:adPages,reviewedPdfs:verified.length,failures},null,2));
if (failures.length) process.exitCode=1;
