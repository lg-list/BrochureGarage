"""Incremental, resumable source-to-R2 sync. Audit is the default; never replace PDFs."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import time
import unicodedata
import uuid
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".tools/python"))

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from bs4 import BeautifulSoup, NavigableString, Tag
from pypdf import PdfReader
import requests

SOURCE = "https://www.auto-brochures.com/"
PUBLIC = "https://pub-b4d0d3d7cb284abc8a79724880c09cb7.r2.dev"
ENDPOINT = "https://8cfb822ea72ec7f373324c77e8b26b60.r2.cloudflarestorage.com"
BUCKET = "car-xcpdf"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; archive-maintenance)"}


def read_json(path, default=None):
    return json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else default


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def clean(value):
    return re.sub(r"\s+", " ", str(value)).strip()


def slug(value):
    value = re.sub(r"/Range Rover", "", value, flags=re.I)
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def secure_source_url(value, page):
    parts = urlsplit(urljoin(page, value))
    if parts.hostname not in {"www.auto-brochures.com", "auto-brochures.com"}:
        raise ValueError("Unexpected source host")
    source_path = unquote(parts.path)
    # One source BMW href has pasted prose before its otherwise complete makes/ path.
    if not source_path.startswith("/makes/") and " makes/" in source_path:
        source_path = "/makes/" + source_path.split(" makes/", 1)[1]
    return urlunsplit(("https", "www.auto-brochures.com", quote(source_path, safe="/"), parts.query, ""))


def safe_file(url):
    parts = [p for p in unquote(urlsplit(url).path).split("/") if p]
    if len(parts) < 3 or parts[0].lower() != "makes":
        raise ValueError("Unexpected source file path")
    # Match the existing importer's filenames, without allowing path traversal.
    value = "/".join(parts[2:])
    value = re.sub(r'[\\:*?"<>|]', "-", value)
    value = re.sub(r"\s+", " ", value)
    if any(p in {".", "..", ""} for p in value.split("/")):
        raise ValueError("Unsafe file path")
    return value


def year_of(entry):
    found = re.search(r"\b(?:19|20)\d{2}\b", entry["title"] + " " + entry["file"])
    return int(found[0]) if found else 0


def approximate_bytes(size):
    found = re.search(r"([\d.]+)\s*(KB|MB|GB)", size, flags=re.I)
    return int(float(found[1]) * {"KB": 1024, "MB": 1024**2, "GB": 1024**3}[found[2].upper()]) if found else 0


def fetch_page(url):
    cached = ROOT / ".tools/source-pages" / (hashlib.sha256(url.encode()).hexdigest() + ".html")
    if cached.exists() and time.time() - cached.stat().st_mtime < 1800:
        return BeautifulSoup(cached.read_bytes(), "html.parser")
    for attempt in range(3):
        try:
            response = requests.get(url, headers=HEADERS, timeout=(20, 90))
            response.raise_for_status()
            cached.parent.mkdir(parents=True, exist_ok=True)
            cached.write_bytes(response.content)
            return BeautifulSoup(response.content, "html.parser")
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(2**attempt)


def brand_sources(soup, catalog):
    sources = {}
    for anchor in soup.find_all("a", href=True):
        name = clean(anchor.get_text(" ", strip=True))
        key = slug(name)
        if key not in catalog or not catalog[key] or not anchor["href"].endswith(".html"):
            continue
        sources[key] = {"brand": key, "name": name, "page": secure_source_url(anchor["href"], SOURCE)}
    return list(sources.values())


def parse_entries(soup, source):
    rows, errors = {}, []
    for anchor in soup.find_all("a", href=True):
        if not urlsplit(anchor["href"]).path.lower().endswith(".pdf"):
            continue
        heading = anchor.find_previous("h3")
        section = clean(heading.get_text(" ", strip=True)) if heading else source["name"]
        fragments = []
        for sibling in anchor.previous_siblings:
            if isinstance(sibling, Tag) and sibling.name in {"br", "h3", "a"}:
                break
            fragments.append(str(sibling) if isinstance(sibling, NavigableString) else sibling.get_text(" ", strip=True))
        title = clean(" ".join(reversed(fragments)))
        title = re.sub(r"^br>\s*", "", title, flags=re.I)
        size = clean(anchor.get_text(" ", strip=True)).strip("() ").replace(",", ".")
        try:
            source_url = secure_source_url(anchor["href"], source["page"])
            file = safe_file(source_url)
            if not title or not re.fullmatch(r"[\d.]+\s*(?:KB|MB|GB)?", size, re.I):
                raise ValueError("Missing brochure title or file size")
            entry = {"brand": source["brand"], "title": title, "size": size, "file": file,
                     "section": section, "sourceUrl": source_url, "sourcePage": source["page"],
                     "sourceHref": anchor["href"]}
            rows.setdefault(file, entry)
        except ValueError as error:
            errors.append({"href": anchor["href"], "error": str(error)})
    return list(rows.values()), errors


def make_client():
    local = read_json(ROOT / ".tools/r2-sync-credentials.json", {})
    key = os.getenv("R2_ACCESS_KEY_ID") or local.get("accessKeyId")
    secret = os.getenv("R2_SECRET_ACCESS_KEY") or local.get("secretAccessKey")
    if not key or not secret:
        raise RuntimeError("Provide R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY; do not put credentials in tracked files")
    client = boto3.client("s3", endpoint_url=ENDPOINT, aws_access_key_id=key, aws_secret_access_key=secret,
                        region_name="auto", config=Config(signature_version="s3v4", connect_timeout=20,
                        read_timeout=120, retries={"max_attempts": 4, "mode": "standard"},
                        s3={"addressing_style": "path"}, request_checksum_calculation="when_required",
                        response_checksum_validation="when_required"))
    def conditional_copy(request, **kwargs):
        request.headers["cf-copy-destination-if-none-match"] = "*"
    client.meta.events.register("before-sign.s3.CopyObject", conditional_copy)
    return client


def inventory(client):
    result = {}
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=BUCKET, Prefix="pdfs/"):
        for item in page.get("Contents", []):
            result[item["Key"]] = {"bytes": item["Size"], "etag": item["ETag"]}
    return result


def audit(client, scope):
    catalog = read_json(ROOT / "data/brochures.json")
    overrides = read_json(ROOT / "data/pdf-source-overrides.json", {}).get("files", {})
    objects = inventory(client)
    print(f"R2 inventory: {len(objects)} objects, {sum(o['bytes'] for o in objects.values()) / 1024**3:.2f} GiB", flush=True)
    save_json(ROOT / ".tools/r2-inventory.json", objects)
    sources = brand_sources(fetch_page(SOURCE), catalog)
    if len(sources) != sum(bool(entries) for entries in catalog.values()):
        raise RuntimeError("Source brand count does not match the current catalog; review before uploading")
    all_entries, summaries, parse_errors = [], [], []
    with ThreadPoolExecutor(max_workers=3) as pool:
        pending = {pool.submit(fetch_page, source["page"]): source for source in sources}
        for future in as_completed(pending):
            source = pending[future]
            entries, errors = parse_entries(future.result(), source)
            if not entries:
                raise RuntimeError(f"No PDFs parsed for {source['brand']}")
            all_entries.extend(entries)
            parse_errors.extend({"brand": source["brand"], **error} for error in errors)
            summaries.append({"brand": source["brand"], "sourceRecords": len(entries), "parserErrors": len(errors)})
            print(f"Source {len(summaries)}/{len(sources)}: {source['brand']} {len(entries)} PDFs", flush=True)
    candidates, excluded, catalog_missing = [], [], []
    for entry in all_entries:
        brand = entry["brand"]
        existing = {e["file"]: e for e in catalog[brand]}
        original_file = entry["file"]
        override = overrides.get(f"{brand}/{original_file}")
        if override:
            entry["resolvedSourceUrl"] = secure_source_url(override["url"], entry["sourcePage"])
            entry["correctionReason"] = override["reason"]
            if original_file not in existing:
                entry["file"] = safe_file(entry["resolvedSourceUrl"])
                if override.get("title"):
                    entry["title"] = override["title"]
        # Vintage-only brand archives keep their existing historical scope.
        cutoff = 0 if scope == "all" or not any(year_of(e) >= 2016 for e in catalog[brand]) else (2013 if brand == "honda" else 2016)
        key = f"pdfs/{brand}/{entry['file']}"
        entry["key"] = key
        entry["inCatalog"] = entry["file"] in existing
        entry["inR2"] = key in objects and objects[key]["bytes"] > 1024
        if entry["inCatalog"]:
            # Never retitle or regroup an existing page when the source heading changes.
            entry.update(existing[entry["file"]])
        if year_of(entry) < cutoff and not entry["inCatalog"]:
            excluded.append(entry)
        elif not entry["inCatalog"] or not entry["inR2"]:
            candidates.append(entry)
    source_keys = {e["key"] for e in all_entries}
    for brand, entries in catalog.items():
        for entry in entries:
            key = f"pdfs/{brand}/{entry['file']}"
            if key not in objects and key not in source_keys:
                catalog_missing.append({"brand": brand, "file": entry["file"], "reason": "Missing from R2 and current source listing"})
    candidates.sort(key=lambda e: (e["brand"], -year_of(e), e["file"]))
    save_json(ROOT / ".tools/pdf-source-inventory.json", all_entries)
    plan = {"checkedAt": datetime.now(timezone.utc).isoformat(), "scope": scope, "source": SOURCE,
            "sourceBrands": len(sources), "sourceRecords": len(all_entries), "currentRecords": sum(map(len, catalog.values())),
            "r2Objects": len(objects), "r2Bytes": sum(o["bytes"] for o in objects.values()),
            "newCatalogRecords": sum(not e["inCatalog"] for e in candidates),
            "missingR2Files": sum(not e["inR2"] for e in candidates),
            "estimatedDownloadBytes": sum(approximate_bytes(e["size"]) for e in candidates if not e["inR2"]),
            "excludedOlderRecords": len(excluded), "parserErrors": parse_errors,
            "unresolvedCatalogFiles": catalog_missing, "brands": sorted(summaries, key=lambda s: s["brand"]), "candidates": candidates}
    save_json(ROOT / "seo/pdf-sync-plan.json", plan)
    print(json.dumps({k: v for k, v in plan.items() if k not in {"brands", "candidates"}}, ensure_ascii=True), flush=True)
    if parse_errors:
        raise RuntimeError("Parser errors require review before sync; plan was saved")
    return plan


def local_path(entry):
    folder = (ROOT / "pdfs").resolve()
    path = (folder / entry["brand"] / Path(*PurePosixPath(entry["file"]).parts)).resolve()
    if not path.is_relative_to(folder):
        raise ValueError("Destination escapes the PDF directory")
    return path


def pdf_info(path):
    with path.open("rb") as stream:
        if stream.read(5) != b"%PDF-":
            raise ValueError("Downloaded file is not a PDF")
        stream.seek(0)
        reader = PdfReader(stream, strict=False)
        if reader.is_encrypted or not len(reader.pages):
            raise ValueError("Encrypted or empty PDF")
        pages = len(reader.pages)
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return {"bytes": path.stat().st_size, "pages": pages, "sha256": digest.hexdigest()}


def equivalent_source_choice(entry, content, requested_url):
    soup = BeautifulSoup(content, "html.parser")
    if soup.title is None or "300 Multiple Choices" not in soup.title.get_text():
        return None
    expected_path = unquote(urlsplit(requested_url).path)
    title_year = re.search(r"\b(?:19|20)\d{2}\b", entry["title"])
    if title_year:
        expected_path = re.sub(r"(?<!\d)(?:19|20)\d{2}(?!\d)", title_year[0], expected_path)
    normalize = lambda value: re.sub(r"[ _-]", "", unquote(urlsplit(value).path).lower())
    candidates = set()
    for anchor in soup.find_all("a", href=True):
        try:
            url = secure_source_url(anchor["href"], requested_url)
            if urlsplit(url).path.endswith(".pdf") and normalize(url) == normalize(expected_path):
                candidates.add(url)
        except ValueError:
            pass
    return candidates.pop() if len(candidates) == 1 else None


def download(entry):
    path = local_path(entry)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return path, pdf_info(path)
    temp = path.with_suffix(path.suffix + ".part")
    url = entry.get("resolvedSourceUrl", entry["sourceUrl"])
    for attempt in range(3):
        try:
            with requests.get(url, headers=HEADERS, timeout=(20, 120), stream=True) as response:
                response.raise_for_status()
                chunks = response.iter_content(1024 * 1024)
                first = next(chunks, b"")
                if first[:5] != b"%PDF-":
                    alternative = equivalent_source_choice(entry, first, url)
                    if alternative and alternative != url:
                        url = alternative
                        entry["resolvedSourceUrl"] = url
                        continue
                    raise ValueError(f"Source returned {response.status_code} HTML instead of a PDF")
                with temp.open("wb") as stream:
                    stream.write(first)
                    for chunk in chunks:
                        stream.write(chunk)
            info = pdf_info(temp)
            temp.replace(path)
            return path, info
        except (requests.RequestException, ValueError):
            if attempt == 2:
                raise
            time.sleep(2**attempt)


def public_check(key, expected_bytes):
    url = f"{PUBLIC}/{quote(key, safe='/')}"
    for attempt in range(4):
        try:
            with requests.get(url, headers={**HEADERS, "Range": "bytes=0-1023"}, timeout=(20, 45), stream=True) as response:
                response.raise_for_status()
                first = next(response.iter_content(1024), b"")
                if first[:5] != b"%PDF-":
                    raise ValueError("Public URL did not return PDF bytes")
                total = response.headers.get("Content-Range", "").rsplit("/", 1)[-1]
                if total.isdigit() and int(total) != expected_bytes:
                    raise ValueError("Public object size differs from R2")
                return url
        except (requests.RequestException, ValueError):
            if attempt == 3:
                raise
            time.sleep(2**attempt)


def upload_new(client, key, path, info):
    metadata = {"ContentType": "application/pdf", "CacheControl": "public, max-age=86400",
                "ContentDisposition": "inline; filename*=UTF-8''" + quote(path.name, safe=""),
                "Metadata": {"sha256": info["sha256"], "source": "auto-brochures.com"}}
    if info["bytes"] <= 64 * 1024**2:
        with path.open("rb") as body:
            client.put_object(Bucket=BUCKET, Key=key, Body=body, ContentLength=info["bytes"],
                              IfNoneMatch="*", **metadata)
        return
    # R2's conditional destination copy protects the final key; upload parts use a private unique key.
    temp_key = f"_imports/{uuid.uuid4().hex}/{path.name}"
    upload_id = None
    completed = False
    try:
        upload_id = client.create_multipart_upload(Bucket=BUCKET, Key=temp_key, **metadata)["UploadId"]
        chunk_size = 16 * 1024**2
        count = (info["bytes"] + chunk_size - 1) // chunk_size
        def upload_part(number):
            with path.open("rb") as stream:
                stream.seek((number - 1) * chunk_size)
                body = stream.read(chunk_size)
            response = client.upload_part(Bucket=BUCKET, Key=temp_key, UploadId=upload_id,
                                          PartNumber=number, Body=body, ContentLength=len(body))
            print(f"Multipart {path.name}: part {number}/{count} uploaded", flush=True)
            return {"PartNumber": number, "ETag": response["ETag"]}
        with ThreadPoolExecutor(max_workers=3) as pool:
            parts = list(pool.map(upload_part, range(1, count + 1)))
        client.complete_multipart_upload(Bucket=BUCKET, Key=temp_key, UploadId=upload_id,
                                         MultipartUpload={"Parts": parts})
        completed = True
        temp_object = client.head_object(Bucket=BUCKET, Key=temp_key)
        if temp_object["ContentLength"] != info["bytes"]:
            raise ValueError("Multipart upload size mismatch")
        client.copy_object(Bucket=BUCKET, Key=key, CopySource={"Bucket": BUCKET, "Key": temp_key},
                           MetadataDirective="COPY")
    finally:
        if upload_id and not completed:
            client.abort_multipart_upload(Bucket=BUCKET, Key=temp_key, UploadId=upload_id)
        if completed:
            client.delete_object(Bucket=BUCKET, Key=temp_key)


def sync_one(client, entry):
    key = entry["key"]
    try:
        current = client.head_object(Bucket=BUCKET, Key=key)
        if current["ContentLength"] <= 1024:
            raise ValueError("Existing object is too small; refusing to overwrite it")
        result = {"key": key, "status": "existing", "bytes": current["ContentLength"]}
    except ClientError as error:
        if error.response["Error"]["Code"] not in {"404", "NoSuchKey", "NotFound"}:
            raise
        path, info = download(entry)
        try:
            upload_new(client, key, path, info)
            current = client.head_object(Bucket=BUCKET, Key=key)
            if current["ContentLength"] != info["bytes"]:
                raise ValueError("Uploaded object size mismatch")
            result = {"key": key, "status": "uploaded", **info}
        except ClientError as put_error:
            if put_error.response["Error"]["Code"] not in {"PreconditionFailed", "412"}:
                raise
            current = client.head_object(Bucket=BUCKET, Key=key)
            result = {"key": key, "status": "existing", "bytes": current["ContentLength"]}
    result["publicUrl"] = public_check(key, result["bytes"])
    result["checkedAt"] = datetime.now(timezone.utc).isoformat()
    return result


def apply_plan(client, plan, workers, only_brands=None):
    if plan["parserErrors"]:
        raise ValueError("Cannot apply a plan containing parser errors")
    catalog_path = ROOT / "data/brochures.json"
    catalog = read_json(catalog_path)
    backup = ROOT / ".tools/pdf-sync-catalog-before.json"
    if not backup.exists():
        save_json(backup, catalog)
    records = read_json(ROOT / "data/pdf-source-records.json", {})
    previous = read_json(ROOT / "seo/pdf-sync-results.json", {"results": []})
    results = {r["key"]: r for r in previous["results"] if r.get("status") != "failed"}
    active_keys = {e["key"] for e in plan["candidates"]}
    failures = {r["key"]:r for r in previous.get("failures", []) if r["key"] in active_keys}
    entries = [e for e in plan["candidates"] if not only_brands or e["brand"] in only_brands]
    report = {"checkedAt": datetime.now(timezone.utc).isoformat(), "bucket": BUCKET, "scope": plan["scope"],
              "planned": len(entries), "uploaded": sum(r["status"] == "uploaded" for r in results.values()),
              "uploadedBytes": sum(r["bytes"] for r in results.values() if r["status"] == "uploaded"),
              "currentCatalogRecords": sum(map(len, catalog.values())), "failures": list(failures.values()),
              "results": sorted(results.values(), key=lambda r: r["key"])}
    save_json(ROOT / "seo/pdf-sync-results.json", report)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        pending = {pool.submit(sync_one, client, entry): entry for entry in entries}
        for number, future in enumerate(as_completed(pending), 1):
            entry = pending[future]
            try:
                result = future.result()
                if result["status"] == "existing" and results.get(entry["key"], {}).get("status") == "uploaded":
                    result = {**results[entry["key"]], "publicUrl": result["publicUrl"], "checkedAt": result["checkedAt"]}
                results[entry["key"]] = result
                failures.pop(entry["key"], None)
                group = catalog[entry["brand"]]
                if not any(e["file"] == entry["file"] for e in group):
                    record = {k: entry[k] for k in ["title", "size", "file", "section"]}
                    record["size"] = f"{result['bytes'] / 1024**2:.1f} MB"
                    group.append(record)
                records[entry["key"]] = {"sourceUrl": entry["sourceUrl"], "sourcePage": entry["sourcePage"],
                                         "sourceHref": entry.get("sourceHref", entry["sourceUrl"]),
                                         "resolvedSourceUrl": entry.get("resolvedSourceUrl", entry["sourceUrl"]),
                                         "correctionReason": entry.get("correctionReason"),
                                         "sourceTitle": entry["title"], "sourceSize": entry["size"], **result}
                save_json(catalog_path, catalog)
                save_json(ROOT / "data/pdf-source-records.json", records)
                print(f"{number}/{len(entries)} {result['status']} {entry['key']} ({result['bytes']} bytes)", flush=True)
            except Exception as error:
                failure = {"key": entry["key"], "brand": entry["brand"], "title": entry["title"],
                           "sourceUrl": entry["sourceUrl"], "status": "failed", "error": str(error)}
                failures[entry["key"]] = failure
                print(f"{number}/{len(entries)} FAILED {entry['key']}: {type(error).__name__}: {error}", flush=True)
            report = {"checkedAt": datetime.now(timezone.utc).isoformat(), "bucket": BUCKET, "scope": plan["scope"],
                      "planned": len(entries), "uploaded": sum(r["status"] == "uploaded" for r in results.values()),
                      "uploadedBytes": sum(r["bytes"] for r in results.values() if r["status"] == "uploaded"),
                      "currentCatalogRecords": sum(map(len, catalog.values())), "failures": list(failures.values()),
                      "results": sorted(results.values(), key=lambda r: r["key"])}
            save_json(ROOT / "seo/pdf-sync-results.json", report)
    print(json.dumps({k: v for k, v in report.items() if k != "results"}, ensure_ascii=True), flush=True)
    write_summary(report, plan)
    if failures:
        sys.exit(1)


def write_summary(report, plan):
    before = read_json(ROOT / ".tools/pdf-sync-catalog-before.json", {})
    original_count = sum(map(len, before.values()))
    lines = ["# PDF Sync Report", "", f"Checked: {report['checkedAt']}", "",
             f"- Source: {SOURCE}", f"- Brands scanned: {plan['sourceBrands']}",
             f"- Distinct source PDFs: {plan['sourceRecords']}",
             "- Scope: 2016+, Honda 2013+, vintage-only brands all years." if plan["scope"] == "existing" else "- Scope: all source years.",
             f"- Original catalog records preserved: {original_count}",
             f"- Current catalog records: {report['currentCatalogRecords']}",
             f"- New PDF uploads verified through public R2 URLs: {report['uploaded']}",
             f"- New storage: {report['uploadedBytes'] / 1024**2:.1f} MiB",
             f"- Unavailable source candidates: {len(report['failures'])}",
             f"- Older records outside this scope: {plan['excludedOlderRecords']}", "",
             "Existing R2 objects were not replaced. No failed download was added to the public catalog.", "",
             "## Verified Uploads", "", "| Object | Pages | MiB |", "|---|---:|---:|"]
    lines += [f"| {r['key'].replace('|', '/')} | {r.get('pages', 'n/a')} | {r['bytes'] / 1024**2:.1f} |" for r in report["results"] if r["status"] == "uploaded"]
    lines += ["", "## Unavailable Source Links", "",
              "These source URLs returned HTML/404/Multiple Choices rather than the requested PDF. Different years were not substituted.", "",
              "| Title | Source | Result |", "|---|---|---|"]
    entries = {e["key"]: e for e in plan["candidates"]}
    for failure in report["failures"]:
        entry = entries.get(failure["key"], {})
        lines.append(f"| {entry.get('title', failure['key']).replace('|', '/')} | [source]({entry.get('sourceUrl', SOURCE)}) | {failure['error'].replace('|', '/')} |")
    (ROOT / "seo/pdf-sync-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=["existing", "all"], default="existing",
                        help="existing: 2016+, Honda 2013+, vintage-only brands all years; all: every source year")
    parser.add_argument("--apply", action="store_true", help="Upload and append records after a saved audit")
    parser.add_argument("--refresh", action="store_true", help="Rescan source pages and R2 before applying")
    parser.add_argument("--workers", type=int, choices=[1, 2, 3, 4], default=2)
    parser.add_argument("--only-brand", nargs="+", help="Retry selected brand slugs while retaining the other failures in the report")
    args = parser.parse_args()
    client = make_client()
    if args.apply and not args.refresh:
        plan = read_json(ROOT / "seo/pdf-sync-plan.json")
        if not plan or plan["scope"] != args.scope:
            raise ValueError("Run an audit for this scope first")
    else:
        plan = audit(client, args.scope)
    if args.apply:
        apply_plan(client, plan, args.workers, args.only_brand)


if __name__ == "__main__":
    main()
