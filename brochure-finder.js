(() => {
  const data = document.getElementById("finder-data");
  if (!data) return;
  const records = JSON.parse(data.textContent);
  const query = document.getElementById("finder-query");
  const brand = document.getElementById("finder-brand");
  const model = document.getElementById("finder-model");
  const year = document.getElementById("finder-year");
  const results = document.getElementById("finder-results");
  const selected = new Map();
  const more = document.getElementById("finder-more");
  const download = document.getElementById("finder-export");
  const clear = document.getElementById("finder-clear");
  let limit = 40;
  let matches = [];

  function element(tag, text, attributes = {}) {
    const node = document.createElement(tag);
    if (text !== null) node.textContent = text;
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  function modelOptions() {
    const previous = model.value;
    model.replaceChildren(element("option", "All models", { value: "" }));
    const names = [...new Set(records.filter(r => !brand.value || r.brand === brand.value).map(r => r.model))].sort();
    names.forEach(name => model.append(element("option", name, { value: name })));
    if (names.includes(previous)) model.value = previous;
  }

  function updateSelection() {
    document.getElementById("selection-status").textContent = selected.size ? `${selected.size} of 3 documents selected` : "No documents selected";
    const list = document.getElementById("finder-selection");
    list.replaceChildren();
    for (const r of selected.values()) {
      const item = element("article", null, { class: "selected-document" });
      item.append(element("h3", r.title), element("p", `${r.model} / ${r.year === "Other" ? "Unspecified year" : r.year} / ${r.size} catalog size`));
      item.append(element("p", r.verified ? `${r.verified.pageCount} PDF pages; ${(r.verified.bytes / 1024 / 1024).toFixed(2)} MiB archived file; reviewed ${r.verified.checkedOn}.` : "PDF page count and current file size have not been individually recorded."));
      item.append(element("a", "View PDF", { href: r.pdfUrl, target: "_blank", rel: "noopener" }));
      const remove = element("button", "Remove", { type: "button", class: "research-button", "aria-label": `Remove ${r.title}` });
      remove.addEventListener("click", () => { selected.delete(r.pdfUrl); render(); updateSelection(); });
      item.append(remove);
      list.append(item);
    }
    download.disabled = clear.disabled = !selected.size;
    for (const checkbox of results.querySelectorAll("input")) checkbox.disabled = selected.size >= 3 && !checkbox.checked;
  }

  function render() {
    const tokens = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    matches = records.filter(r => (!brand.value || r.brand === brand.value) && (!model.value || r.model === model.value) && (!year.value || r.year === year.value) && tokens.every(t => `${r.brand} ${r.model} ${r.title}`.toLowerCase().includes(t)));
    results.replaceChildren();
    for (const r of matches.slice(0, limit)) {
      const row = element("tr", null);
      const cell = element("td", null);
      const checkbox = element("input", null, { type: "checkbox", value: r.pdfUrl, "aria-label": `Select ${r.title}` });
      checkbox.checked = selected.has(r.pdfUrl);
      checkbox.disabled = selected.size >= 3 && !checkbox.checked;
      checkbox.addEventListener("change", () => { if (checkbox.checked && selected.size < 3) selected.set(r.pdfUrl, r); else selected.delete(r.pdfUrl); updateSelection(); });
      cell.append(checkbox);
      const title = element("th", null, { scope: "row" });
      title.append(element("a", r.title, { href: r.pageUrl }));
      const pdfCell = element("td", null);
      pdfCell.append(element("a", "View PDF", { href: r.pdfUrl, target: "_blank", rel: "noopener" }));
      row.append(cell, title, element("td", r.brand), element("td", r.year === "Other" ? "Unspecified" : r.year), element("td", r.size), pdfCell);
      results.append(row);
    }
    document.getElementById("finder-count").textContent = `${matches.length} matching records; showing ${Math.min(limit, matches.length)}`;
    document.getElementById("finder-empty").hidden = matches.length > 0;
    more.hidden = limit >= matches.length;
  }

  document.getElementById("finder-filters").addEventListener("submit", e => e.preventDefault());
  query.addEventListener("input", () => { limit = 40; render(); });
  brand.addEventListener("change", () => { modelOptions(); limit = 40; render(); });
  model.addEventListener("change", () => { limit = 40; render(); });
  year.addEventListener("change", () => { limit = 40; render(); });
  more.addEventListener("click", () => { limit += 40; render(); });
  clear.addEventListener("click", () => { selected.clear(); render(); updateSelection(); });
  download.addEventListener("click", () => {
    const lines = ["Car Brochure Archive - Research Citations", "Retrieved: " + new Date().toISOString().slice(0,10), ""];
    for (const r of selected.values()) lines.push(r.title, "Archive page: " + new URL(r.pageUrl, location.href).href, "PDF: " + r.pdfUrl, "Catalog file: " + r.file, "Catalog size: " + r.size, "Observed PDF page / claim: [add after reading the document]", "");
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const link = element("a", null, { href: url, download: "brochure-citations.txt" });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const params = new URLSearchParams(location.search);
  query.value = params.get("q") || "";
  brand.value = params.get("brand") || "";
  modelOptions();
  render();
})();
