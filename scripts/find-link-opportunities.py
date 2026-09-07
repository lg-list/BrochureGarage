import csv
from pathlib import Path

fields = ["domain", "url", "topic", "related_brand", "related_model", "target_page", "opportunity_type", "priority", "status"]
output = Path("seo/link-opportunities.csv")
output.parent.mkdir(exist_ok=True)
with output.open("w", encoding="utf-8-sig", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=fields)
    writer.writeheader()
print(f"Created {output}. Add only manually vetted automotive communities, clubs, blogs, and resource pages.")
