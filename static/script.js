const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const resultsTitle = document.getElementById("resultsTitle");
const pagesEl = document.getElementById("pages");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");

let currentFile = null;
let currentPages = [];

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag");
  if (e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

function setStatus(message, isError = false) {
  statusEl.hidden = !message;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

async function handleFile(file) {
  currentFile = file;
  fileName.textContent = file.name;
  resultsEl.hidden = true;
  setStatus("Extracting text…");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/extract", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || "Something went wrong.", true);
      return;
    }

    currentPages = data.pages;
    renderResults(data);
    setStatus("");
  } catch (err) {
    setStatus("Could not reach the server. Is it running?", true);
  }
}

function renderResults(data) {
  resultsTitle.textContent = `${data.filename} — ${data.page_count} page${data.page_count === 1 ? "" : "s"}`;
  pagesEl.innerHTML = "";

  data.pages.forEach((text, i) => {
    const block = document.createElement("div");
    block.className = "page-block" + (text ? "" : " empty");

    const h3 = document.createElement("h3");
    h3.textContent = `Page ${i + 1}`;

    const pre = document.createElement("pre");
    pre.textContent = text || "(no text found on this page)";

    block.appendChild(h3);
    block.appendChild(pre);
    pagesEl.appendChild(block);
  });

  resultsEl.hidden = false;
}

copyBtn.addEventListener("click", async () => {
  const combined = currentPages
    .map((text, i) => `--- Page ${i + 1} ---\n${text}`)
    .join("\n\n");
  try {
    await navigator.clipboard.writeText(combined);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy all text"), 1500);
  } catch {
    setStatus("Couldn't copy to clipboard.", true);
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!currentFile) return;
  const formData = new FormData();
  formData.append("file", currentFile);

  const res = await fetch("/extract/txt", { method: "POST", body: formData });
  if (!res.ok) {
    setStatus("Couldn't generate the download.", true);
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "extracted_text.txt";
  a.click();
  URL.revokeObjectURL(url);
});
