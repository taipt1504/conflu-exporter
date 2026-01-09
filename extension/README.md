# Confluence Exporter - Browser Extension

<div align="center">
  <img src="public/icons/logo_final.png" alt="Confluence Exporter Logo" width="128" height="128" />
  
  <h3>The Ultimate Confluence to Markdown Tool</h3>
  <p>
    Create exact, high-fidelity Markdown exports from Confluence Server & Cloud.<br>
    Preserve diagrams, code blocks, tables, and formatting with 100% accuracy.
  </p>

  <p>
    <a href="https://chrome.google.com/webstore/detail/your-id">Add to Chrome</a> •
    <a href="#-features">Features</a> •
    <a href="#-installation">Installation</a> •
    <a href="#-development">Development</a>
  </p>
</div>

---

## 📖 Overview

**Confluence Exporter** is a professional-grade browser extension designed to extract documentation from Atlassian Confluence into standard Markdown format. Unlike simple HTML-to-Text converters, this engine prioritizes **fidelity**—ensuring that complex elements like **Mermaid diagrams**, **Code Blocks**, **Tables**, and **Technical Macros** are preserved exactly as they appear.

Perfect for:
- Migrating documentation to **Obsidian/Notion/Git**.
- Backing up Spaces for offline access.
- Converting technical specs into **Git-managed Markdown**.

---

## ✨ Key Features

### 🔍 High-Fidelity Conversion
- **Smart Code Extraction:** Automatically detects `code` and `noformat` macros, preserving syntax highlighting, newlines, and spacing. No more collapsed text dump.
- **Mermaid JS Support:** Seamlessly converts Confluence Mermaid plugins into native Markdown `mermaid` code blocks.
- **Table Preservation:** Handles complex tables (merged cells, headers) and converts them to GFM (GitHub Flavored Markdown) tables.

### ⚡ Powerful Export Modes
| Mode | Description |
|------|-------------|
| **Single Page** | Quick export of the current page with 2 clicks. |
| **Space Export** | Bulk export an entire Knowledge Base or Project Space. |
| **Batch Export** | Feed a list of URLs/IDs and export them sequentially. |
| **Context Menu** | Right-click any link or page background to "Export to Markdown". |

### 🛠 Technical Capabilities
- **Direct API Integration:** Communicates directly with Confluence API for metadata and content.
- **Asset Handling:** Downloads all attachments and images, rewriting links to be relative for offline viewing.
- **Frontmatter injection:** Adds YAML frontmatter (author, date, labels, version) to every file.
- **Secure:** API Tokens are stored in encrypted browser storage. No data leaves your local machine.

---

## 🚀 Installation

### Option 1: Chrome Web Store (Recommended)
1. Visit the **[Chrome Web Store Page](#)** (Link pending).
2. Click **Add to Chrome**.
3. Pin the extension to your toolbar.

### Option 2: Manual / Developer Build
1. **Clone the repository:**
   ```bash
   git clone https://github.com/taipt1504/conflu-exporter.git
   cd conflu-exporter
   ```
2. **Install & Build:**
   ```bash
   pnpm install
   pnpm build:extension
   # Output is created in /dis-extension folder
   ```
3. **Load Unpacked:**
   - Go to `chrome://extensions`
   - Enable **Developer Mode** (top right toggle).
   - Click **Load Unpacked** and select the `dist-extension` folder.

---

## ⚙️ Configuration Setup

Before first use, you must authenticate with your Confluence instance.

1. Click the **Extension Icon** → **Settings (⚙️)**.
2. Enter your credentials:
   - **Domain:** `https://your-company.atlassian.net`
   - **Email:** Your Atlassian login email.
   - **API Token:** [Create a Token Here](https://id.atlassian.com/manage-profile/security/api-tokens).
3. Click **Test Connection**. A ✅ Success message confirms access.
4. Save.

> **Note:** For Confluence Server (On-Prem), use your username and password instead of Email/Token.

---

## 🎨 Troubleshooting & FAQ

**Q: My code blocks look weird or are missing?**  
A: Ensure you are on the latest version. We use a **hybrid extraction engine** that reads the raw Storage Format to guarantee code block fidelity, bypassing browser rendering issues.

**Q: "Connection Failed" error?**  
A: Double-check your Domain URL. It must include `https://` and (usually) end with `.atlassian.net` for Cloud. For server, ensure you are on the VPN.

**Q: Why are images missing in my markdown viewer?**  
A: The extension downloads images to an `attachments/` subfolder. Ensure your Markdown viewer (Obsidian/VSCode) is configured to look for relative assets.

---

## 🏗 Architecture

This extension shares its core logic with the `conflu-exporter` CLI tool but is optimized for the browser environment.

- **Frontend:** React + Tailwind CSS
- **Build Tool:** Vite
- **Markdown Engine:** Turndown + Custom Plugins (GFM)
- **State Management:** Chrome Storage API

---

## 📝 License
Copyright © 2024 TaiPhan.
Released under the MIT License.
