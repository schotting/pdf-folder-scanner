@echo off
REM Builds PDF Folder Scanner.exe into folder-scan\dist\
REM Run from a Python environment that has ../requirements.txt and
REM requirements-desktop.txt installed.
cd /d "%~dp0"
pyinstaller desktop.spec --noconfirm
echo.
echo Done. Find the app at dist\PDF Folder Scanner.exe
