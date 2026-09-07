import argparse
import csv
import json
from pathlib import Path


def number(value):
    return float(str(value).replace(",", "").replace("%", "").strip() or 0)


def field(row, names):
    lowered = {str(key).strip().lower(): value for key, value in row.items()}
    for name in names:
        if name.lower() in lowered:
            return lowered[name.lower()]
    return ""


parser = argparse.ArgumentParser(description="Analyze a real Google Search Console CSV export.")
parser.add_argument("--input", required=True, help="Queries or Pages CSV exported from Search Console")
args = parser.parse_args()
source = Path(args.input)
rows = []
with source.open("r", encoding="utf-8-sig", newline="") as handle:
    for row in csv.DictReader(handle):
        query = field(row, ["query", "top queries"])
        page = field(row, ["page", "top pages"])
        clicks = number(field(row, ["clicks"]))
        impressions = number(field(row, ["impressions"]))
        ctr = number(field(row, ["ctr", "click through rate"]))
        position = number(field(row, ["position", "average position"]))
        rows.append({"query": query, "page": page, "clicks": clicks, "impressions": impressions, "ctr": ctr, "position": position})

def opportunity(kind, row, reason):
    return {"class": kind, "reason": reason, **row}

opportunities = []
for row in rows:
    if 4 <= row["position"] <= 15 and row["impressions"] >= 20:
        opportunities.append(opportunity("A", row, "Position 4-15 with meaningful impressions; improve the existing page and internal links."))
    elif 8 <= row["position"] <= 30 and row["impressions"] >= 50:
        opportunities.append(opportunity("B", row, "Position 8-30 with meaningful impressions; improve intent match and supporting links."))
    elif row["impressions"] >= 50 and row["ctr"] <= 1:
        opportunities.append(opportunity("C", row, "High impressions with CTR at or below 1%; review title and description against the actual page."))
    elif row["clicks"] > 0 and row["query"]:
        opportunities.append(opportunity("D", row, "Existing clicks indicate a real demand signal; check related model/year coverage."))

opportunities.sort(key=lambda item: (-item["impressions"], item["position"]))
out = {"generated_at": "repository run", "source_file": str(source), "opportunities": opportunities}
Path("seo").mkdir(exist_ok=True)
Path("seo/gsc-opportunities.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
Path("seo/gsc-report.md").write_text("# Search Console Opportunity Report\n\n" + f"Analyzed {len(rows)} rows from `{source}` and found {len(opportunities)} opportunities.\n\n" + "| Class | Query | Page | Clicks | Impressions | CTR | Position |\n|---|---|---|---:|---:|---:|---:|\n" + "\n".join(f"| {x['class']} | {x['query']} | {x['page']} | {x['clicks']:g} | {x['impressions']:g} | {x['ctr']:g} | {x['position']:g} |" for x in opportunities), encoding="utf-8")
print(f"Analyzed {len(rows)} rows; wrote {len(opportunities)} opportunities.")
