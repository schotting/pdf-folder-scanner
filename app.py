from flask import Flask, render_template, request, jsonify, Response
import fitz  # PyMuPDF

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB upload limit


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/extract", methods=["POST"])
def extract():
    uploaded = request.files.get("file")
    if uploaded is None or uploaded.filename == "":
        return jsonify({"error": "No file uploaded."}), 400
    if not uploaded.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Please upload a .pdf file."}), 400

    try:
        doc = fitz.open(stream=uploaded.read(), filetype="pdf")
    except Exception:
        return jsonify({"error": "Could not read that file as a PDF."}), 400

    pages = [page.get_text().strip() for page in doc]
    doc.close()

    return jsonify({"filename": uploaded.filename, "page_count": len(pages), "pages": pages})


@app.route("/extract/txt", methods=["POST"])
def extract_txt():
    uploaded = request.files.get("file")
    if uploaded is None or uploaded.filename == "":
        return jsonify({"error": "No file uploaded."}), 400

    try:
        doc = fitz.open(stream=uploaded.read(), filetype="pdf")
    except Exception:
        return jsonify({"error": "Could not read that file as a PDF."}), 400

    chunks = []
    for i, page in enumerate(doc, start=1):
        text = page.get_text().strip()
        chunks.append(f"--- Page {i} ---\n{text}")
    doc.close()

    body = "\n\n".join(chunks)
    return Response(
        body,
        mimetype="text/plain",
        headers={"Content-Disposition": "attachment; filename=extracted_text.txt"},
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
