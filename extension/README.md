# Confluence Exporter - Chrome Extension

A Chrome extension for exporting Confluence pages to Markdown format with support for Mermaid diagrams, attachments, and batch operations.

## ✨ Features

- **Single Page Export** - Export any Confluence page to Markdown
- **Space Export** - Export all pages in a Confluence space
- **Batch Export** - Export multiple pages at once
- **Attachments** - Download images and attachments
- **Mermaid Diagrams** - Preserve diagram source as code blocks
- **Context Menu** - Right-click on any Confluence page to export
- **Auto-detect** - Automatically detects page ID/space key from current URL

## 🚀 Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Click "Add to Chrome"

### Manual Installation (Development)

1. **Clone and build the extension:**
   ```bash
   git clone https://github.com/your-repo/conflu-exporter.git
   cd conflu-exporter
   pnpm install
   pnpm build:extension
   ```

2. **Load in Chrome:**
   - Open Chrome → `chrome://extensions`
   - Enable **"Developer mode"** (top right)
   - Click **"Load unpacked"**
   - Select the `dist-extension/` folder

3. **Verify installation:**
   - Extension icon should appear in toolbar
   - No errors in chrome://extensions

## ⚙️ Configuration

1. Click the extension icon in the toolbar
2. Click **"⚙️ Configure Settings"** at the bottom
3. Enter your Confluence credentials:
   - **Confluence URL**: `https://your-domain.atlassian.net`
   - **Email**: Your Atlassian account email
   - **API Token**: Generate at [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
4. Click **"Test Connection"** to verify
5. Click **"Save Settings"**

## 📤 Usage

### Single Page Export
1. Navigate to a Confluence page
2. Click the extension icon
3. Page ID is auto-detected
4. Toggle options (attachments, child pages)
5. Click **"Export Page"**

### Space Export
1. Click the extension icon
2. Select the **"Space"** tab
3. Enter the space key (e.g., `DOCS`)
4. Click **"Export Entire Space"**

### Batch Export
1. Click the extension icon
2. Select the **"Batch"** tab
3. Enter page IDs or URLs (one per line)
4. Click **"Export X Pages"**

### Context Menu
1. Right-click on any Confluence page
2. Select **"Export to Markdown"**
3. File downloads automatically

## 📁 Output

Exported files are saved to your default Downloads folder:
- `Page-Title.md` - Markdown file with frontmatter
- `attachments/` - Images and files (if enabled)

### Frontmatter Example
```yaml
---
id: "123456"
title: "My Page Title"
space: "DOCS"
version: 5
labels: ["documentation", "guide"]
created_by: "John Doe"
created_at: "2024-01-15T10:30:00Z"
url: "https://your-domain.atlassian.net/wiki/spaces/DOCS/pages/123456"
---
```

## 🔒 Security

- API tokens are stored securely in Chrome's encrypted storage
- No data is sent to third-party servers
- All communication is directly with your Confluence instance

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Watch for changes (development)
pnpm watch:extension

# Build for production
pnpm build:extension

# Package for Chrome Web Store
pnpm package:extension
```

## 🐛 Troubleshooting

### "Connection failed" error
- Verify your Confluence URL includes `https://`
- Check that your email and API token are correct
- Ensure you have read access to the space/pages

### Export takes too long
- Large pages with many attachments take longer
- Try exporting without attachments first
- Check your network connection

### Context menu not appearing
- Reload the extension in chrome://extensions
- Refresh the Confluence page
- Check for console errors in the service worker

## 📝 License

MIT License - see [LICENSE](../LICENSE)
