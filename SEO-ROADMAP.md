# SEO Roadmap

## Week 1
- Submit and monitor the existing `sitemap.xml` in Search Console; keep the canonical host as `https://carbrochurearchive.com/`.
- Review the Page Indexing report for valid pages, redirects, duplicate canonical signals, and discovered-not-indexed URLs.
- Export the last 28 days of Queries and Pages data before changing titles.

## Week 2
- Run `node scripts/full-seo-audit.mjs` and resolve any new broken links or orphan pages.
- Use `python scripts/analyze_gsc.py --input queries.csv` to identify high-impression pages with positions 4-15, 8-30, and low CTR.
- Improve only pages supported by real Search Console demand and existing brochure data.

## Week 3
- Strengthen the highest-value brand and model hubs with links to adjacent years, related models, research guides, and archive evidence.
- Add brochure landing pages only where the PDF has reliable metadata and a corresponding existing model record.
- Validate mobile rendering and Core Web Vitals in Search Console/PageSpeed Insights.

## Week 4
- Refresh the best-performing pages using actual PDF metadata and documented sources.
- Review internal-link coverage and the GSC opportunity report; do not publish bulk pages from keyword guesses.
- Track impressions, clicks, CTR, Top 10 keywords, indexed valuable pages, and internal-link coverage week over week.

## Guardrails
Existing URLs, PDF paths, image paths, CSS structure, and indexed pages are protected. No purchased links, doorway pages, hidden text, copied bulk content, or fabricated statistics are part of this roadmap.
