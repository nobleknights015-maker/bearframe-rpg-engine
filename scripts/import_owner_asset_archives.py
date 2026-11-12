#!/usr/bin/env python3
"""Offline importer for the Founder's *complete* locally supplied PNG library.

Source ZIPs stay untouched. Nested ZIPs are inspected, not trusted as paths.
All PNG entries become lazy, individually identified runtime assets. Every
other original file is recorded in a provenance inventory; its original source
ZIP remains the editable/source archive. No network or license assumptions.
"""
import hashlib
import io
import json
import os
import pathlib
import shutil
import struct
import sys
import tempfile
import zipfile

MAX_COUNT = 4096
MAX_IMAGE = 64 * 1024 * 1024
MAX_PACK = 512 * 1024 * 1024
MAX_PIXELS = 16777216


def read_entries(source):
    """Yield (containing_zip, original_name, bytes) from source and nested ZIPs."""
    with zipfile.ZipFile(source) as outer:
        for item in outer.infolist():
            if item.is_dir():
                continue
            if item.filename.lower().endswith(".zip"):
                if item.file_size > MAX_PACK:
                    raise ValueError("Nested ZIP exceeds safety budget")
                with zipfile.ZipFile(io.BytesIO(outer.read(item))) as nested:
                    for inner in nested.infolist():
                        if inner.is_dir():
                            continue
                        if inner.file_size > MAX_IMAGE:
                            # Non-image source can be large but should not
                            # trigger massive archive extraction.
                            raise ValueError("Oversized nested source entry")
                        yield item.filename, inner.filename, nested.read(inner)
            else:
                if item.file_size > MAX_IMAGE:
                    raise ValueError("Oversized archive source entry")
                yield None, item.filename, outer.read(item)


def png_size(data):
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("Invalid PNG signature")
    width, height = struct.unpack(">II", data[16:24])
    if not 1 <= width <= 8192 or not 1 <= height <= 8192 or width * height > MAX_PIXELS:
        raise ValueError("PNG dimensions exceed engine limits")
    return width, height


def build(sources, output):
    if not sources:
        raise ValueError("At least one source archive is required")
    output = pathlib.Path(output).resolve()
    if output.exists():
        raise FileExistsError("Refusing to overwrite existing owner asset import: " + str(output))
    for source in sources:
        if not pathlib.Path(source).is_file():
            raise FileNotFoundError(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = pathlib.Path(tempfile.mkdtemp(prefix=".bf-owner-import-", dir=output.parent))
    try:
        pack = stage / "runtime-pack"
        (pack / "library").mkdir(parents=True)
        manifest = {"version": 1, "assets": {}}
        index = {"version": 1, "assets": {}}
        provenance = []
        bytes_total = 0
        png_total = 0
        tiles_32 = 0
        for source in sources:
            archive = pathlib.Path(source).name
            for nested_zip, name, data in read_entries(source):
                ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
                digest = hashlib.sha256(data).hexdigest()
                record = {
                    "source_archive": archive,
                    "nested_zip": nested_zip,
                    "original_path": name,
                    "extension": ext,
                    "bytes": len(data),
                    "sha256": digest,
                    "runtime_id": None,
                }
                if ext == "png":
                    width, height = png_size(data)
                    if not 0 < len(data) <= MAX_IMAGE:
                        raise ValueError("Runtime PNG exceeds 64 MiB")
                    runtime_id = "asset_" + hashlib.sha256(
                        (archive + "\0" + (nested_zip or "") + "\0" + name)
                        .encode("utf-8")).hexdigest()[:24]
                    if runtime_id in manifest["assets"]:
                        raise ValueError("Duplicate source key (hashed ID)")
                    relative = "library/" + runtime_id + ".png"
                    bytes_total += len(data)
                    png_total += 1
                    tiles_32 += int(width == 32 and height == 32)
                    if bytes_total > MAX_PACK or png_total > MAX_COUNT:
                        raise ValueError("Owner library exceeds this pack's safety bounds")
                    (pack / relative).write_bytes(data)
                    manifest["assets"][runtime_id] = {
                        "type": "image", "path": relative,
                        "width": width, "height": height,
                        "pixelArt": width <= 1024 and height <= 1024,
                        "preload": False,
                    }
                    index["assets"][runtime_id] = {
                        "path": relative, "bytes": len(data), "sha256": digest
                    }
                    record.update({"runtime_id": runtime_id, "width": width, "height": height})
                provenance.append(record)
        # Deterministic ordering makes repeated imports diffable.
        manifest["assets"] = dict(sorted(manifest["assets"].items()))
        index["assets"] = dict(sorted(index["assets"].items()))
        provenance.sort(key=lambda r: (
            r["source_archive"], r["nested_zip"] or "", r["original_path"]))
        for name, value in (
            ("asset-manifest.json", manifest),
            ("asset-index.json", index),
        ):
            (pack / name).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
        summary = {
            "format": "bearframe-owner-library-v1",
            "total_source_files": len(provenance),
            "runtime_pngs": png_total,
            "native_32x32_pngs": tiles_32,
            "runtime_bytes": bytes_total,
            "sources": [pathlib.Path(x).name for x in sources],
            "source_entries": provenance,
        }
        (stage / "source-inventory.json").write_text(
            json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        stage.rename(output)
        return {k: summary[k] for k in (
            "total_source_files", "runtime_pngs", "native_32x32_pngs", "runtime_bytes"
        )}
    except BaseException:
        shutil.rmtree(stage, ignore_errors=True)
        raise


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(
            "Usage: python3 scripts/import_owner_asset_archives.py "
            "NEW_OUTPUT_DIR INPUT.zip [MORE_INPUT.zip ...]"
        )
    try:
        print(json.dumps(build(sys.argv[2:], sys.argv[1]), indent=2))
    except (OSError, ValueError, zipfile.BadZipFile) as exc:
        print("Owner asset import refused: " + str(exc), file=sys.stderr)
        sys.exit(1)
