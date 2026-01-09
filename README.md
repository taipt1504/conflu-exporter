# Confluence Exporter

<div align="center">
  <img src="extension/public/icons/logo_final.png" alt="Confluence Exporter Logo" width="128" height="128" />
  
  <h3>The Ultimate Confluence to Markdown Suite</h3>
  <p>
    Create high-fidelity Markdown exports from Confluence Server & Cloud.<br>
    Available as a <b>Browser Extension</b> for individuals and a <b>CLI/Library</b> for automation.
  </p>

  <p>
    <a href="https://chrome.google.com/webstore/detail/your-id">
      <img src="https://img.shields.io/badge/Chrome_Web_Store-Available-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Chrome Extension" />
    </a>
    <a href="https://www.npmjs.com/package/conflu-exporter">
      <img src="https://img.shields.io/badge/NPM_Package-v1.3.1-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="NPM Package" />
    </a>
  </p>
</div>

---

## 🎯 Choose Your Tool

| Feature | [**Browser Extension**](extension/README.md) | [**CLI / Library**](#-cli-tool) |
| :--- | :--- | :--- |
| **Best For** | Manual exports, quick tasks, non-technical users | CI/CD, Bulk operations, Scheduled backups |
| **Usage** | 1-Click via Chrome Toolbar | Terminal or Node.js scripts |
| **Setup** | Install from Store | `npm install -g` |
| **Auth** | Log in via Browser (Cookies) | API Token / Environment Variables |
| **Fidelity** | ⭐⭐⭐⭐⭐ (Hybrid Extraction) | ⭐⭐⭐⭐ (API Content) |
| **Attachments** | ✅ Downloads with file | ✅ Downloads to folder |

---

## 🧩 Browser Extension

The easiest way to export pages. Just navigate to a page and click export.

- **Download:** [Chrome Web Store](#) (Link pending)
- **Documentation:** [Read Extension Docs](extension/README.md)
- **Source:** [`/extension`](extension/)

---

## 💻 CLI Tool

A powerful command-line interface for exporting Confluence pages and spaces to Markdown. Ideal for migration scripts and backups.

### Installation

```bash
# Global Install
npm install -g conflu-exporter

# Local Install
npm install conflu-exporter
```

### Quick Usage

**1. Set Credentials** (Optional but recommended)
```bash
export CONFLUENCE_BASE_URL="https://your-domain.atlassian.net"
export CONFLUENCE_EMAIL="your-email@example.com"
export CONFLUENCE_TOKEN="your-api-token"
```

**2. Export a Page**
```bash
conflu export page 123456
```

**3. Export a Space**
```bash
conflu export space ENGINEERING --include-attachments
```

**4. Batch Export** from file
```bash
conflu export batch list-of-pages.json
```

[> View Full CLI Documentation](docs/COMMAND_REFERENCE.md)

---

## ✨ Core Features (Both Versions)

- **Mermaid Diagrams:** automatically converts Confluence Mermaid plugins into native Markdown `mermaid` code blocks.
- **Smart Code Blocks:** Preserves syntax highlighting, newlines, and spacing from `code` and `noformat` macros.
- **Table Handling:** Converts complex Confluence tables into standard GFM Markdown tables.
- **Metadata:** Adds YAML frontmatter (author, date, labels) to every exported file.
- **Secure:** Your data stays local. We communicate directly with your Confluence instance.

---

## 📦 Library Usage (for Developers)

You can use the core logic as a library in your own Node.js applications.

```typescript
import { ConfluenceExporter } from 'conflu-exporter'

const exporter = new ConfluenceExporter({
  baseUrl: 'https://my-org.atlassian.net',
  auth: {
    username: 'me@example.com',
    token: process.env.API_TOKEN
  }
})

// Export a page properly
const page = await exporter.exportPage('123456')
console.log(page.markdown)
```

---

## 🛠 Project Structure

This is a monorepo containing both the Core logic and the Extension.

```
conflu-exporter/
├── bin/                  # CLI Entry point
├── src/                  # Core Library & CLI Logic
├── extension/            # Browser Extension Source
├── dist/                 # Compiled Library
├── dist-extension/       # Compiled Extension
└── docs/                 # Detailed Documentation
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
