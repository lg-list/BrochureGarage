# Search Console Opportunity Report

No Search Console CSV has been analyzed yet. Export the Queries and Pages reports from Search Console, then run:

```bash
python scripts/analyze_gsc.py --input queries.csv
```

The script writes `seo/gsc-opportunities.json` and this report. It does not invent volume, clicks, rankings, or CTR.
