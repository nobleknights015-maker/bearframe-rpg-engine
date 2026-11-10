#!/usr/bin/env python3
"""Generate an isolated, launchable ENGINE test manifest.

Only the preview build uses this manifest. It does not modify the original
AndroidManifest.xml, original launcher, existing app id, or user save data.
The same compiled Java and packaged engine sources are used by both builds.
"""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ANDROID = "http://schemas.android.com/apk/res/android"
A = "{" + ANDROID + "}"
ET.register_namespace("android", ANDROID)
PACKAGE = "dev.bearframe.ridge.preview"
ACTIVITY = "dev.bearframe.ridge.UnifiedEngineActivity"
ORIGINAL = "dev.bearframe.ridge.ExpeditionActivity"

def write_preview(source, destination):
    tree = ET.parse(source)
    manifest = tree.getroot()
    if manifest.tag != "manifest" or manifest.get("package") != "dev.bearframe.ridge":
        raise ValueError("Unexpected source Android package; refusing preview transformation")
    app = manifest.find("application")
    if app is None or len(app.findall("activity")) != 2:
        raise ValueError("Expected exact original and unified engine Activity entries")
    original = None
    unified = None
    for item in app.findall("activity"):
        if item.get(A + "name") == ".ExpeditionActivity":
            original = item
        elif item.get(A + "name") == ".UnifiedEngineActivity":
            unified = item
        else:
            raise ValueError("Unknown Activity: " + str(item.get(A + "name")))
    if original is None or unified is None:
        raise ValueError("Missing original or unified engine Activity")
    filters = original.findall("intent-filter")
    if len(filters) != 1 or unified.findall("intent-filter"):
        raise ValueError("Unexpected existing launcher routing")
    original.remove(filters[0])
    original.set(A + "name", ORIGINAL)
    original.set(A + "exported", "false")
    unified.set(A + "name", ACTIVITY)
    unified.set(A + "exported", "true")
    unified.append(filters[0])
    app.set(A + "label", "Bearframe Engine Preview")
    manifest.set("package", PACKAGE)
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    tree.write(destination, encoding="unicode", xml_declaration=True)
    return destination

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: build_preview_manifest.py original.xml output.xml")
    write_preview(sys.argv[1], sys.argv[2])
