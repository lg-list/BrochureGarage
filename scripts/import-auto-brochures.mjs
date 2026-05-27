import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const root = process.cwd();
const target = process.argv[2] || "honda";
const minimumYear = Number(process.argv[3] || (target === "honda" ? 2013 : 2016));
const selectedNames = process.argv.slice(4);
const baseUrl = "https://www.auto-brochures.com/";

const sources = {
  honda: {
    name: "Honda",
    page: "https://www.auto-brochures.com/honda.html",
    outputDir: "pdfs/honda"
  }
};

function request(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 6) {
        res.resume();
        resolve(request(new URL(res.headers.location, url).toString(), redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`${res.statusCode} ${url}`));
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
    req.setTimeout(90000, () => req.destroy(new Error(`timeout ${url}`)));
  });
}

async function fetchText(url) {
  const res = await request(url);
  return new Promise((resolve, reject) => {
    let data = "";
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => resolve(data));
    res.on("error", reject);
  });
}

function cleanText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/^br>\s*/i, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/#/g, "number-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sourceSlug(source) {
  return slug(source.name.replace(/\/Range Rover/i, "").replace(/^Mini$/i, "MINI"));
}

function sourceFromLink(name, href) {
  const page = new URL(href, baseUrl).toString();
  const normalizedName = cleanText(name).replace(/^Auto Brochures\s+/i, "");
  const slugName = sourceSlug({ name: normalizedName });
  return {
    name: normalizedName,
    page,
    outputDir: `pdfs/${slugName}`
  };
}

function parseBrandSources(html) {
  const rows = [];
  const pattern = /<a\s+[^>]*href="([^"]+\.html)"[^>]*>(.*?)<\/a>/gis;
  let match;

  while ((match = pattern.exec(html))) {
    const href = match[1];
    const name = cleanText(match[2]);
    if (!name || ["Home", "Brochure Images", "Feedback", "Links"].includes(name)) continue;
    if (["email", "home", "about", "sitemap"].includes(name.toLowerCase())) continue;
    if (/^(privacy|terms|contact)$/i.test(name)) continue;
    rows.push(sourceFromLink(name, href));
  }

  const seen = new Set();
  return rows.filter((source) => {
    const key = sourceSlug(source);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function brochureYear(entry) {
  const text = `${entry.title} ${entry.file}`;
  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((match) => Number(match[0]));
  return years.find((year) => year >= 1900 && year <= 2099) || 0;
}

function safeFileName(url) {
  return decodeURIComponent(new URL(url).pathname)
    .split("/")
    .filter(Boolean)
    .slice(2)
    .join("/")
    .replace(/^Honda\//, "")
    .replace(/[\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ");
}

function parseBrochures(html, source) {
  const rows = [];
  let section = source.name;
  const pattern = /<h3>(.*?)<\/h3>|([^<]*?)<a\s+[^>]*href="([^"]+\.pdf)"[^>]*>\s*\(([^)]+)\)\s*<\/a>/gis;
  let match;

  while ((match = pattern.exec(html))) {
    if (match[1]) {
      section = cleanText(match[1]);
      continue;
    }

    const rawTitle = cleanText(match[2] || "");
    const url = new URL(match[3].replace(/&amp;/g, "&"), source.page).toString();
    const size = match[4].trim();
    if (!rawTitle || !url) continue;

    rows.push({
      section,
      title: rawTitle,
      size,
      sourceUrl: url,
      file: safeFileName(url)
    });
  }

  return rows;
}

async function downloadPdf(entry, outputDir) {
  const out = path.join(root, outputDir, entry.file);
  await mkdir(path.dirname(out), { recursive: true });
  if (existsSync(out) && statSync(out).size > 1024) {
    return { status: "skip", bytes: statSync(out).size };
  }
  const tmp = `${out}.tmp`;
  if (existsSync(tmp) && statSync(tmp).size > 1024) {
    await writeFile(out, await readFile(tmp));
    return { status: "recovered", bytes: statSync(out).size };
  }

  const res = await request(entry.sourceUrl);
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  if (buffer.subarray(0, 4).toString() !== "%PDF") {
    throw new Error(`not a PDF: ${entry.sourceUrl}`);
  }
  await writeFile(out, buffer);
  return { status: "done", bytes: buffer.length };
}

async function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8"));
}

async function importSource(source, data, dataFile) {
  const brand = sourceSlug(source);
  const html = await fetchText(source.page);
  const parsedEntries = parseBrochures(html, source);
  const entries = parsedEntries.filter((entry) => brochureYear(entry) >= minimumYear);
  console.log(`Parsed ${parsedEntries.length} ${source.name} PDF records, keeping ${entries.length} from ${minimumYear}.`);

  let completed = 0;
  let downloaded = 0;
  let skipped = 0;
  let recovered = 0;
  let failed = 0;
  for (const entry of entries) {
    completed += 1;
    try {
      const result = await downloadPdf(entry, source.outputDir);
      if (result.status === "done") downloaded += 1;
      if (result.status === "skip") skipped += 1;
      if (result.status === "recovered") recovered += 1;
      console.log(`${completed}/${entries.length} ${result.status} ${entry.file} ${result.bytes}`);
    } catch (error) {
      failed += 1;
      console.error(`${completed}/${entries.length} failed ${entry.file}: ${error.message}`);
    }
  }

  const availableEntries = entries.filter((entry) => existsSync(path.join(root, source.outputDir, entry.file)));
  data[brand] = availableEntries.map(({ title, size, file, section }) => ({ title, size, file, section }));
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  console.log(`Imported ${availableEntries.length} records. Downloaded ${downloaded}, recovered ${recovered}, skipped ${skipped}, failed ${failed}.`);
  return { brand, records: availableEntries.length, downloaded, recovered, skipped, failed };
}

async function resolveSources() {
  if (sources[target]) return [sources[target]];
  const html = await fetchText(baseUrl);
  const allSources = parseBrandSources(html);

  if (target === "selected") {
    const requested = selectedNames.map((name) => slug(name.replace(/\/Range Rover/i, "")));
    const sourceMap = new Map(allSources.map((source) => [sourceSlug(source), source]));
    const missing = requested.filter((name) => !sourceMap.has(name));
    if (missing.length) console.error(`No source page found for: ${missing.join(", ")}`);
    return requested.map((name) => sourceMap.get(name)).filter(Boolean);
  }

  if (!["all", "all-other"].includes(target)) {
    throw new Error(`Unknown import target: ${target}`);
  }

  return target === "all-other"
    ? allSources.filter((source) => sourceSlug(source) !== "honda")
    : allSources;
}

async function main() {
  const dataFile = path.join(root, "data", "brochures.json");
  const data = await readJson(dataFile, {});
  const importSources = await resolveSources();
  console.log(`Import target ${target}: ${importSources.length} brand pages, minimum year ${minimumYear}.`);

  const summaries = [];
  for (const source of importSources) {
    try {
      summaries.push(await importSource(source, data, dataFile));
    } catch (error) {
      console.error(`Failed ${source.name}: ${error.message}`);
      summaries.push({ brand: sourceSlug(source), records: 0, error: error.message });
    }
  }

  const total = summaries.reduce((sum, item) => sum + item.records, 0);
  const failed = summaries.filter((item) => item.error).length;
  console.log(`Finished ${summaries.length} brands with ${total} records. Failed brands: ${failed}.`);
}

await main();
