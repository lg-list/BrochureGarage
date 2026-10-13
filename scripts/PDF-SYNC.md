# Incremental PDF Sync

This task compares the 77 existing brand catalogs with Auto-Brochures and Cloudflare R2. It does not replace existing PDFs, remove catalog records, change existing model URLs, or alter CSS/image paths. Run this script instead of the legacy replacement-based importer.

## Install

```powershell
python -m pip install --target .tools/python -r scripts/pdf-sync-requirements.txt
python scripts/test-pdf-sync.py
```

Provide `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` through the environment or an ignored `.tools/r2-sync-credentials.json` file with `accessKeyId` and `secretAccessKey` fields. Never commit credentials. The account endpoint, bucket and public URL are configured in the script; credentials are not.

## Audit And Apply

```powershell
python scripts/sync-auto-brochures.py
python scripts/sync-auto-brochures.py --apply --workers 2
```

Default coverage retains the owner's earlier policy: 2016 and newer, Honda 2013 and newer, and all years for brands whose existing collection is vintage-only. Every existing record is preserved regardless of its year. To explicitly include all source years, run an audit with `--scope all`, review estimated storage, then apply with the same option.

The audit writes `seo/pdf-sync-plan.json`. Source HTML and R2 inventories are cached in ignored `.tools/` files. `--refresh` rescans the source and bucket; the source HTML cache expires after 30 minutes.

Files are streamed to ignored `pdfs/`, checked for a PDF header and readable nonempty page tree, conditionally created in R2 with `If-None-Match: *`, checked for matching object length, and tested through the public URL before adding a catalog record. Existing compressed objects are never overwritten. New sizes come from actual stored bytes, not the source page's sometimes inaccurate labels.

Files over 64 MiB use 16 MiB multipart chunks and three upload workers to a unique temporary object. The final object is copied with R2's `cf-copy-destination-if-none-match: *` protection. The script deletes only its own temporary object and aborts its own incomplete multipart session on failure. No existing object is deleted.

`data/pdf-source-overrides.json` records manually investigated source-link typos. Corrections retain original source hrefs and resolved download URLs in `data/pdf-source-records.json`. Automatic Apache Multiple Choices recovery accepts only an unambiguous equivalent filename with the intended year/model. It never substitutes a different model year to make a failed download look successful.

## Results And Resume

`seo/pdf-sync-results.json` records uploaded files, actual bytes, SHA-256, page counts, public URLs and failures. Re-running a saved plan checks existing objects and retries failures without replacing uploaded objects. Failed HTML/404 responses are never uploaded or added to the public catalog. A nonzero exit means some candidates could not be sourced; successful imports remain valid.

`seo/pdf-sync-report.md` is the human-readable upload and unavailable-source list. Use `--only-brand toyota` to retry one brand after investigating corrections; failures for other brands remain in the report.

After checking the results and any corrected PDF covers:

```powershell
node scripts/generate-site.mjs
node scripts/generate-sitemaps.mjs
node scripts/seo-audit.mjs
node scripts/adsense-audit.mjs
node scripts/full-seo-audit.mjs
```

The advertising audit permits append-only additions, but checks that every original catalog record and every original URL is unchanged. It does not certify copyright permissions or AdSense approval. PDFs and credentials stay out of Git and GitHub Pages; only successful catalog additions and generated HTML are published.
