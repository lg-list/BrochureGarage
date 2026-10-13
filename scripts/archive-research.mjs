export const researchPaths = ["brochure-finder.html", "research/honda-crv-2016-vs-2018/"];

export function coverageGroups(brand, documents, h) {
  const groups = new Map();
  for (const entry of documents) {
    const model = h.brochureModel(entry, brand);
    if (!groups.has(model)) groups.set(model, []);
    groups.get(model).push(entry);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([model, entries]) => {
    const years = [...new Set(entries.map(h.brochureYear).filter(y => y !== "Other"))].sort();
    return { model, entries, years };
  });
}

export function renderHistoricalSources(brand, documents, logo, h) {
  const { esc, header, footer, brandUrl, modelUrl, isSpecificModel, brochureYear } = h;
  const groups = coverageGroups(brand, documents, h);
  const years = [...new Set(documents.map(brochureYear).filter(y => y !== "Other"))].sort();
  const repeated = groups.flatMap(g => g.years.map(year => ({ model: g.model, year, entries: g.entries.filter(e => brochureYear(e) === year) }))).filter(g => g.entries.length > 1);
  const rows = groups.map(g => `<tr><th scope="row"><a href="../../${isSpecificModel(g.model, brand) ? modelUrl(brand, g.model) : brandUrl(brand)}">${esc(g.model)}</a></th><td>${g.entries.length}</td><td>${esc(g.years.join(", ") || "Year not recorded")}</td></tr>`).join("");
  const samples = [...documents].sort((a,b) => brochureYear(a).localeCompare(brochureYear(b))).slice(0,4);
  return `${header("../../")}
    <main>
      <section class="brand-page-head">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../../">Home</a><span>/</span><a href="../">Brand History</a><span>/</span><span>${esc(brand.name)}</span></nav>
        <img class="source-brand-logo" src="${logo}" alt="${esc(brand.name)} logo" width="100" height="72" />
        <h1>${esc(brand.name)}: Historical Brochure Sources</h1>
        <p>${documents.length} catalog records in ${groups.length} groups${years.length ? `, with recorded years from ${years[0]} to ${years.at(-1)}` : ""}. The tables describe this collection, rather than the complete production history of the brand.</p>
      </section>
      <section class="directory-section">
        <h2>Documents available for historical research</h2>
        <div class="report-table-wrap"><table class="report-table"><caption>${esc(brand.name)} collection by model or range</caption><thead><tr><th scope="col">Model / range</th><th scope="col">Records</th><th scope="col">Recorded years</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p>Years missing from a row mean that this archive has no record for that year. They do not establish when a vehicle was launched, redesigned, or discontinued.</p>
      </section>
      <section class="directory-section">
        <h2>Earlier records in this collection</h2>
        <ul>${samples.map(e => `<li><a href="../../${brandUrl(brand)}">${esc(e.title)}</a> (${esc(e.size)} catalog size)</li>`).join("")}</ul>
        <p>Use the exact title to locate the document in the brand index. Range brochures may cover several models; a range title is not evidence that every model has a separate brochure here.</p>
      </section>
      <section class="directory-section">
        <h2>Same-year editions</h2>
        ${repeated.length ? `<p>${repeated.length} model/year groups contain more than one record. Editions are listed separately because their coverage or publication wording may differ.</p><ul>${repeated.slice(0,8).map(g => `<li>${esc(g.model)}, ${g.year}: ${g.entries.length} records (${g.entries.map(e=>esc(e.title)).join("; ")})</li>`).join("")}</ul>` : `<p>No model/year group in this collection currently contains multiple records. This is a description of the catalog, not proof that the manufacturer published only one edition.</p>`}
      </section>
      <section class="directory-section">
        <h2>Check the historical context</h2>
        <p>Consult the <a href="${esc(brand.official)}" target="_blank" rel="noopener">${esc(brand.name)} manufacturer or heritage resource</a> for material outside this collection. Use <a href="../../brochure-finder.html">Brochure Finder</a> to select matching years and build a citation list. Our <a href="../../archive-methodology.html">cataloging method</a> separates supplied labels from facts reviewed inside a PDF.</p>
        <p>Third-party brochure indexing informed this collection. Original document authors retain their rights; an archived copy is not a manufacturer endorsement or a redistribution license. Corrections and attribution requests can be made through the <a href="../../contact.html">contact page</a>.</p>
      </section>
    </main>${footer("../../")}`;
}

export async function buildResearchPages(library, verified, h) {
  const { brands, siteUrl, esc, header, footer, write, pageShell, brandUrl, modelUrl, brochureModel, brochureYear, isSpecificModel, publicPdfUrl, jsonLd } = h;
  const records = brands.flatMap(brand => (library[h.slug(brand.name)] || []).map(entry => {
    const model = brochureModel(entry, brand);
    const checked = verified.find(v => v.brand === h.slug(brand.name) && v.file === entry.file);
    return { brand: brand.name, model, title: entry.title, year: brochureYear(entry), size: entry.size, file: entry.file,
      pageUrl: isSpecificModel(model, brand) ? modelUrl(brand, model) : brandUrl(brand), pdfUrl: publicPdfUrl(brand, entry),
      verified: checked ? { pageCount: checked.pageCount, bytes: checked.bytes, checkedOn: checked.checkedOn } : null };
  }));
  const options = brands.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join("");
  const years = [...new Set(records.map(r => r.year).filter(y => y !== "Other"))].sort((a,b)=>b.localeCompare(a));
  const row = r => `<tr><td><input type="checkbox" aria-label="Select ${esc(r.title)}" value="${esc(r.pdfUrl)}" /></td><th scope="row"><a href="${r.pageUrl}">${esc(r.title)}</a></th><td>${esc(r.brand)}</td><td>${esc(r.year === "Other" ? "Unspecified" : r.year)}</td><td>${esc(r.size)}</td><td><a href="${esc(r.pdfUrl)}" target="_blank" rel="noopener">View PDF</a></td></tr>`;
  const finderBody = `${header("")}
    <main class="research-main">
      <section class="brand-page-head"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="./">Home</a><span>/</span><span>Brochure Finder</span></nav><h1>Brochure Finder</h1><p>${records.length.toLocaleString("en")} catalog records. Find the document that matches your model and year.</p></section>
      <section class="directory-section">
        <form id="finder-filters" class="finder-filters" role="search">
          <label>Search<input id="finder-query" type="search" placeholder="CR-V, M6, full line..." /></label>
          <label>Brand<select id="finder-brand"><option value="">All brands</option>${options}</select></label>
          <label>Model / range<select id="finder-model"><option value="">All models</option></select></label>
          <label>Year<select id="finder-year"><option value="">All years</option>${years.map(y=>`<option>${y}</option>`).join("")}<option value="Other">Unspecified</option></select></label>
        </form>
        <p id="finder-count" role="status" aria-live="polite">${records.length} records</p>
        <div class="report-table-wrap"><table class="report-table finder-table"><caption>Brochure search results</caption><thead><tr><th scope="col">Select</th><th scope="col">Document</th><th scope="col">Brand</th><th scope="col">Year</th><th scope="col">Catalog size</th><th scope="col">PDF</th></tr></thead><tbody id="finder-results">${records.slice(0,40).map(row).join("")}</tbody></table></div>
        <p id="finder-empty" hidden>No matching record. Try a wider model name or another year.</p>
        <button id="finder-more" type="button" class="research-button">Show more records</button>
        <noscript><p>Browse the <a href="./#brands">brand directory</a> for the complete collection.</p></noscript>
      </section>
      <section class="directory-section" aria-labelledby="comparison-heading">
        <h2 id="comparison-heading">Selected documents</h2>
        <p id="selection-status" role="status">No documents selected</p>
        <div id="finder-selection"></div>
        <div class="research-actions"><button id="finder-export" class="research-button" type="button" disabled>Download citation list</button><button id="finder-clear" class="research-button" type="button" disabled>Clear selection</button></div>
      </section>
      <section class="directory-section"><h2>Read the record before comparing vehicles</h2><p>Catalog size is the supplied listing value, and may differ from the compressed PDF served today. Page counts and current byte sizes appear only for individually reviewed files. A model label groups records for navigation; it does not establish a vehicle generation, market, or trim specification.</p><p><a href="research/honda-crv-2016-vs-2018/">Read our worked CR-V brochure comparison</a> for an example with PDF page references. <a href="archive-methodology.html">Source and cataloging method</a>.</p></section>
    </main>${footer("")}
    <script type="application/json" id="finder-data">${JSON.stringify(records).replaceAll("<", "\\u003c")}</script><script src="brochure-finder.js" defer></script>`;
  await write("brochure-finder.html", pageShell({title:"Brochure Finder by Brand, Model and Year | Car Brochure Archive",description:"Search automotive brochure records by make, model and year, compare document editions, and export a citation list for research.",canonical:`${siteUrl}/brochure-finder.html`,cssPath:"styles.css",body:finderBody,schema:jsonLd({"@context":"https://schema.org","@type":"WebPage",name:"Brochure Finder",url:`${siteUrl}/brochure-finder.html`}),ads:false}));

  const pdf16 = verified.find(v=>v.file.endsWith("CR-V_2016.pdf"));
  const pdf18 = verified.find(v=>v.file.endsWith("CR-V_2018.pdf"));
  if (!pdf16 || !pdf18) throw new Error("Reviewed CR-V PDFs are required for the research article.");
  const sourceLink = (pdf, page) => `<a href="${esc(pdf.url)}#page=${page}" target="_blank" rel="noopener">${pdf.title.slice(0,4)} brochure, PDF page ${page}</a>`;
  const comparisonRows = [
    ["Trim lineup", "LX, SE, EX, EX-L, Touring", "LX, EX, EX-L, Touring"],
    ["LX engine rating", "2.4-liter, 185 hp", "2.4-liter, 184 hp"],
    ["EX engine", "2.4-liter, 185 hp", "1.5-liter turbo, 190 hp"],
    ["CVT", "Listed under LX; higher trims add to that base", "Listed under LX; higher trims add to that base"],
    ["Driver-assistance location", "CMBS, LDW, LKAS and ACC listed in Touring additions", "Honda Sensing listed in EX additions"],
    ["PDF file pages", String(pdf16.pageCount), String(pdf18.pageCount)]
  ];
  const articleBody = `${header("../../")}<main class="research-main">
    <section class="brand-page-head"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="../../">Home</a><span>/</span><a href="../../research-guide.html">Research Guide</a><span>/</span><span>Honda CR-V</span></nav><h1>2016 vs 2018 Honda CR-V: What the Brochures Actually Show</h1><p>A comparison of two U.S. sales brochures, with exact PDF page references. Reviewed October 13, 2026.</p></section>
    <article class="directory-section research-article">
      <p>The badge on the tailgate is an incomplete description of a used CR-V. Two vehicles advertised as EX can have different engines and driver-assistance equipment depending on the model year. Reading the equipment ladders in these two brochures resolves that ambiguity before a buyer relies on a short listing description.</p>
      <h2>The documents and comparison method</h2>
      <p>We visually reviewed the archived U.S. 2016 and 2018 Honda CR-V brochures. The files contain ${pdf16.pageCount} and ${pdf18.pageCount} PDF pages respectively. Both files are image-based: text search alone will not locate the equipment table. In this article, page numbers refer to the PDF viewer's page counter, including the cover, rather than printed page numbers.</p>
      <p>The table below uses the trim panels on ${sourceLink(pdf16,10)} and ${sourceLink(pdf18,10)}. It compares what each document states. It does not test the vehicle, verify the condition of a used example, or describe every market.</p>
      <div class="report-table-wrap"><table class="report-table"><caption>Selected brochure differences</caption><thead><tr><th scope="col">Item</th><th scope="col">2016 U.S. brochure</th><th scope="col">2018 U.S. brochure</th></tr></thead><tbody>${comparisonRows.map(r=>`<tr><th scope="row">${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table></div>
      <h2>The engine difference depends on trim</h2>
      <p>The 2016 panel begins with the LX's 2.4-liter engine and then presents each higher trim as additions or replacements. The 2018 panel separates the LX's 184-hp engine from the EX's 190-hp turbo engine. The useful research result is not simply that a newer year has more power: the engine distinction applies to a specific trim step. A 2018 LX and a 2018 EX should not be treated as interchangeable in an engine comparison.</p>
      <h2>Follow the equipment ladder</h2>
      <p>In the 2016 document the SE sits between LX and EX; the 2018 ladder moves directly from LX to EX. The Honda Sensing suite appears in the 2018 EX additions, while the named braking, lane-warning, lane-keeping and cruise features appear in the 2016 Touring additions. That changes which panel a reader needs to inspect when checking an advertised feature.</p>
      <p>Reading only the marketing spread is insufficient. ${sourceLink(pdf18,8)} explains assistance functions, but page 10 identifies the trim step. The practical sequence is to find the feature description, then locate its availability in the trim ladder, then read the footnote. A photograph of a high-specification vehicle does not establish standard equipment on the entry trim.</p>
      <h2>Colors and upholstery need a separate check</h2>
      <p>The two page-10 spreads also contain color and interior panels. Treat those as another comparison layer instead of using the body-color photograph to identify a trim. Record the color name, interior material, and any trim restriction together. The 2016 document includes trim-combination tables, whereas the 2018 spread groups its interior swatches by trim family. A listing that says only "leather" omits the year-specific context needed to verify it.</p>
      <h2>A repeatable used-car research checklist</h2>
      <ol><li>Match model year, country and exact trim before comparing an engine rating.</li><li>Read the entry-trim panel and the additions for the advertised trim together.</li><li>Record the page for each equipment claim and keep footnotes with the claim.</li><li>Confirm installed equipment with the vehicle's records and inspection; the brochure describes an offering, not an individual car.</li></ol>
      <p>For another year or an alternate edition, open the <a href="../../models/honda/honda-cr-v/">CR-V collection</a> or <a href="../../brochure-finder.html?brand=Honda&q=CR-V">find CR-V documents</a>. Current recalls and safety status require current official sources; these period brochures are not a current safety assessment.</p>
      <h2>Sources and limitations</h2>
      <ul><li>${sourceLink(pdf16,10)}; ${pdf16.pageCount} PDF pages; ${(pdf16.bytes/1024/1024).toFixed(2)} MiB archived file.</li><li>${sourceLink(pdf18,10)}; ${pdf18.pageCount} PDF pages; ${(pdf18.bytes/1024/1024).toFixed(2)} MiB archived file.</li><li><a href="https://www.auto-brochures.com/honda.html" target="_blank" rel="noopener">Auto-Brochures Honda index</a>, the source collection used by the archive importer.</li></ul>
      <p>Brochures are third-party manufacturer literature. This article's comparison and reading method are independent editorial work. File hashes and review dates are recorded in the <a href="../../data/verified-brochures.json">document verification record</a>. We have not inferred fuel economy, production dates, an individual vehicle's equipment, or licensing rights from the catalog labels.</p>
    </article></main>${footer("../../")}`;
  await write("research/honda-crv-2016-vs-2018/index.html", pageShell({title:"2016 vs 2018 Honda CR-V Brochure Comparison: Engines and Trims",description:"A source-backed comparison of U.S. 2016 and 2018 CR-V brochures, covering trim ladders, engine ratings and driver-assistance availability with PDF page references.",canonical:`${siteUrl}/research/honda-crv-2016-vs-2018/`,cssPath:"../../styles.css",body:articleBody,schema:jsonLd({"@context":"https://schema.org","@type":"Article",headline:"2016 vs 2018 Honda CR-V: What the Brochures Actually Show",datePublished:"2026-10-13",dateModified:"2026-10-13",author:{"@type":"Organization",name:"Car Brochure Archive",url:`${siteUrl}/about.html`},mainEntityOfPage:`${siteUrl}/research/honda-crv-2016-vs-2018/`,citation:[pdf16.url,pdf18.url]}),ads:true}));
}
