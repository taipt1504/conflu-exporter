# Release v0.1.0

## 🎉 Initial Release

This is the first official release of **conflu-exporter** - a powerful CLI tool and TypeScript library for exporting Confluence content to Markdown.

## ✨ Features

### Core Functionality
- ✅ Export single Confluence pages to Markdown
- ✅ Export entire Confluence spaces
- ✅ Batch export from JSON/CSV files
- ✅ URL-based export (auto-detect page/space)
- ✅ Full TypeScript support with type definitions

### Content Preservation
- ✅ **Mermaid Diagrams**: Exports as source code in markdown code fences
- ✅ **Full Metadata**: Comprehensive frontmatter with IDs, versions, timestamps
- ✅ **Attachments**: Download images and files at original resolution
- ✅ **Code Blocks**: Language and source code fully preserved
- ✅ **Links**: Preserved with page IDs for future linking
- ✅ **Panels**: Info, warning, note panels converted to blockquotes

### Developer Experience
- ✅ CLI tool with intuitive commands
- ✅ Library API for programmatic usage
- ✅ Multiple authentication methods (env vars, config file, CLI flags)
- ✅ Progress tracking for batch operations
- ✅ Comprehensive error handling
- ✅ Verbose logging mode

### Documentation
- ✅ Installation guide
- ✅ Quick start guide
- ✅ Authentication guide
- ✅ Command reference
- ✅ Configuration reference
- ✅ Troubleshooting guide
- ✅ Use cases & examples
- ✅ Best practices

## 📦 Installation

```bash
# Global installation (CLI)
npm install -g conflu-exporter

# Local installation (Library)
npm install conflu-exporter
```

## 🚀 Quick Start

```bash
# Set up authentication
export CONFLUENCE_BASE_URL="https://your-domain.atlassian.net"
export CONFLUENCE_EMAIL="your-email@example.com"
export CONFLUENCE_TOKEN="your-api-token"

# Export a page
conflu export page 123456

# Export a space
conflu export space MYSPACE

# Export from URL
conflu export url "https://your-domain.atlassian.net/wiki/spaces/TEAM/pages/123456"
```

## 📚 Documentation

Full documentation available at: https://github.com/taipt1504/conflu-exporter

## 🔧 Technical Details

- **Language**: TypeScript 5.3
- **Node.js**: 18+ (tested on 18, 20, 22)
- **Package Manager**: pnpm 10.21.0
- **License**: MIT

## 🙏 Acknowledgments

Built with:
- [Turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown conversion
- [JSDOM](https://github.com/jsdom/jsdom) - DOM manipulation
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Axios](https://github.com/axios/axios) - HTTP client

## 📝 Changelog

See [CHANGELOG.md](https://github.com/taipt1504/conflu-exporter/blob/main/CHANGELOG.md) for detailed changes.

## 🐛 Known Issues

None reported yet. Please report issues at: https://github.com/taipt1504/conflu-exporter/issues

## 🔮 Roadmap

Future enhancements planned:
- PDF export support
- DOCX export support
- Bidirectional sync capability
- Incremental export/update
- Advanced filtering options

---

**Full Changelog**: https://github.com/taipt1504/conflu-exporter/commits/v0.1.0

