# Command Reference

Complete reference for all `conflu-exporter` commands.

## Table of Contents

- [Global Options](#global-options)
- [export page](#export-page)
- [export space](#export-space)
- [export batch](#export-batch)
- [export url](#export-url)
- [config commands](#config-commands)

## Global Options

Options available for all commands:

```bash
conflu [options] [command]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--version` | `-V` | Output version number |
| `--verbose` | `-v` | Enable verbose logging |
| `--quiet` | `-q` | Suppress all output except errors |
| `--help` | `-h` | Display help for command |

**Examples**:

```bash
# Show version
conflu --version

# Run with verbose logging
conflu --verbose export page 123456

# Suppress non-error output
conflu --quiet export space TEAM
```

---

## export page

Export a single Confluence page by ID.

### Usage

```bash
conflu export page <pageId> [options]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `pageId` | Confluence page ID | Yes |

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--format <type>` | `-f` | Export format: `markdown\|pdf\|docx` | `markdown` |
| `--output <dir>` | `-o` | Output directory | `./exports` |
| `--email <email>` | `-e` | Confluence account email | - |
| `--token <token>` | `-t` | API token | - |
| `--base-url <url>` | `-u` | Confluence base URL | - |
| `--include-attachments` | - | Download and include attachments | `false` |
| `--include-children` | - | Export child pages recursively | `false` |
| `--dry-run` | - | Preview without executing | `false` |

### Examples

**Basic page export**:
```bash
conflu export page 123456
```

**With attachments**:
```bash
conflu export page 123456 --include-attachments
```

**Custom output directory**:
```bash
conflu export page 123456 -o ./my-exports
```

**With credentials** (if not set via environment/config):
```bash
conflu export page 123456 \
  -u https://your-company.atlassian.net \
  -e your-email@company.com \
  -t YOUR_TOKEN
```

**Dry run** (preview only):
```bash
conflu export page 123456 --dry-run
```

Output:
```
--- DRY RUN MODE ---
Would export page: Getting Started Guide
Format: markdown
Output: ./exports
Space: TEAM
Include attachments: false
```

**Verbose mode**:
```bash
conflu export page 123456 --verbose
```

### Output

The command creates:

```
exports/
├── SPACE-KEY/
│   ├── page-title.md          # Exported page
│   └── assets/                 # (if --include-attachments)
│       └── 123456/
│           ├── image1.png
│           └── diagram.svg
└── manifest.json               # Export metadata
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (authentication, network, export failure) |

---

## export space

Export all pages from a Confluence space.

### Usage

```bash
conflu export space <spaceKey> [options]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `spaceKey` | Confluence space key (e.g., "TEAM", "DEV") | Yes |

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--format <type>` | `-f` | Export format: `markdown\|pdf\|docx` | `markdown` |
| `--output <dir>` | `-o` | Output directory | `./exports` |
| `--email <email>` | `-e` | Confluence account email | - |
| `--token <token>` | `-t` | API token | - |
| `--base-url <url>` | `-u` | Confluence base URL | - |
| `--include-attachments` | - | Download and include attachments | `false` |
| `--include-children` | - | Export child pages recursively | `false` |
| `--flat` | - | Flat structure (no hierarchy) | `false` |
| `--dry-run` | - | Preview without executing | `false` |

### Examples

**Export entire space**:
```bash
conflu export space TEAM
```

**Include child pages** (hierarchical export):
```bash
conflu export space TEAM --include-children
```

**With attachments**:
```bash
conflu export space TEAM --include-attachments
```

**Flat structure** (all files in one directory):
```bash
conflu export space TEAM --flat
```

**Dry run** (preview):
```bash
conflu export space TEAM --dry-run
```

Output:
```
--- DRY RUN MODE ---
Would export 47 pages from space: TEAM
Format: markdown
Output: ./exports
Include attachments: false
Include children: false
Structure: hierarchical

Pages to export:
  - Getting Started (123456)
  - API Reference (789012)
  - Architecture Guide (345678)
  ... and 44 more
```

**Complete example with all options**:
```bash
conflu export space TEAM \
  -o ./team-docs \
  --include-attachments \
  --include-children \
  --verbose
```

### Output

Hierarchical structure (default):
```
exports/
└── TEAM/
    ├── getting-started.md
    ├── api-reference.md
    ├── parent-page/
    │   ├── index.md
    │   └── child-page.md
    ├── assets/
    │   ├── 123456/
    │   │   └── image.png
    │   └── 789012/
    │       └── diagram.svg
    └── manifest.json
```

Flat structure (`--flat`):
```
exports/
└── TEAM/
    ├── getting-started.md
    ├── api-reference.md
    ├── parent-page.md
    ├── child-page.md
    ├── assets/
    └── manifest.json
```

### Progress Output

During export, you'll see progress for each page:

```
Starting export of space TEAM...
Testing API connection...
✓ Connected to Confluence API
Fetching pages from space TEAM...
✓ Found 47 pages in space
Converting and saving 47 pages...

[1/47] Processing: Getting Started (123456)
  ✓ Saved: Getting Started

[2/47] Processing: API Reference (789012)
  ✓ Saved: API Reference (5 attachments)

[3/47] Processing: Architecture Guide (345678)
  ✓ Saved: Architecture Guide

...

✓ Space export complete!

Export summary:
  Space: TEAM
  Total pages: 47
  Successful: 47
  Output: ./exports
```

### Performance

- **Concurrency**: Up to 5 pages processed in parallel
- **Rate Limiting**: Automatic rate limit handling
- **Large spaces**: Paginated fetching (50 pages per request)

**Estimated time**:
- 10 pages: ~30 seconds
- 50 pages: ~2 minutes
- 100 pages: ~4 minutes
- 500 pages: ~20 minutes

(With `--include-attachments`, time increases based on file sizes)

---

## export batch

Export multiple pages from a JSON or CSV file.

### Usage

```bash
conflu export batch <file> [options]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `file` | Path to JSON or CSV file | Yes |

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--format <type>` | `-f` | Export format: `markdown\|pdf\|docx` | `markdown` |
| `--output <dir>` | `-o` | Output directory | `./exports` |
| `--email <email>` | `-e` | Confluence account email | - |
| `--token <token>` | `-t` | API token | - |
| `--base-url <url>` | `-u` | Confluence base URL | - |
| `--include-attachments` | - | Download and include attachments | `false` |
| `--dry-run` | - | Preview without executing | `false` |

### Input File Formats

#### JSON Format

```json
[
  {
    "pageId": "123456",
    "title": "Getting Started"
  },
  {
    "pageId": "789012",
    "title": "API Reference"
  },
  {
    "pageId": "345678"
  }
]
```

**Fields**:
- `pageId` (required): Confluence page ID
- `title` (optional): Page title for reference

#### CSV Format

```csv
pageId,title
123456,Getting Started
789012,API Reference
345678
```

**Format**:
- First row: Header (optional, detected automatically)
- Column 1: `pageId` (required)
- Column 2: `title` (optional)

### Examples

**From JSON file**:
```bash
conflu export batch pages.json
```

**From CSV file**:
```bash
conflu export batch pages.csv
```

**With attachments**:
```bash
conflu export batch pages.json --include-attachments
```

**Custom output**:
```bash
conflu export batch pages.json -o ./batch-exports
```

**Dry run**:
```bash
conflu export batch pages.json --dry-run
```

Output:
```
--- DRY RUN MODE ---
Would export 3 pages
Format: markdown
Output: ./exports
Include attachments: false

Pages to export:
  - 123456 (Getting Started)
  - 789012 (API Reference)
  - 345678
```

### Creating Batch Files

**Quick JSON generation**:
```bash
cat > pages.json << 'EOF'
[
  {"pageId": "123456", "title": "Page 1"},
  {"pageId": "789012", "title": "Page 2"}
]
EOF
```

**Quick CSV generation**:
```bash
cat > pages.csv << 'EOF'
pageId,title
123456,Page 1
789012,Page 2
EOF
```

**From space (get all page IDs)**:
```bash
# Export space first
conflu export space TEAM --dry-run > space-info.txt

# Extract page IDs and create batch file
# (manual process or script)
```

### Output

Progress for each page:

```
Starting batch export from pages.json...
Reading batch file...
✓ Found 3 pages to export
Testing API connection...
✓ Connected to Confluence API
Exporting 3 pages...

[1/3] Fetching page 123456...
[1/3] Processing: Getting Started
  ✓ Saved: Getting Started

[2/3] Fetching page 789012...
[2/3] Processing: API Reference
  ✓ Saved: API Reference (3 attachments)

[3/3] Fetching page 345678...
[3/3] Processing: Troubleshooting Guide
  ✓ Saved: Troubleshooting Guide

✓ Batch export complete!

Export summary:
  Total pages: 3
  Successful: 3
  Output: ./exports
```

### Error Handling

If some pages fail:

```
Export summary:
  Total pages: 10
  Successful: 8
  Failed: 2
  Output: ./exports

⚠ Some pages failed to export. Check logs for details.

Failed pages:
  - 999999: Page not found
  - 888888: Permission denied
```

Exit code: `1` (partial failure)

The manifest.json will include error details:

```json
{
  "summary": {
    "total": 10,
    "successful": 8,
    "failed": 2
  },
  "errors": [
    {"pageId": "999999", "error": "Page not found"},
    {"pageId": "888888", "error": "Permission denied"}
  ]
}
```

---

## export url

Export page or space from a Confluence URL (auto-detects type).

### Usage

```bash
conflu export url <url> [options]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `url` | Confluence page or space URL | Yes |

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--format <type>` | `-f` | Export format: `markdown\|pdf\|docx` | `markdown` |
| `--output <dir>` | `-o` | Output directory | `./exports` |
| `--email <email>` | `-e` | Confluence account email | - |
| `--token <token>` | `-t` | API token | - |
| `--include-attachments` | - | Download and include attachments | `false` |
| `--include-children` | - | Export child pages recursively (for pages or spaces) | `false` |
| `--dry-run` | - | Preview without executing | `false` |

### Supported URL Formats

**Page URL**:
```
https://company.atlassian.net/wiki/spaces/TEAM/pages/123456/Page+Title
https://company.atlassian.net/wiki/spaces/TEAM/pages/123456
```

**Space URL**:
```
https://company.atlassian.net/wiki/spaces/TEAM/overview
https://company.atlassian.net/wiki/spaces/TEAM
```

### Examples

**Export from page URL**:
```bash
conflu export url "https://company.atlassian.net/wiki/spaces/TEAM/pages/123456/Getting+Started"
```

Output:
```
Parsing Confluence URL...
✓ Detected page export from https://company.atlassian.net
Exporting page 123456...
```

**Export from space URL**:
```bash
conflu export url "https://company.atlassian.net/wiki/spaces/TEAM/overview"
```

Output:
```
Parsing Confluence URL...
✓ Detected space export from https://company.atlassian.net
Exporting space TEAM...
```

**With attachments**:
```bash
conflu export url "https://company.atlassian.net/wiki/spaces/TEAM/pages/123456" \
  --include-attachments
```

**Note about base URL**:

The base URL is automatically extracted from the page URL. You only need to provide `--email` and `--token` if not set via environment or config:

```bash
conflu export url "https://company.atlassian.net/wiki/spaces/TEAM/pages/123456" \
  -e your-email@company.com \
  -t YOUR_TOKEN
```

### URL Parsing

The command automatically:
1. Extracts base URL: `https://company.atlassian.net`
2. Detects type: `page` or `space`
3. Extracts ID: `123456` (page) or `TEAM` (space)
4. Delegates to appropriate command

---

## config commands

Configuration management commands (coming soon).

### config init

Initialize configuration file interactively.

```bash
conflu config init
```

(Not yet implemented - use manual config file creation)

### config show

Display current configuration.

```bash
conflu config show
```

(Not yet implemented - use `cat ~/.conflurc`)

### config test

Test API connection.

```bash
conflu config test
```

(Not yet implemented - use `conflu export page <id> --dry-run`)

---

## Common Patterns

### Export with Full Fidelity

For maximum preservation (sync-ready):

```bash
conflu export page 123456 \
  --include-attachments \
  --verbose
```

### Batch Export Entire Documentation

```bash
# Export all spaces
conflu export space TEAM --include-children -o ./docs/team
conflu export space DEV --include-children -o ./docs/dev
conflu export space API --include-children -o ./docs/api
```

### Automated Daily Backup

Create a script `backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d)
OUTPUT="./backups/$DATE"

conflu export space TEAM \
  --include-attachments \
  --include-children \
  -o "$OUTPUT" \
  --quiet

echo "Backup complete: $OUTPUT"
```

Run daily via cron:
```bash
0 2 * * * /path/to/backup.sh
```

### Selective Export

Export only pages matching criteria (using batch):

```bash
# Create batch file with specific pages
cat > important-pages.json << 'EOF'
[
  {"pageId": "123456", "title": "README"},
  {"pageId": "789012", "title": "Getting Started"},
  {"pageId": "345678", "title": "API Docs"}
]
EOF

# Export
conflu export batch important-pages.json --include-attachments
```

---

## Next Steps

- **[Configuration Reference](CONFIGURATION.md)** - All configuration options
- **[Use Cases](USE_CASES.md)** - Real-world examples
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
- **[Best Practices](BEST_PRACTICES.md)** - Tips for optimal usage
