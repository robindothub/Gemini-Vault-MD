chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "EXPORT_CHAT") {
    exportChat();
  }
});

function exportChat() {
  const messages = parseDOM();
  if (messages.length === 0) {
    alert("No chat messages found. Please ensure you are on a Gemini chat page.");
    return;
  }

  const markdown = convertToMarkdown(messages);
  syncToClipboard(markdown);
  downloadFile(markdown);
  
  chrome.runtime.sendMessage({ status: "success" });
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
      messages.push({ role, element: el });
    }
  }

  return messages;
}

function convertToMarkdown(messages) {
  let md = "# Gemini Chat Export\n\n";

  messages.forEach(msg => {
    if (msg.role === "User") {
      md += `### 👤 You\n\n${msg.element.textContent.trim()}\n\n`;
    } else if (msg.role === "Model") {
      md += `### 🤖 Gemini\n\n${htmlToMarkdown(msg.element)}\n\n`;
    }
  });

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

function downloadFile(markdown) {
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Gemini_Chat_${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}