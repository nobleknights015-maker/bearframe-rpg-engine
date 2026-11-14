#!/usr/bin/env python3
"""Fail-closed Android versionCode override for same-signer upgrade acceptance.

Source manifests are NEVER edited. The CI upgrade test signs both versions
with one job-local ephemeral key. This is not a production signing mechanism.
"""
import pathlib
import re
import sys
import xml.etree.ElementTree as ET

ANDROID = "http://schemas.android.com/apk/res/android"
A = "{" + ANDROID + "}"
ET.register_namespace("android", ANDROID)
MAX_ANDROID_CODE = 2100000000
VALID_PACKAGES = {"dev.bearframe.ridge", "dev.bearframe.ridge.preview"}


def versioned_manifest(source, output, requested_code):
    src = pathlib.Path(source).resolve()
    dest = pathlib.Path(output).resolve()
    if src == dest or dest.exists():
        raise ValueError("Refusing to overwrite an Android manifest")
    if not isinstance(requested_code, str) or not re.fullmatch(r"[1-9][0-9]{0,9}", requested_code):
        raise ValueError("Android versionCode must be an unpadded positive decimal integer")
    new_code = int(requested_code)
    if not 2 <= new_code <= MAX_ANDROID_CODE:
        raise ValueError("Android versionCode outside safe upgrade range")
    tree = ET.parse(src)
    manifest = tree.getroot()
    if manifest.tag != "manifest" or manifest.get("package") not in VALID_PACKAGES:
        raise ValueError("Unexpected Android package; refusing version override")
    old_text = manifest.get(A + "versionCode")
    if old_text is None or not re.fullmatch(r"[1-9][0-9]{0,9}", old_text):
        raise ValueError("Missing or malformed source versionCode")
    old_code = int(old_text)
    if new_code <= old_code:
        raise ValueError("A test upgrade must increase versionCode")
    if manifest.find("application") is None:
        raise ValueError("Missing Android application")
    manifest.set(A + "versionCode", str(new_code))
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("x", encoding="utf-8") as stream:
        tree.write(stream, encoding="unicode", xml_declaration=True)
    return dest


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Usage: build_versioned_manifest.py ORIGINAL NEW_PATH VERSION_CODE")
    try:
        print(versioned_manifest(*sys.argv[1:]))
    except (OSError, ValueError, ET.ParseError) as error:
        raise SystemExit("Android upgrade manifest refused: " + str(error))
