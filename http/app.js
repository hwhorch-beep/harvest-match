import { marked } from "https://esm.sh/marked@12";
import DOMPurify from "https://esm.sh/dompurify@3";
import { SYSTEM_PROMPT } from "./prompt.js";

const KEY_STORAGE = "harvest-match.anthropic-key";
const MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_WEB_SEARCHES = 5;
const MAX_TOKENS = 4096;

const form = document.getElementById("harvest-form");
const keyInput = document.getElementById("api-key");
const rememberCheckbox = document.getElementById("remember-key");
const listInput = document.getElementById("produce-list");
const submitButton = document.getElementById("submit-button");
const outputSection = document.getElementById("output-section");
const statusLine = document.getElementById("status-line");
const outputEl = document.getElementById("output");

marked.setOptions({ gfm: true, breaks: false });

const savedKey = localStorage.getItem(KEY_STORAGE);
if (savedKey) {
  keyInput.value = savedKey;
  rememberCheckbox.checked = true;
}

function updateSubmitState() {
  submitButton.disabled = !keyInput.value.trim() || !listInput.value.trim();
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
  if (!apiKey || !produceList) return;

  if (rememberCheckbox.checked) {
    localStorage.setItem(KEY_STORAGE, apiKey);
  } else {
    localStorage.removeItem(KEY_STORAGE);
  }

  submitButton.disabled = true;
  outputSection.hidden = false;
  outputEl.innerHTML = "";
  setStatus("Thinking…");

  try {
    await streamRecipes(apiKey, produceList);
  } catch (err) {
    showError(err);
  } finally {
    updateSubmitState();
  }
});

async function streamRecipes(apiKey, produceList) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: produceList }],
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: MAX_WEB_SEARCHES },
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    let body = "";
    try { body = await response.text(); } catch {}
    throw new ApiError(response.status, body);
  }

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
            setStatus("Searching the web…");
          }
          break;
        }
        case "content_block_delta": {
          const delta = evt.delta;
          if (delta?.type === "text_delta") {
            textBuffer += delta.text;
            renderMarkdown(textBuffer);
            setStatus("Writing…");
          } else if (delta?.type === "input_json_delta") {
            currentToolInput += delta.partial_json || "";
            const m = currentToolInput.match(/"query"\s*:\s*"([^"]*)/);
            if (m) setStatus(`Searching: "${m[1]}"`);
          }
          break;
        }
        case "message_stop": {
          setStatus("");
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
