import os
import sys
from pathlib import Path

import fitz  # PyMuPDF
from flask import Flask, jsonify, render_template, request, Response

try:
    import webview
except ImportError:
    webview = None

# When bundled by PyInstaller, templates/static live under sys._MEIPASS
# instead of next to this file, so resolve both explicitly.
if getattr(sys, "frozen", False):
    _base_dir = sys._MEIPASS
else:
    _base_dir = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(_base_dir, "templates"),
    static_folder=os.path.join(_base_dir, "static"),
)

# Set by desktop.py when running as a native app window, so /browse-folder
# can use pywebview's native dialog instead of the tkinter fallback.
_webview_window = None


def set_webview_window(window):
    global _webview_window
    _webview_window = window


def find_pdfs(root: Path):
    """Recursively find all .pdf files under root, sorted for stable output."""
    return sorted(
        (p for p in root.rglob("*") if p.is_file() and p.suffix.lower() == ".pdf"),
        key=lambda p: str(p).lower(),
    )


def extract_pdf_text(path: Path) -> str:
    doc = fitz.open(path)
    try:
        pages = [page.get_text().strip() for page in doc]
    finally:
        doc.close()
    return "\n\n".join(p for p in pages if p)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/browse-folder")
def browse_folder():
    """Opens a native OS folder-picker dialog on the machine running the server."""
    if _webview_window is not None and webview is not None:
        result = _webview_window.create_file_dialog(webview.FOLDER_DIALOG)
        selected = result[0] if result else ""
        return jsonify({"path": selected or ""})

    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        return jsonify({"error": "Native folder picker isn't available on this system."}), 500

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    selected = filedialog.askdirectory(title="Select a folder to scan for PDFs")
    root.destroy()

    return jsonify({"path": selected or ""})


@app.route("/scan", methods=["POST"])
def scan():
    data = request.get_json(silent=True) or {}
    raw_path = (data.get("path") or "").strip()

    if not raw_path:
        return jsonify({"error": "Please provide a folder path."}), 400

    root = Path(raw_path)
    if not root.exists():
        return jsonify({"error": f"That path doesn't exist: {raw_path}"}), 400
    if not root.is_dir():
        return jsonify({"error": f"That path isn't a folder: {raw_path}"}), 400

    pdf_paths = find_pdfs(root)

    files = []
    combined_parts = []
    error_count = 0
    sep = "\n\n\n"
    running_len = 0

    for i, pdf_path in enumerate(pdf_paths, start=1):
        rel = pdf_path.relative_to(root)
        try:
            text = extract_pdf_text(pdf_path)
            file_entry = {"path": str(rel), "char_count": len(text), "error": None}
        except Exception as exc:
            error_count += 1
            text = ""
            file_entry = {"path": str(rel), "char_count": 0, "error": str(exc)}

        header = (
            "=" * 70 + "\n"
            f"FILE {i} of {len(pdf_paths)}: {rel}\n"
            + "=" * 70
        )
        body = text if text else "(no extractable text — this PDF may be scanned/image-based, or failed to parse)"
        part = f"{header}\n\n{body}"

        # Record where this file's text begins within the final combined
        # string, so the UI can look up "which PDF is this match in?".
        file_entry["start"] = running_len
        files.append(file_entry)
        combined_parts.append(part)
        running_len += len(part) + (len(sep) if i < len(pdf_paths) else 0)

    combined = sep.join(combined_parts)

    return jsonify({
        "root": str(root),
        "pdf_count": len(pdf_paths),
        "error_count": error_count,
        "files": files,
        "combined": combined,
    })


@app.route("/scan/txt", methods=["POST"])
def scan_txt():
    data = request.get_json(silent=True) or {}
    combined = data.get("combined") or ""
    return Response(
        combined,
        mimetype="text/plain",
        headers={"Content-Disposition": "attachment; filename=all_pdf_text.txt"},
    )


if __name__ == "__main__":
    app.run(debug=True, port=5001)
