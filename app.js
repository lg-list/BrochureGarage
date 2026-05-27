const searchInput = document.querySelector("#site-search");
const brandItems = [...document.querySelectorAll(".brand-item")];
const emptyState = document.querySelector(".empty-state");

function normalize(value) {
  return value.trim().toLowerCase();
}

function matchesQuery(haystack, query) {
  if (!query) return true;
  return query.split(/\s+/).every((token) => haystack.includes(token));
}

function filterDirectory() {
  const query = normalize(searchInput.value);
  let visibleBrands = 0;

  brandItems.forEach((item) => {
    const haystack = normalize(item.dataset.brand || item.textContent);
    const isVisible = matchesQuery(haystack, query);
    item.hidden = !isVisible;
    if (isVisible) visibleBrands += 1;
  });

  if (emptyState) emptyState.hidden = visibleBrands > 0;
}

if (searchInput) {
  searchInput.addEventListener("input", filterDirectory);

  const initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery) {
    searchInput.value = initialQuery;
    filterDirectory();
  }
}
