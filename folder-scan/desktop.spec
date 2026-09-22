# PyInstaller spec for the PDF Folder Scanner desktop app.
# Build on the target OS: `pyinstaller desktop.spec` on Windows produces
# a .exe, and the same command run on macOS produces a .app bundle.
import sys

a = Analysis(
    ["desktop.py"],
    pathex=[],
    binaries=[],
    datas=[
        ("templates", "templates"),
        ("static", "static"),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="PDF Folder Scanner",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=True,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

if sys.platform == "darwin":
    app = BUNDLE(
        exe,
        name="PDF Folder Scanner.app",
        icon=None,
        bundle_identifier="com.davidschotting.pdffolderscanner",
    )
