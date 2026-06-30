// AnyConv frontend — vanilla ES module, no build step.

const $ = (id) => document.getElementById(id);

const els = {
  dropzone: $("dropzone"),
  fileInput: $("fileInput"),
  panel: $("panel"),
  fileName: $("fileName"),
  fileInfo: $("fileInfo"),
  fromFmt: $("fromFmt"),
  toFmt: $("toFmt"),
  convertBtn: $("convertBtn"),
  resetBtn: $("resetBtn"),
  priceNote: $("priceNote"),
  status: $("status"),
  statusText: $("statusText"),
  result: $("result"),
  resultText: $("resultText"),
  downloadBtn: $("downloadBtn"),
  payBtn: $("payBtn"),
  againBtn: $("againBtn"),
  error: $("error"),
  errorText: $("errorText"),
  errorBack: $("errorBack"),
  capabilities: $("capabilities"),
};

const CATEGORY_LABELS = {
  image: "Images",
  audio: "Audio",
  video: "Video",
  document: "Documents",
  spreadsheet: "Spreadsheets",
  presentation: "Presentations",
  pdf: "PDF",
  data: "Data",
  archive: "Archives",
};

let caps = null; // { formats, matrix, tools, payments }
let formatById = {};
let selectedFile = null;
let currentJob = null;

init();

async function init() {
  bindEvents();
  try {
    caps = await (await fetch("/api/formats")).json();
    formatById = Object.fromEntries(caps.formats.map((f) => [f.id, f]));
    renderCapabilities();
  } catch {
    showError("Could not reach the conversion service. Is the server running?");
  }
  handleStripeReturn();
}

function bindEvents() {
  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      els.fileInput.click();
    }
  });
  els.fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) onFileChosen(e.target.files[0]);
  });

  ["dragenter", "dragover"].forEach((ev) =>
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.add("dragover");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("dragover");
    }),
  );
  els.dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileChosen(file);
  });

  els.resetBtn.addEventListener("click", reset);
  els.againBtn.addEventListener("click", reset);
  els.errorBack.addEventListener("click", reset);
  els.convertBtn.addEventListener("click", convert);
  els.payBtn.addEventListener("click", pay);
  els.toFmt.addEventListener("change", () => {
    els.convertBtn.disabled = !els.toFmt.value;
  });
}

function extOf(name) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function canonicalFormat(ext) {
  if (formatById[ext]) return ext;
  // Map a few common aliases the API also accepts.
  const aliases = { jpeg: "jpg", jpe: "jpg", tif: "tiff", htm: "html", yml: "yaml", markdown: "md" };
  return aliases[ext] || null;
}

function onFileChosen(file) {
  selectedFile = file;
  const ext = extOf(file.name);
  const from = canonicalFormat(ext);

  els.fileName.textContent = file.name;
  els.fileInfo.textContent = formatBytes(file.size);
  show(els.panel);
  hide(els.dropzone);
  hide(els.result);
  hide(els.error);

  if (!from || !caps?.matrix[from]) {
    els.fromFmt.textContent = ext ? ext.toUpperCase() : "Unknown";
    els.toFmt.innerHTML = "";
    els.convertBtn.disabled = true;
    els.priceNote.hidden = true;
    showInlineUnsupported();
    return;
  }

  els.fromFmt.textContent = (formatById[from]?.label || from.toUpperCase());
  populateTargets(from);
  els.priceNote.hidden = !caps.payments.enabled;
  if (caps.payments.enabled) {
    els.priceNote.textContent = `Each conversion costs ${caps.payments.price}.`;
  }
}

function showInlineUnsupported() {
  els.fromFmt.dataset.unsupported = "1";
  const opt = document.createElement("option");
  opt.textContent = "Unsupported file type";
  els.toFmt.appendChild(opt);
}

function populateTargets(from) {
  const targets = caps.matrix[from] || [];
  els.toFmt.innerHTML = "";

  // Group targets by category for a tidy dropdown.
  const groups = {};
  for (const t of targets) {
    const cat = formatById[t]?.category || "other";
    (groups[cat] ||= []).push(t);
  }
  for (const [cat, ids] of Object.entries(groups)) {
    const og = document.createElement("optgroup");
    og.label = CATEGORY_LABELS[cat] || cat;
    for (const id of ids) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = `${id.toUpperCase()} — ${formatById[id]?.label || id}`;
      og.appendChild(o);
    }
    els.toFmt.appendChild(og);
  }
  els.convertBtn.disabled = targets.length === 0;
}

async function convert() {
  if (!selectedFile || !els.toFmt.value) return;
  showStatus("Uploading & converting…");

  const form = new FormData();
  form.append("file", selectedFile);
  form.append("to", els.toFmt.value);

  try {
    const res = await fetch("/api/convert", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || "Conversion failed.");
      return;
    }
    currentJob = data;
    if (data.paymentRequired) {
      showPayResult(data);
    } else {
      showDownloadResult(data.downloadUrl, data.fileName, data.size);
    }
  } catch {
    showError("Network error during conversion. Please try again.");
  }
}

async function pay() {
  if (!currentJob) return;
  els.payBtn.disabled = true;
  els.payBtn.textContent = "Redirecting…";
  try {
    const res = await fetch(`/api/checkout/${currentJob.jobId}`, { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      showError(data.error || "Could not start checkout.");
    }
  } catch {
    showError("Could not start checkout. Please try again.");
  }
}

function showDownloadResult(url, name, size) {
  hideAllSections();
  els.downloadBtn.href = url;
  els.downloadBtn.setAttribute("download", name || "");
  els.downloadBtn.hidden = false;
  els.payBtn.hidden = true;
  els.resultText.textContent = `${name}${size ? " · " + formatBytes(size) : ""} is ready.`;
  show(els.result);
}

function showPayResult(data) {
  hideAllSections();
  els.downloadBtn.hidden = true;
  els.payBtn.hidden = false;
  els.payBtn.disabled = false;
  els.payBtn.textContent = `Pay ${caps.payments.price} & download`;
  els.resultText.textContent = `${data.fileName} is ready. Complete payment to download.`;
  show(els.result);
}

// On returning from Stripe Checkout (?session_id=...&job=...), unlock download.
async function handleStripeReturn() {
  const params = new URLSearchParams(location.search);
  const sessionId = params.get("session_id");
  const job = params.get("job");
  if (!sessionId || !job) return;
  history.replaceState({}, "", location.pathname);

  showStatus("Confirming payment…");
  try {
    const res = await fetch(`/api/jobs/${job}`);
    const info = await res.json();
    const name = info.fileName || "your file";
    const url = `/api/download/${job}?session_id=${encodeURIComponent(sessionId)}`;
    showDownloadResult(url, name, info.size);
  } catch {
    showError("We couldn't confirm your payment automatically. Please contact support.");
  }
}

// ---- view helpers ----
function show(el) {
  el.hidden = false;
}
function hide(el) {
  el.hidden = true;
}
function hideAllSections() {
  hide(els.panel);
  hide(els.status);
  hide(els.result);
  hide(els.error);
  hide(els.dropzone);
}
function showStatus(text) {
  hideAllSections();
  els.statusText.textContent = text;
  show(els.status);
}
function showError(text) {
  hideAllSections();
  els.errorText.textContent = text;
  show(els.error);
}
function reset() {
  selectedFile = null;
  currentJob = null;
  els.fileInput.value = "";
  els.toFmt.innerHTML = "";
  hideAllSections();
  show(els.dropzone);
}

function renderCapabilities() {
  const t = caps.tools || {};
  const on = Object.entries(t)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const total = caps.formats.length;
  els.capabilities.textContent = `${total} formats · engines: ${on.join(", ") || "built-in"}${
    caps.payments.enabled ? " · pay-per-file" : " · free"
  }`;
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
