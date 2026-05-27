import argparse
import csv
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path.cwd() / ".tools" / "python"))

import fitz


def pdf_is_readable(file_path: Path) -> bool:
    try:
        with fitz.open(file_path) as doc:
            return doc.page_count > 0
    except Exception:
        return False


def compress_pdf(args):
    file_path, root, dpi, quality, min_ratio = args
    file_path = Path(file_path)
    relative = str(file_path.relative_to(root))
    original_size = file_path.stat().st_size
    temp_path = file_path.with_suffix(file_path.suffix + ".compressing.pdf")

    try:
        with fitz.open(file_path) as source:
            if source.page_count == 0:
                return relative, "failed", original_size, original_size, "empty pdf"

            output = fitz.open()
            zoom = dpi / 72
            matrix = fitz.Matrix(zoom, zoom)

            for page in source:
                rect = page.rect
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                jpeg = pix.tobytes("jpeg", jpg_quality=quality)
                new_page = output.new_page(width=rect.width, height=rect.height)
                new_page.insert_image(new_page.rect, stream=jpeg)

            output.save(temp_path, deflate=True, garbage=4)
            output.close()

        compressed_size = temp_path.stat().st_size
        if compressed_size >= original_size * min_ratio:
            temp_path.unlink(missing_ok=True)
            return relative, "kept", original_size, compressed_size, "not smaller enough"

        if not pdf_is_readable(temp_path):
            temp_path.unlink(missing_ok=True)
            return relative, "failed", original_size, compressed_size, "compressed pdf unreadable"

        os.replace(temp_path, file_path)
        return relative, "compressed", original_size, compressed_size, ""
    except Exception as error:
        temp_path.unlink(missing_ok=True)
        return relative, "failed", original_size, original_size, str(error)


def read_completed(log_path: Path) -> set[str]:
    if not log_path.exists():
        return set()
    completed = set()
    with log_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row.get("status") in {"compressed", "kept", "failed"}:
                completed.add(row.get("file", ""))
    return completed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="pdfs")
    parser.add_argument("--dpi", type=int, default=130)
    parser.add_argument("--quality", type=int, default=72)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--min-ratio", type=float, default=0.98)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--log", default="compress-pdfs-log.csv")
    options = parser.parse_args()

    root = Path(options.root).resolve()
    log_path = Path(options.log)
    completed = read_completed(log_path)
    files = sorted(root.rglob("*.pdf"))
    files = [file for file in files if not str(file.relative_to(Path.cwd())).replace("\\", "/") in completed]
    if options.limit:
        files = files[: options.limit]

    new_log = not log_path.exists()
    with log_path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        if new_log:
            writer.writerow(["file", "status", "original_bytes", "output_bytes", "saved_bytes", "saved_percent", "message"])

        started = time.time()
        total = len(files)
        tasks = [(file, Path.cwd(), options.dpi, options.quality, options.min_ratio) for file in files]
        compressed = kept = failed = saved = 0

        with ProcessPoolExecutor(max_workers=options.workers) as pool:
            for index, result in enumerate(as_completed(pool.submit(compress_pdf, task) for task in tasks), 1):
                file, status, original, output, message = result.result()
                saved_bytes = max(0, original - output) if status == "compressed" else 0
                saved_percent = (saved_bytes / original * 100) if original else 0
                writer.writerow([file, status, original, output, saved_bytes, f"{saved_percent:.2f}", message])
                handle.flush()

                compressed += status == "compressed"
                kept += status == "kept"
                failed += status == "failed"
                saved += saved_bytes
                print(
                    f"{index}/{total} {status} saved={saved_bytes} file={file}",
                    flush=True,
                )

        elapsed = time.time() - started
        print(
            f"done total={total} compressed={compressed} kept={kept} failed={failed} "
            f"saved_bytes={saved} elapsed_seconds={elapsed:.1f}",
            flush=True,
        )


if __name__ == "__main__":
    main()
