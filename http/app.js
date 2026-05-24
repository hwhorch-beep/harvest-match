import { marked } from "https://esm.sh/marked@12";
import DOMPurify from "https://esm.sh/dompurify@3";
import { DEFAULT_SOURCES, buildSearcherPrompt, buildWriterPrompt } from "./prompt.js";

const KEY_STORAGE = "harvest-match.anthropic-key";
const SOURCES_STORAGE = "harvest-match.sources";
// Two-pass: cheap+fast Haiku does the tool-loop searching, then Sonnet writes
// the final voice-y response from the candidate list. Splitting models like
// this is cheaper than running everything on Sonnet because the input-heavy
// search loop runs on the cheap model.
const SEARCHER_MODEL = "claude-haiku-4-5";
const WRITER_MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_WEB_SEARCHES = 10;
const MAX_TOKENS = 4096;

const form = document.getElementById("harvest-form");
const keyInput = document.getElementById("api-key");
const rememberCheckbox = document.getElementById("remember-key");
const listInput = document.getElementById("produce-list");
const submitButton = document.getElementById("submit-button");
const outputSection = document.getElementById("output-section");
const statusLine = document.getElementById("status-line");
const outputEl = document.getElementById("output");

const defaultSourcesList = document.getElementById("default-sources");
const customSourcesBlock = document.getElementById("custom-sources-block");
const customSourcesList = document.getElementById("custom-sources");
const sourcesCount = document.getElementById("sources-count");
const sourcesWarning = document.getElementById("sources-warning");
const sourceNameInput = document.getElementById("source-name");
const sourceUrlInput = document.getElementById("source-url");
const addSourceButton = document.getElementById("add-source-button");

marked.setOptions({ gfm: true, breaks: false });

const savedKey = localStorage.getItem(KEY_STORAGE);
if (savedKey) {
  keyInput.value = savedKey;
  rememberCheckbox.checked = true;
}

let sourcesState = loadSourcesState();
renderSources();

function loadSourcesState() {
  try {
    const raw = localStorage.getItem(SOURCES_STORAGE);
    if (!raw) return { excludedDefaults: [], added: [] };
    const parsed = JSON.parse(raw);
    return {
      excludedDefaults: Array.isArray(parsed.excludedDefaults) ? parsed.excludedDefaults : [],
      added: Array.isArray(parsed.added) ? parsed.added : [],
    };
  } catch {
    return { excludedDefaults: [], added: [] };
  }
}

function saveSourcesState() {
  localStorage.setItem(SOURCES_STORAGE, JSON.stringify(sourcesState));
}

function getActiveSources() {
  const active = DEFAULT_SOURCES.filter(
    (d) => !sourcesState.excludedDefaults.includes(d.url),
  );
  return active.concat(sourcesState.added);
}

function normalizeUrl(raw) {
  return raw.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function renderSources() {
  defaultSourcesList.innerHTML = "";
  for (const src of DEFAULT_SOURCES) {
    const isExcluded = sourcesState.excludedDefaults.includes(src.url);
    const li = document.createElement("li");
    const label = document.createElement("label");
    label.className = "source-row" + (isExcluded ? " excluded" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !isExcluded;
    cb.addEventListener("change", () => toggleDefault(src.url, cb.checked));
    label.appendChild(cb);

    const nameSpan = document.createElement("span");
    nameSpan.className = "source-name";
    nameSpan.textContent = src.name;
    label.appendChild(nameSpan);

    const urlSpan = document.createElement("span");
    urlSpan.className = "source-url";
    urlSpan.textContent = src.url;
    label.appendChild(urlSpan);

    if (src.note) {
      const noteSpan = document.createElement("span");
      noteSpan.className = "source-note";
      // Show just the short tag (before the em-dash, if any) for UI brevity.
      noteSpan.textContent = "(" + src.note.split(" — ")[0] + ")";
      label.appendChild(noteSpan);
    }

    li.appendChild(label);
    defaultSourcesList.appendChild(li);
  }

  customSourcesList.innerHTML = "";
  if (sourcesState.added.length === 0) {
    customSourcesBlock.hidden = true;
  } else {
    customSourcesBlock.hidden = false;
    for (const src of sourcesState.added) {
      const li = document.createElement("li");
      li.className = "source-row custom";

      const nameSpan = document.createElement("span");
      nameSpan.className = "source-name";
      nameSpan.textContent = src.name;
      li.appendChild(nameSpan);

      const urlSpan = document.createElement("span");
      urlSpan.className = "source-url";
      urlSpan.textContent = src.url;
      li.appendChild(urlSpan);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "link-button";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeCustom(src.url));
      li.appendChild(removeBtn);

      customSourcesList.appendChild(li);
    }
  }

  const active = getActiveSources();
  const n = active.length;
  sourcesCount.textContent = `(${n} active)`;
  sourcesWarning.hidden = n > 0;
  updateSubmitState();
}

function toggleDefault(url, isChecked) {
  if (isChecked) {
    sourcesState.excludedDefaults = sourcesState.excludedDefaults.filter((u) => u !== url);
  } else if (!sourcesState.excludedDefaults.includes(url)) {
    sourcesState.excludedDefaults.push(url);
  }
  saveSourcesState();
  renderSources();
}

function removeCustom(url) {
  sourcesState.added = sourcesState.added.filter((s) => s.url !== url);
  saveSourcesState();
  renderSources();
}

function updateAddButtonState() {
  addSourceButton.disabled =
    !sourceNameInput.value.trim() || !sourceUrlInput.value.trim();
}

function addCustomSource() {
  const name = sourceNameInput.value.trim();
  const url = normalizeUrl(sourceUrlInput.value);
  if (!name || !url) return;

  const allUrls = [
    ...DEFAULT_SOURCES.map((d) => d.url.toLowerCase()),
    ...sourcesState.added.map((s) => s.url.toLowerCase()),
  ];
  if (!allUrls.includes(url.toLowerCase())) {
    sourcesState.added.push({ name, url });
    saveSourcesState();
  }
  sourceNameInput.value = "";
  sourceUrlInput.value = "";
  updateAddButtonState();
  renderSources();
}

sourceNameInput.addEventListener("input", updateAddButtonState);
sourceUrlInput.addEventListener("input", updateAddButtonState);
for (const input of [sourceNameInput, sourceUrlInput]) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!addSourceButton.disabled) addCustomSource();
    }
  });
}
addSourceButton.addEventListener("click", addCustomSource);

function updateSubmitState() {
  const hasKey = !!keyInput.value.trim();
  const hasList = !!listInput.value.trim();
  const hasSources = getActiveSources().length > 0;
  submitButton.disabled = !hasKey || !hasList || !hasSources;
}
keyInput.addEventListener("input", updateSubmitState);
listInput.addEventListener("input", updateSubmitState);
updateSubmitState();

function setStatus(text, isError = false) {
  statusLine.textContent = text;
  statusLine.classList.toggle("error", isError);
}

function renderMarkdown(text) {
  const html = marked.parse(text);
  outputEl.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
  outputEl.querySelectorAll("a[href]").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const apiKey = keyInput.value.trim();
  const produceList = listInput.value.trim();
  const sources = getActiveSources();
  if (!apiKey || !produceList || sources.length === 0) return;

  if (rememberCheckbox.checked) {
    localStorage.setItem(KEY_STORAGE, apiKey);
  } else {
    localStorage.removeItem(KEY_STORAGE);
  }

  submitButton.disabled = true;
  outputSection.hidden = false;
  outputEl.innerHTML = "";
  clearLinkWarning();
  setStatus("Searching…");

  try {
    const candidates = await searchCandidates(apiKey, produceList, sources);
    const finalText = await writeRecipes(apiKey, produceList, candidates, sources);
    await verifyLinks(finalText);
  } catch (err) {
    showError(err);
  } finally {
    updateSubmitState();
  }
});

// Pass 1 — Haiku with web_search. Streams for the live "Searching: ..."
// status updates, but its text output (the candidate list markdown) is
// buffered, not rendered to the page.
async function searchCandidates(apiKey, produceList, sources) {
  const response = await callApi(apiKey, {
    model: SEARCHER_MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSearcherPrompt(sources),
    messages: [{ role: "user", content: produceList }],
    tools: [
      { type: "web_search_20250305", name: "web_search", max_uses: MAX_WEB_SEARCHES },
    ],
    stream: true,
  });

  const text = await consumeStream(response, {
    onSearchQuery: (q) => setStatus(`Searching: "${q}"`),
    onSearchStart: () => setStatus("Searching the web…"),
    // No onText: we don't render the researcher's output.
  });

  return text;
}

// Pass 2 — Sonnet, no tools. Streams and renders markdown progressively.
async function writeRecipes(apiKey, produceList, candidates, sources) {
  setStatus("Writing…");

  const userMessage =
    `Produce list:\n${produceList}\n\n` +
    `---\n\nCandidates from the researcher:\n\n${candidates}`;

  const response = await callApi(apiKey, {
    model: WRITER_MODEL,
    max_tokens: MAX_TOKENS,
    system: buildWriterPrompt(sources),
    messages: [{ role: "user", content: userMessage }],
    stream: true,
  });

  const text = await consumeStream(response, {
    onText: (buffer) => {
      renderMarkdown(buffer);
      setStatus("Writing…");
    },
  });

  return text;
}

async function callApi(apiKey, body) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errBody = "";
    try { errBody = await response.text(); } catch {}
    throw new ApiError(response.status, errBody);
  }

  return response;
}

async function consumeStream(response, { onText, onSearchStart, onSearchQuery } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let textBuffer = "";
  let currentToolInput = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });

    let sepIdx;
    while ((sepIdx = sseBuffer.indexOf("\n\n")) >= 0) {
      const block = sseBuffer.slice(0, sepIdx);
      sseBuffer = sseBuffer.slice(sepIdx + 2);
      const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;

      let evt;
      try { evt = JSON.parse(payload); } catch { continue; }

      switch (evt.type) {
        case "content_block_start": {
          const t = evt.content_block?.type;
          currentToolInput = "";
          if (t === "server_tool_use" || t === "tool_use") {
            onSearchStart?.();
          }
          break;
        }
        case "content_block_delta": {
          const delta = evt.delta;
          if (delta?.type === "text_delta") {
            textBuffer += delta.text;
            onText?.(textBuffer);
          } else if (delta?.type === "input_json_delta") {
            currentToolInput += delta.partial_json || "";
            const m = currentToolInput.match(/"query"\s*:\s*"([^"]*)/);
            if (m) onSearchQuery?.(m[1]);
          }
          break;
        }
        case "message_stop": {
          break;
        }
        case "error": {
          throw new ApiError(
            evt.error?.type || "stream_error",
            evt.error?.message || "",
          );
        }
      }
    }
  }

  return textBuffer;
}

// --- Link verification ----------------------------------------------------
//
// After the model finishes, run a deterministic client-side check on every
// recipe URL in the response. A `no-cors` fetch will throw if the domain
// doesn't resolve at all, which catches the most embarrassing hallucination:
// a completely made-up website. It cannot distinguish a 200 from a 404 on a
// real domain (the response is opaque), so a fake path on a real site will
// slip through — we flag that limitation in the warning text.

const URL_RE = /(?:https?:\/\/)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+\/[^\s)\]"']+/gi;
const URL_CHECK_TIMEOUT_MS = 5000;

function extractUrls(text) {
  const matches = text.match(URL_RE) || [];
  const normalized = matches.map((raw) => {
    const stripped = raw.replace(/[.,;:!?)]+$/, "");
    return /^https?:\/\//i.test(stripped) ? stripped : "https://" + stripped;
  });
  return [...new Set(normalized)];
}

async function checkUrl(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), URL_CHECK_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "HEAD",
      mode: "no-cors",
      redirect: "follow",
      signal: ctrl.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function verifyLinks(finalText) {
  const urls = extractUrls(finalText);
  if (urls.length === 0) return;
  setStatus("Verifying links…");
  const results = await Promise.all(urls.map(checkUrl));
  const unreachable = urls.filter((_, i) => !results[i]);
  setStatus("");
  if (unreachable.length > 0) showLinkWarning(unreachable);
}

function clearLinkWarning() {
  const existing = document.getElementById("link-warning");
  if (existing) existing.remove();
}

function showLinkWarning(unreachable) {
  clearLinkWarning();
  const warning = document.createElement("div");
  warning.id = "link-warning";
  warning.className = "link-warning";

  const heading = document.createElement("strong");
  const count = unreachable.length;
  heading.textContent = `${count} link${count > 1 ? "s" : ""} couldn't be reached`;
  warning.appendChild(heading);

  const explanation = document.createElement("p");
  explanation.textContent =
    "These domains didn't resolve or the server didn't respond — possibly hallucinated. Double-check before clicking. (Note: this check can't catch a fake URL on a real domain.)";
  warning.appendChild(explanation);

  const list = document.createElement("ul");
  for (const url of unreachable) {
    const li = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = url;
    li.appendChild(code);
    list.appendChild(li);
  }
  warning.appendChild(list);

  outputSection.insertBefore(warning, outputEl);
}

class ApiError extends Error {
  constructor(statusOrType, body) {
    super(`API error: ${statusOrType}`);
    this.statusOrType = statusOrType;
    this.body = body;
  }
}

function showError(err) {
  let msg;
  if (err instanceof ApiError) {
    const s = err.statusOrType;
    if (s === 401 || s === "authentication_error") {
      msg = "Your API key was rejected. Double-check it on console.anthropic.com and re-paste it.";
    } else if (s === 403 || s === "permission_error") {
      msg = "This API key doesn't have permission for that model. Check your Anthropic console.";
    } else if (s === 429 || s === "rate_limit_error") {
      msg = "Anthropic rate-limited this request. Wait a minute and try again.";
    } else if (s === 400 || s === "invalid_request_error") {
      msg = "The request was malformed. This is likely a bug — please report it.";
    } else if (s === 529 || s === "overloaded_error") {
      msg = "Anthropic is overloaded right now. Try again in a moment.";
    } else {
      msg = `Something went wrong (${s}). Try again, and if it persists, check console.anthropic.com.`;
    }
  } else if (err instanceof TypeError) {
    msg = "Network error — check your connection and try again.";
  } else {
    msg = "Something went wrong. Try again.";
  }
  setStatus(msg, true);
}
