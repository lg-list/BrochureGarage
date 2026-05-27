from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

import fitz


BRANDS = [
    "amc",
    "austin",
    "austin-healey",
    "bugatti",
    "citroen",
    "datsun",
    "delorean",
    "dodge",
    "ferrari",
    "fisker",
    "gmc",
    "gumpert",
    "hummer",
    "international",
    "isuzu",
    "jensen",
    "koenigsegg",
    "maybach",
    "mercury",
    "mg",
    "morgan",
    "oldsmobile",
    "opel",
    "pagani",
    "peugeot",
    "plymouth",
    "pontiac",
    "saab",
    "saturn",
    "spyker",
    "srt",
    "ssc",
    "studebaker",
    "suzuki",
    "vencer",
]


def iter_pdfs(root: Path, min_size_mb: float) -> list[Path]:
    files: list[Path] = []
    min_size = int(min_size_mb * 1024 * 1024)
    for brand in BRANDS:
        folder = root / "pdfs" / brand
        if folder.exists():
            files.extend(path for path in sorted(folder.rglob("*.pdf")) if path.stat().st_size >= min_size)
    return files


def completed_from_log(root: Path, log_path: Path | None) -> set[Path]:
    if not log_path or not log_path.exists():
        return set()

    completed: set[Path] = set()
    current: Path | None = None
    for line in log_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("[") and "] " in line:
            current = root / line.split("] ", 1)[1]
            continue
        if current and (
            line.strip().startswith("compressed:")
            or line.strip().startswith("skipped:")
            or line.strip().startswith("failed:")
        ):
            completed.add(current.resolve())
            current = None
    return completed


def verify_pdf(path: Path, expected_pages: int) -> bool:
    try:
        with fitz.open(path) as doc:
            return doc.page_count == expected_pages
    except Exception:
        return False


def compress_pdf(source: Path, dpi: int, quality: int, min_ratio: float) -> dict:
    before = source.stat().st_size
    result = {
        "file": str(source),
        "before": before,
        "after": before,
        "status": "skipped",
        "reason": "",
    }

    try:
        original = fitz.open(source)
    except Exception as exc:
        result["status"] = "failed"
        result["reason"] = f"open failed: {exc}"
        return result

    with original:
        page_count = original.page_count
        if page_count == 0:
            result["reason"] = "empty pdf"
            return result

        scale = dpi / 72
        matrix = fitz.Matrix(scale, scale)
        compressed = fitz.open()

        try:
            for page in original:
                rect = page.rect
                pix = page.get_pixmap(matrix=matrix, alpha=False, colorspace=fitz.csRGB)
                jpg = pix.tobytes("jpeg", jpg_quality=quality)
                new_page = compressed.new_page(width=rect.width, height=rect.height)
                new_page.insert_image(rect, stream=jpg)

            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", dir=source.parent) as handle:
                temp_path = Path(handle.name)

            compressed.save(
                temp_path,
                garbage=4,
                deflate=True,
                clean=True,
                pretty=False,
            )
        except Exception as exc:
            compressed.close()
            result["status"] = "failed"
            result["reason"] = f"compress failed: {exc}"
            return result
        finally:
            compressed.close()

    after = temp_path.stat().st_size
    result["after"] = after

    if after >= before * min_ratio:
        temp_path.unlink(missing_ok=True)
        result["reason"] = "not smaller enough"
        return result

    if not verify_pdf(temp_path, page_count):
        temp_path.unlink(missing_ok=True)
        result["status"] = "failed"
        result["reason"] = "verification failed"
        return result

    shutil.move(str(temp_path), str(source))
    result["status"] = "compressed"
    result["reason"] = "ok"
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--dpi", type=int, default=140)
    parser.add_argument("--quality", type=int, default=72)
    parser.add_argument("--min-ratio", type=float, default=0.97)
    parser.add_argument("--min-size-mb", type=float, default=0)
    parser.add_argument("--report", default="compression-report-35-brands.json")
    parser.add_argument("--skip-log", default="")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    files = iter_pdfs(root, args.min_size_mb)
    skipped_from_log = completed_from_log(root, Path(args.skip_log).resolve() if args.skip_log else None)
    if skipped_from_log:
        files = [path for path in files if path.resolve() not in skipped_from_log]
    total_before = sum(path.stat().st_size for path in files)
    report = []

    print(f"PDFs: {len(files)}")
    if skipped_from_log:
        print(f"Skipped from previous log: {len(skipped_from_log)}")
    print(f"Before: {total_before / 1024 / 1024 / 1024:.2f} GB")
    sys.stdout.flush()

    for index, file in enumerate(files, 1):
        rel = file.relative_to(root)
        print(f"[{index}/{len(files)}] {rel}")
        sys.stdout.flush()
        result = compress_pdf(file, args.dpi, args.quality, args.min_ratio)
        report.append(result)
        saved = result["before"] - result["after"]
        print(
            f"  {result['status']}: {result['before'] / 1024 / 1024:.1f} MB -> "
            f"{result['after'] / 1024 / 1024:.1f} MB, saved {saved / 1024 / 1024:.1f} MB"
        )
        if result["reason"] and result["reason"] != "ok":
            print(f"  reason: {result['reason']}")
        sys.stdout.flush()

    total_after = sum(path.stat().st_size for path in files)
    summary = {
        "brands": BRANDS,
        "dpi": args.dpi,
        "quality": args.quality,
        "min_size_mb": args.min_size_mb,
        "files": len(files),
        "skipped_from_log": len(skipped_from_log),
        "compressed": sum(1 for item in report if item["status"] == "compressed"),
        "failed": sum(1 for item in report if item["status"] == "failed"),
        "before": total_before,
        "after": total_after,
        "saved": total_before - total_after,
        "items": report,
    }
    (root / args.report).write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"After: {total_after / 1024 / 1024 / 1024:.2f} GB")
    print(f"Saved: {(total_before - total_after) / 1024 / 1024 / 1024:.2f} GB")
    print(f"Report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
