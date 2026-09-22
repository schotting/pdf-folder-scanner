const pathInput = document.getElementById("pathInput");
const browseBtn = document.getElementById("browseBtn");
const scanBtn = document.getElementById("scanBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const summaryEl = document.getElementById("summary");
const downloadBtn = document.getElementById("downloadBtn");
const searchInput = document.getElementById("searchInput");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const matchCountEl = document.getElementById("matchCount");
const matchSourceEl = document.getElementById("matchSource");
const matchSourceNameEl = document.getElementById("matchSourceName");
const outputEl = document.getElementById("output");

let combinedText = "";
let matches = []; // array of <mark> elements, in document order
let currentMatch = -1;
let fileRanges = []; // [{path, start}], sorted by start ascending

function setStatus(message, isError = false) {
  statusEl.hidden = !message;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Browse ---
browseBtn.addEventListener("click", async () => {
  browseBtn.disabled = true;
  const original = browseBtn.textContent;
  browseBtn.textContent = "Waiting for dialog…";
  try {
    const res = await fetch("/browse-folder");
    const data = await res.json();
    if (data.error) {
      setStatus(data.error, true);
    } else if (data.path) {
      pathInput.value = data.path;
    }
  } catch {
    setStatus("Couldn't open the folder picker.", true);
  } finally {
    browseBtn.disabled = false;
    browseBtn.textContent = original;
  }
});

// --- Scan ---
scanBtn.addEventListener("click", runScan);
pathInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runScan();
});

async function runScan() {
  const path = pathInput.value.trim();
  if (!path) {
    setStatus("Enter a folder path first.", true);
    return;
  }

  resultsEl.hidden = true;
  scanBtn.disabled = true;
  setStatus("Scanning folder and extracting text… this can take a moment for large folders.");

  try {
    const res = await fetch("/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || "Something went wrong.", true);
      return;
    }

    combinedText = data.combined;
    fileRanges = data.files.map((f) => ({ path: f.path, start: f.start }));
    renderSummary(data);
    renderOutput(combinedText);
    clearSearch();
    setStatus("");
    resultsEl.hidden = false;
  } catch {
    setStatus("Could not reach the server. Is it running?", true);
  } finally {
    scanBtn.disabled = false;
  }
}

function renderSummary(data) {
  const errPart = data.error_count
    ? ` — <span class="warn">${data.error_count} couldn't be read</span>`
    : "";
  summaryEl.innerHTML = `${data.pdf_count} PDF${data.pdf_count === 1 ? "" : "s"} found under <code>${escapeHtml(data.root)}</code>${errPart}`;
}

function renderOutput(text) {
  outputEl.textContent = text;
}

// --- Download ---
downloadBtn.addEventListener("click", async () => {
  const res = await fetch("/scan/txt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ combined: combinedText }),
  });
  if (!res.ok) {
    setStatus("Couldn't generate the download.", true);
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "all_pdf_text.txt";
  a.click();
  URL.revokeObjectURL(url);
});

// --- Search / highlight / next / prev ---
let searchDebounce = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(applySearch, 150);
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (e.shiftKey) goToMatch(currentMatch - 1);
    else goToMatch(currentMatch + 1);
  }
});
prevBtn.addEventListener("click", () => goToMatch(currentMatch - 1));
nextBtn.addEventListener("click", () => goToMatch(currentMatch + 1));

function clearSearch() {
  searchInput.value = "";
  matches = [];
  currentMatch = -1;
  matchCountEl.textContent = "";
  matchSourceEl.hidden = true;
}

function findFileForOffset(offset) {
  let found = null;
  for (const f of fileRanges) {
    if (f.start > offset) break;
    found = f;
  }
  return found ? found.path : null;
}

function applySearch() {
  const query = searchInput.value;

  if (!query) {
    renderOutput(combinedText);
    matches = [];
    currentMatch = -1;
    matchCountEl.textContent = "";
    return;
  }

  const regex = new RegExp(escapeRegex(query), "gi");
  let html = "";
  let lastIndex = 0;
  let count = 0;
  let m;

  while ((m = regex.exec(combinedText)) !== null) {
    if (m[0].length === 0) { regex.lastIndex++; continue; }
    const start = m.index;
    const end = start + m[0].length;
    html += escapeHtml(combinedText.slice(lastIndex, start));
    html += `<mark class="hit" data-idx="${count}" data-start="${start}">${escapeHtml(combinedText.slice(start, end))}</mark>`;
    lastIndex = end;
    count++;
  }
  html += escapeHtml(combinedText.slice(lastIndex));

  outputEl.innerHTML = html;
  matches = Array.from(outputEl.querySelectorAll("mark.hit"));
  currentMatch = matches.length ? 0 : -1;
  updateCurrentMatch();
}

function goToMatch(index) {
  if (!matches.length) return;
  currentMatch = ((index % matches.length) + matches.length) % matches.length;
  updateCurrentMatch();
}

function updateCurrentMatch() {
  matches.forEach((el, i) => el.classList.toggle("current", i === currentMatch));
  if (currentMatch >= 0) {
    const el = matches[currentMatch];
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    matchCountEl.textContent = `${currentMatch + 1} of ${matches.length}`;

    const offset = parseInt(el.dataset.start, 10);
    const sourcePath = findFileForOffset(offset);
    if (sourcePath) {
      matchSourceNameEl.textContent = sourcePath;
      matchSourceEl.hidden = false;
    } else {
      matchSourceEl.hidden = true;
    }
  } else {
    matchCountEl.textContent = matches.length === 0 && searchInput.value ? "0 matches" : "";
    matchSourceEl.hidden = true;
  }
}
