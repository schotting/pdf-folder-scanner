#!/bin/bash
# Builds "PDF Folder Scanner.app" into folder-scan/dist/
# Run on macOS from a Python environment that has ../requirements.txt and
# requirements-desktop.txt installed.
set -e
cd "$(dirname "$0")"
pyinstaller desktop.spec --noconfirm
echo
echo "Done. Find the app at dist/PDF Folder Scanner.app"
