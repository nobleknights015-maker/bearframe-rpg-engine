#!/usr/bin/env python3
"""Refuse high-risk tracked artifacts in the public Bearframe engine repository.
This is a hygiene guard, not a substitute for secret scanning or license review.
"""
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROM_SUFFIXES = {'.gba', '.gbc', '.sms', '.smd', '.rom', '.nes', '.sfc', '.smc', '.iso', '.cue', '.chd'}
SECRET_SUFFIXES = {'.p12', '.pfx', '.jks', '.keystore', '.pem', '.p8'}
SECRET_NAMES = {'id_rsa', 'id_ed25519', 'credentials.json', 'secrets.json'}
SUSPECT_TITLES = ('phantasy star collection', 'phantasy star iv.zip', 'phantasy star 4.zip')


def reason(name):
    p = Path(name)
    base = p.name.lower()
    low = str(p).lower().replace('\\', '/')
    if p.suffix.lower() in ROM_SUFFIXES:
        return 'ROM or disc-image extension'
    if p.suffix.lower() in SECRET_SUFFIXES or base in SECRET_NAMES:
        return 'secret or signing material'
    if base == '.env' or base.startswith('.env.') and base not in {'.env.example', '.env.sample'}:
        return 'private environment file'
    if any(title in low for title in SUSPECT_TITLES):
        return 'known proprietary cartridge archive name'
    return None


def tracked():
    output = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT)
    return [Path(os.fsdecode(raw)) for raw in output.split(b'\0') if raw]


def scan():
    findings = []
    for path in tracked():
        risk = reason(path)
        if risk:
            findings.append(f'{path}: {risk}')
        full = ROOT / path
        if full.is_file() and full.suffix.lower() in {'.zip', '.apk', '.jar'}:
            try:
                with zipfile.ZipFile(full) as archive:
                    for entry in archive.namelist():
                        risk = reason(entry)
                        if risk:
                            findings.append(f'{path}!{entry}: {risk}')
            except (OSError, zipfile.BadZipFile) as exc:
                findings.append(f'{path}: archive inspection failed ({type(exc).__name__})')
    return findings


if __name__ == '__main__':
    violations = scan()
    if violations:
        print('PUBLIC REPOSITORY GUARD FAILED:')
        for entry in violations:
            print(' -', entry)
        sys.exit(1)
    print('PASS tracked files and nested archives contain no known ROM/secret file patterns')
