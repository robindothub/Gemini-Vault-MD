# Gemini-Vault-MD ♊️ ➡️ 📝

[English](#english) | [中文说明](#chinese)

---

<a name="english"></a>
## 🌍 English

**Gemini-Vault-MD** is a lightweight, 100% private browser extension designed to export your Gemini conversations into clean, structured Markdown. 

### 🚀 New Features
* **Double Export Mode**: 
    * **Auto-Download**: Instantly saves your chat as a `.md` file with a local timestamp.
    * **Sync to Clipboard**: Automatically copies the content to your clipboard for quick pasting into Obsidian/Notion.
* **Selection Aware**: Intelligently parses user queries and model responses.
* **Zero Data Collection**: No APIs, no servers. Your data stays on your machine.

### 🛠 Installation
1. Download or clone this project folder.
2. Go to `chrome://extensions/` in your browser (Chrome, Edge, or other Chromium-based browsers).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the **project root folder** (the one that contains `manifest.json`).

### 📦 Packaging (release ZIP)
From the project root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\package.ps1
```

This creates `dist/Gemini-Vault-MD-v{version}.zip` with `manifest.json`, scripts, and `icons/` at the root of the archive—suitable for sharing or for [Chrome Web Store](https://chrome.google.com/webstore/devconsole) uploads. To install locally from the ZIP, extract it to a folder, then use **Load unpacked** on that folder.

### ▶️ How to use
1. Open [Gemini](https://gemini.google.com/) and go to a chat (new or existing).
2. Click the **Gemini-Vault-MD** icon in the browser toolbar.
3. The full conversation is exported as Markdown: a **`.md` file downloads** automatically, and the same text is **copied to the clipboard** (paste into Obsidian, Notion, VS Code, etc.).
4. If nothing is exported, stay on a chat page and ensure the page has finished loading; Gemini’s layout can change over time.

---

<a name="chinese"></a>
## 🏮 中文说明

**Gemini-Vault-MD** 是一款轻量级、100% 隐私安全的浏览器扩展，旨在将你的 Gemini 对话完美导出为 Markdown 格式。

### 🚀 新增功能
* **双重导出模式**：
    * **自动下载**：点击图标即刻生成带时间戳的 `.md` 文件并下载到本地。
    * **同步剪贴板**：内容会自动存入系统剪贴板，方便快速粘贴到 Obsidian、Notion 或 Logseq。
* **智能解析**：精准区分用户提问（User）与 Gemini 回答（Model），保持排版整洁。
* **隐私护航**：零 API 调用，无后台服务器，数据转换完全在浏览器本地内存完成。

### 🛠 安装步骤
1. 下载或克隆本项目到本地。
2. 在浏览器地址栏打开 `chrome://extensions/`（Chrome、Edge 等 Chromium 内核浏览器均可）。
3. 打开右上角**开发者模式**。
4. 点击**加载已解压的扩展程序**，选择**含有 `manifest.json` 的项目根目录**。

### 📦 打包脚本（发布用 ZIP）
在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\package.ps1
```

会在 `dist` 目录下生成 `Gemini-Vault-MD-v{版本号}.zip`，压缩包根目录即为扩展结构（`manifest.json`、`background.js`、`content.js`、`icons/`），便于分发或提交 [Chrome 网上应用店](https://chrome.google.com/webstore/devconsole)。若要从 ZIP 本地安装，请先解压到任意文件夹，再对该文件夹执行**加载已解压的扩展程序**。

### ▶️ 如何使用扩展
1. 打开 [Gemini](https://gemini.google.com/) 并进入一段对话（新建或历史会话均可）。
2. 点击浏览器工具栏中的 **Gemini-Vault-MD** 扩展图标。
3. 当前会话会以 Markdown 导出：**自动下载**带时间戳的 `.md` 文件，同时内容会**写入系统剪贴板**，可直接粘贴到 Obsidian、Notion、VS Code 等。
4. 若无反应，请确认停留在对话页面且页面已加载完成；Google 可能调整页面结构，若遇解析问题可反馈或自行更新选择器。

---

## 🛡️ Privacy Statement / 隐私声明
This extension does not connect to any external servers.
本扩展程序不会连接任何外部服务器。你的对话数据仅在本地处理，绝不外传。

## 📄 License
Licensed under [MIT](./LICENSE).
