chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "EXPORT_CHAT") {
    exportChat().catch((err) => console.error("Gemini-Vault-MD export failed:", err));
  }
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isScrollable(el) {
  if (!el || !(el instanceof Element)) return false;
  const s = getComputedStyle(el);
  const oy = s.overflowY;
  if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") return false;
  return el.scrollHeight > el.clientHeight + 24;
}

function findChatScrollContainers() {
  const roots = new Set();
  const seeds = document.querySelectorAll(
    "user-query, model-response, main, [role='main']"
  );
  for (const seed of seeds) {
    let el = seed.parentElement;
    while (el) {
      if (isScrollable(el)) {
        roots.add(el);
        break;
      }
      if (el === document.documentElement) break;
      el = el.parentElement;
    }
  }
  if (roots.size === 0) {
    const html = document.documentElement;
    const body = document.body;
    if (html && html.scrollHeight > html.clientHeight + 24) roots.add(html);
    if (body && body.scrollHeight > body.clientHeight + 24) roots.add(body);
  }
  return Array.from(roots);
}

/**
 * Gemini virtualizes long threads: off-screen turns are not in the DOM.
 * Only scroll top → bottom (no upward sweeps): oldest content sits at the top,
 * so we jump to scrollTop 0, then step down; the inner loop uses live scrollHeight
 * so if the list grows while scrolling, we keep going. If the overall height still
 * increased across a full pass, repeat from the top once more.
 */
async function ensureConversationRendered(containers) {
  const targets = containers.length ? containers : [document.documentElement];

  for (const container of targets) {
    const pause = 50;
    const step = () =>
      Math.max(180, Math.floor((container.clientHeight || 400) * 0.65));
    const maxPasses = 24;

    for (let pass = 0; pass < maxPasses; pass++) {
      container.scrollTop = 0;
      await delay(pause * 2);
      const heightAfterTop = container.scrollHeight;

      let pos = 0;
      while (pos < container.scrollHeight) {
        container.scrollTop = Math.min(pos, container.scrollHeight);
        await delay(pause);
        pos += step();
      }
      container.scrollTop = container.scrollHeight;
      await delay(pause * 2);

      const heightAfterBottom = container.scrollHeight;
      if (heightAfterBottom <= heightAfterTop) {
        break;
      }
    }

    container.scrollTop = container.scrollHeight;
    await delay(60);
  }
}

function showExportProgress() {
  const el = document.createElement("div");
  el.setAttribute("data-gemini-vault-md", "notice");
  el.textContent = "Gemini-Vault-MD: loading thread (top → bottom)…";
  el.style.cssText =
    "position:fixed;bottom:16px;right:16px;z-index:2147483647;max-width:min(90vw,320px);" +
    "padding:10px 14px;background:#1a1a2e;color:#eee;font:13px system-ui,sans-serif;" +
    "border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.35)";
  document.body.appendChild(el);
  return () => {
    try {
      el.remove();
    } catch (_) {}
  };
}

async function exportChat() {
  const dismiss = showExportProgress();
  try {
    await ensureConversationRendered(findChatScrollContainers());
  } finally {
    dismiss();
  }

  const messages = parseDOM();
  if (messages.length === 0) {
    alert("No chat messages found. Please ensure you are on a Gemini chat page.");
    return;
  }

  const markdown = convertToMarkdown(messages);
  syncToClipboard(markdown);
  downloadFile(markdown, messages);

  chrome.runtime.sendMessage({ status: "success" });
}

function parseTimestampRaw(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n > 1e12) return new Date(n);
  if (n > 1e9) return new Date(n * 1000);
  return null;
}

function extractMessageTimestamp(el) {
  if (!el || !(el instanceof Element)) return null;

  const fromTimeElement = (t) => parseTimestampRaw(t?.getAttribute?.("datetime"));

  const scanAttrs = (node) => {
    if (!node?.attributes) return null;
    for (const attr of node.attributes) {
      const name = attr.name.toLowerCase();
      if (
        /timestamp|datetime|created|sent|time$|absolute|published/i.test(name) &&
        !/timeout|timespent|timescale/i.test(name)
      ) {
        const d = parseTimestampRaw(attr.value);
        if (d && d.getFullYear() >= 2000 && d.getFullYear() < 2100) return d;
      }
    }
    return null;
  };

  const directTime = el.querySelector("time[datetime]");
  if (directTime) {
    const d = fromTimeElement(directTime);
    if (d) return d;
  }

  const onEl = scanAttrs(el);
  if (onEl) return onEl;

  let node = el;
  for (let depth = 0; depth < 12 && node; depth++) {
    const par = node.parentElement;
    if (!par) break;

    const idx = Array.prototype.indexOf.call(par.children, node);
    if (idx >= 0) {
      const lo = Math.max(0, idx - 2);
      const hi = Math.min(par.children.length - 1, idx + 2);
      for (let j = lo; j <= hi; j++) {
        if (j === idx) continue;
        const child = par.children[j];
        if (child.matches?.("time[datetime]")) {
          const d = fromTimeElement(child);
          if (d) return d;
        }
        const nested = child.querySelector?.(":scope time[datetime]");
        if (nested) {
          const d = fromTimeElement(nested);
          if (d) return d;
        }
        const da = scanAttrs(child);
        if (da) return da;
      }
    }

    const scopeTimes = node.querySelectorAll?.("time[datetime]");
    if (scopeTimes?.length) {
      for (const t of scopeTimes) {
        const d = fromTimeElement(t);
        if (d) return d;
      }
    }

    node = par;
  }

  return null;
}

function formatMessageTimeLocal(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(date);
  } catch (_) {
    return date.toLocaleString();
  }
}

function messageTimestampLine(msg) {
  const ts =
    msg.timestamp instanceof Date && !Number.isNaN(msg.timestamp.getTime())
      ? msg.timestamp
      : extractMessageTimestamp(msg.element);
  const label = ts ? formatMessageTimeLocal(ts) : "";
  return label ? `*${label}*\n\n` : "";
}

function parseDOM() {
  // Match turn roots and inner wrappers; Gemini nests several nodes per message
  // (e.g. <user-query> plus inner divs with user-query in class or data-message-author-role).
  // Without deduping, the same turn is exported many times.
  const selector =
    'user-query, model-response, [class*="user-query"], [class*="model-response"], [data-message-author-role="user"], [data-message-author-role="model"]';
  const candidates = Array.from(document.querySelectorAll(selector));

  const roots = candidates.filter(
    (el) => !candidates.some((other) => other !== el && other.contains(el))
  );

  roots.sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  const messages = [];
  for (const el of roots) {
    let role = "Unknown";
    const tagName = el.tagName.toLowerCase();
    const className = typeof el.className === "string" ? el.className : "";
    const roleAttr = el.getAttribute("data-message-author-role");

    if (tagName === "user-query" || className.includes("user-query") || roleAttr === "user") {
      role = "User";
    } else if (
      tagName === "model-response" ||
      className.includes("model-response") ||
      roleAttr === "model"
    ) {
      role = "Model";
    }

    if (role !== "Unknown") {
      const timestamp = extractMessageTimestamp(el);
      messages.push({
        role,
        element: el,
        timestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null,
      });
    }
  }

  return messages;
}

function convertToMarkdown(messages) {
  let md = "# Gemini Chat Export\n\n";

  for (const msg of messages) {
    const when = messageTimestampLine(msg);
    if (msg.role === "User") {
      md += `### 👤 You\n\n${when}${msg.element.textContent.trim()}\n\n`;
    } else if (msg.role === "Model") {
      md += `### 🤖 Gemini\n\n${when}${htmlToMarkdown(msg.element)}\n\n`;
    }
  }

  return md;
}

function htmlToMarkdown(element) {
  let text = "";

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      
      switch (tag) {
        case 'p':
        case 'div':
          Array.from(node.childNodes).forEach(traverse);
          text += '\n\n';
          break;
        case 'strong':
        case 'b':
          text += '**';
          Array.from(node.childNodes).forEach(traverse);
          text += '**';
          break;
        case 'em':
        case 'i':
          text += '*';
          Array.from(node.childNodes).forEach(traverse);
          text += '*';
          break;
        case 'code':
          if (node.parentNode && node.parentNode.tagName.toLowerCase() === 'pre') {
            Array.from(node.childNodes).forEach(traverse);
          } else {
            text += '`';
            Array.from(node.childNodes).forEach(traverse);
            text += '`';
          }
          break;
        case 'pre':
          text += '\n```\n';
          Array.from(node.childNodes).forEach(traverse);
          text += '\n```\n\n';
          break;
        case 'ul':
          Array.from(node.children).forEach(child => {
            if (child.tagName.toLowerCase() === 'li') {
              text += '- ';
              Array.from(child.childNodes).forEach(traverse);
              text += '\n';
            }
          });
          text += '\n';
          break;
        case 'ol':
          Array.from(node.children).forEach((child, index) => {
            if (child.tagName.toLowerCase() === 'li') {
              text += `${index + 1}. `;
              Array.from(child.childNodes).forEach(traverse);
              text += '\n';
            }
          });
          text += '\n';
          break;
        case 'a':
          text += '[';
          Array.from(node.childNodes).forEach(traverse);
          text += `](${node.href})`;
          break;
        case 'table':
          text += '\n';
          Array.from(node.children).forEach(child => traverse(child));
          text += '\n';
          break;
        case 'thead':
        case 'tbody':
          Array.from(node.children).forEach(child => traverse(child));
          break;
        case 'tr':
          text += '| ';
          let isHeader = false;
          Array.from(node.children).forEach(child => {
            if (child.tagName.toLowerCase() === 'th') isHeader = true;
            traverse(child);
            text += ' | ';
          });
          text += '\n';
          if (isHeader) {
            text += '|';
            Array.from(node.children).forEach(() => {
              text += '---|';
            });
            text += '\n';
          }
          break;
        case 'th':
        case 'td':
          Array.from(node.childNodes).forEach(traverse);
          break;
        default:
          Array.from(node.childNodes).forEach(traverse);
      }
    }
  }

  traverse(element);
  
  // Clean up excessive newlines
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function syncToClipboard(markdown) {
  navigator.clipboard.writeText(markdown).then(() => {
    console.log("Markdown successfully copied to clipboard.");
  }).catch(err => {
    console.error("Failed to copy markdown to clipboard: ", err);
  });
}

function getConversationIdFromUrl() {
  return window.location.pathname.match(/\/app\/([^/?#]+)/)?.[1] || "";
}

function isPlausibleChatTitle(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  if (t.length === 0 || t.length > 200) return false;
  const low = t.toLowerCase();
  const bad = ["untitled", "google", "recent", "gemini", "new chat", "new conversation"];
  if (bad.includes(low)) return false;
  return true;
}

/** UI labels like "对话 / Chat" are not the real topic — use first user turn instead. */
function isGenericOrPlaceholderTitle(text) {
  if (!text || typeof text !== "string") return true;
  const t = text.trim();
  if (t.length === 0) return true;
  const low = t.toLowerCase();
  const generic = new Set([
    "untitled",
    "google",
    "recent",
    "gemini",
    "new chat",
    "new conversation",
    "对话",
    "聊天",
    "新对话",
    "会话",
    "chat",
    "chats",
    "conversation",
    "conversations",
  ]);
  if (generic.has(low)) return true;
  return false;
}

/** First user message text as topic preview (Gemini names chats from this; also covers generic sidebar titles). */
function deriveTopicFromFirstUserMessage(messages) {
  const first = messages.find((m) => m.role === "User");
  if (!first?.element) return "";
  let raw = first.element.textContent.replace(/\s+/g, " ").trim();
  if (!raw) return "";
  return raw.slice(0, 100);
}

/** Prefer real sidebar/tab title; if it is only a generic label, use the first user prompt as the file prefix. */
function resolveTopicForFilename(messages) {
  const ui = getConversationTitle();
  if (ui && !isGenericOrPlaceholderTitle(ui)) {
    return ui;
  }
  const fromFirst = deriveTopicFromFirstUserMessage(messages);
  if (fromFirst) {
    return fromFirst;
  }
  if (ui) {
    return ui;
  }
  return "";
}

/** Prefer left sidebar name (matches current /app/{id} via jslog), then main heading, then tab title. */
function getConversationTitle() {
  const trySidebar = () => {
    const id = getConversationIdFromUrl();
    if (!id) return "";
    const items = document.querySelectorAll("div.conversation-items-container");
    for (const item of items) {
      const btn = item.querySelector('div[role="button"]');
      const jslog = btn?.getAttribute("jslog") ?? "";
      if (jslog && jslog.includes(id)) {
        try {
          item.scrollIntoView({ block: "nearest", behavior: "auto" });
        } catch (_) {}
        const titleEl = item.querySelector("div.conversation-title");
        const t = titleEl?.textContent?.trim() ?? "";
        if (isPlausibleChatTitle(t)) return t;
        break;
      }
    }
    return "";
  };

  const tryHeader = () => {
    const el = document.querySelector('main h1, main h2, main [role="heading"]');
    const t = el?.textContent?.trim() ?? "";
    return isPlausibleChatTitle(t) ? t : "";
  };

  const tryDocTitle = () => {
    let t = document.title
      .replace(/\s*-\s*Google\s*Gemini\s*$/i, "")
      .replace(/\s*\|\s*Gemini\s*$/i, "")
      .trim();
    if (/^gemini$/i.test(t)) t = "";
    return isPlausibleChatTitle(t) ? t : "";
  };

  return trySidebar() || tryHeader() || tryDocTitle() || "";
}

function sanitizeFileNameBase(name) {
  const cleaned = name
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned.slice(0, 120) || "Gemini_Chat";
}

/** Wall clock in the browser's local timezone: YYYY-MM-DD_HH-mm-ss */
function formatLocalTimestampForFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function buildExportFileName(messages) {
  const title = sanitizeFileNameBase(resolveTopicForFilename(messages));
  const stamp = formatLocalTimestampForFilename();
  return `${title}_${stamp}.md`;
}

function downloadFile(markdown, messages) {
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildExportFileName(messages);
  a.click();
  URL.revokeObjectURL(url);
}