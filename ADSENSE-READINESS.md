# AdSense Content and Deployment Review

Review date: October 13, 2026. Site: https://carbrochurearchive.com/

## Status

Technical improvements are implemented. This is not Google approval, and it does not establish that every policy issue has been resolved. Do not select the "all issues resolved" checkbox solely because local SEO checks pass.

The content release `249ff68c` was pushed to GitHub and deployed successfully on October 13, 2026. [Deployment run](https://github.com/lg-list/BrochureGarage/actions/runs/38371823260). Nine public-page checks passed; the finder and comparison return HTTP 200, the sample model/history pages are ad-free, and their canonical URLs match. Results are saved in `seo/live-readiness.json`.

## Evidence Behind the Repeated Rejection

1. **The previous local changes were not live.** Before this release, the public BMW M6 page still loaded AdSense and lacked the new record metadata. Its response reported a September 24 modification date. The methodology page returned HTTP 404. GitHub main was still commit `1bc035c6`.
2. **76 history pages used almost the same prose.** They replaced brand and model names but did not provide dated history or source-supported events. Previous word-count claims included navigation and repeated content. Word counts do not establish unique value; Google publishes no universal passing word-count threshold.
3. **The imported collection has no documented document licenses.** The repository now has 3,363 brochure records but no per-document authorizations. Download availability, attribution and a removal disclaimer do not establish redistribution permission.
4. **Catalog labels were presented as vehicle coverage.** Hard-coded current model names included models without matching documents. Listed sizes differ from compressed downloads. The two reviewed CR-V PDFs contain no searchable text; visual page review was necessary.

## Changes Implemented

- A complete Brochure Finder filters by brand, actual catalog model and year, selects up to three documents, and exports citations.
- An original U.S. 2016/2018 CR-V comparison cites the inspected equipment tables and assistance descriptions. Hashes, actual sizes, page counts and review dates are recorded.
- 76 existing history URLs now show actual model groups, year coverage, early entries and same-year editions. They do not infer launches or discontinuations from gaps in the collection.
- The Acura article now links to primary historical sources, removes unverified China history, and distinguishes prototype unveiling from production sales.
- Model pages no longer repeat long generic paragraphs. Single-year coverage is stated explicitly; related models and citation links provide useful next actions.
- Brand introductions use actual catalog groups. Original brand/model/PDF paths remain intact.
- Advertising uses an explicit allowlist: research guide, model-year guide, glossary and reviewed CR-V comparison. Home, brand, model, source-directory, utility and policy pages are ad-free.
- Source attribution, licensing limits, privacy links and correction routes are visible. They do not replace missing permission evidence.
- Logos load as reusable local assets. Homepage HTML is substantially smaller. Broken XML and an incorrect Oldsmobile image were fixed at existing paths.
- Deployment builds and audits the generated site before publishing, so generator changes cannot be silently omitted.

## Validation

- Original baseline: 795 canonical URLs; all retained.
- Current sitemap: 798 canonical URLs, including three useful additions from the prior public baseline.
- Original catalog: 3,344 records and original R2 links preserved.
- Local link audit: zero broken internal links or orphan pages.
- Browser tests: filtering, combined model/year selection, three-document cap, clearing, citation export, no-result state and pagination.
- Five views checked at desktop and mobile widths; no missing images or horizontal page overflow.
- Remote file sample scope is recorded in `seo/pdf-sample-check.json`; sample success does not prove every file was checked.
- `seo/live-readiness.json` must pass after deployment before a release is called live.

## Remaining Owner Evidence

- Confirm the actual operator/public author identity and that the listed contact mailbox receives messages.
- Supply PDF licensing or authorization evidence, or decide on rights-reviewed hosting with source/manufacturer links where permission is uncertain. Files and URLs have not been removed automatically.
- Continue individually reviewed research for collections that attract real users. One study and one useful tool do not guarantee Google's whole-site editorial assessment.
- Check the real AdSense account's consent settings for the audiences served before approved advertising begins.

## Resubmission

Deploy and verify the public versions first. Resolve rights/operator questions and inspect five representative URLs in Search Console. Submit once when the issues are actually addressed. Repeatedly resubmitting an unchanged site or waiting an arbitrary number of days does not establish compliance.

Official criteria: [AdSense content and user experience](https://support.google.com/adsense/answer/10015918), [Google Publisher Policies](https://support.google.com/adsense/answer/10502938).

## Commands

```powershell
node scripts/generate-site.mjs
node scripts/generate-sitemaps.mjs
node scripts/seo-audit.mjs
node scripts/full-seo-audit.mjs
node scripts/adsense-audit.mjs
node scripts/check-live-readiness.mjs --pdf-samples
node scripts/check-live-readiness.mjs
```

The first five commands build and audit locally. The last two read public resources and write scoped evidence reports. Technical success is not an AdSense approval prediction.
