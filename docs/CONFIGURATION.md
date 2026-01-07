# Configuration Reference

Complete reference for all configuration options in `conflu-exporter`.

## Table of Contents

- [Configuration Methods](#configuration-methods)
- [Configuration File Format](#configuration-file-format)
- [Configuration Options](#configuration-options)
- [Environment Variables](#environment-variables)
- [Default Values](#default-values)
- [Examples](#examples)

## Configuration Methods

`conflu-exporter` supports three configuration methods (priority order):

1. **Command-line flags** (highest priority)
2. **Environment variables**
3. **Configuration file** (lowest priority)

See [Authentication Guide](AUTHENTICATION.md) for detailed setup instructions.

## Configuration File Format

**Location**: `~/.conflurc` or `./.conflurc`

**Format**: JSON

```json
{
  "baseUrl": "string",
  "email": "string",
  "token": "string",
  "format": "markdown | pdf | docx",
  "output": "string",
  "includeAttachments": boolean,
  "api": {
    "timeout": number,
    "retries": number,
    "concurrency": number
  },
  "conversion": {
    "markdown": {
      "preserveMacros": boolean,
      "downloadImages": boolean
    }
  }
}
```

## Configuration Options

### Core Options

#### `baseUrl`

Confluence instance base URL (without `/wiki`).

- **Type**: `string`
- **Required**: Yes
- **Default**: `undefined`
- **Environment**: `CONFLUENCE_BASE_URL`
- **CLI Flag**: `-u, --base-url`

**Example**:
```json
{
  "baseUrl": "https://your-company.atlassian.net"
}
```

**Valid**:
```
✅ https://company.atlassian.net
✅ https://confluence.company.com
✅ http://localhost:8080
```

**Invalid**:
```
❌ https://company.atlassian.net/wiki
❌ https://company.atlassian.net/wiki/spaces/TEAM
❌ company.atlassian.net (missing protocol)
```

---

#### `email`

Your Atlassian account email address.

- **Type**: `string`
- **Required**: Yes
- **Default**: `undefined`
- **Environment**: `CONFLUENCE_EMAIL`
- **CLI Flag**: `-e, --email`

**Example**:
```json
{
  "email": "your-email@company.com"
}
```

---

#### `token`

Confluence API token for authentication.

- **Type**: `string`
- **Required**: Yes
- **Default**: `undefined`
- **Environment**: `CONFLUENCE_TOKEN`
- **CLI Flag**: `-t, --token`

**Example**:
```json
{
  "token": "ATATT3xFfGF0T_your_token_here"
}
```

**Security**: See [Authentication Guide](AUTHENTICATION.md#security-best-practices)

---

#### `format`

Export format for pages.

- **Type**: `"markdown" | "pdf" | "docx"`
- **Required**: No
- **Default**: `"markdown"`
- **Environment**: `CONFLUENCE_FORMAT`
- **CLI Flag**: `-f, --format`

**Example**:
```json
{
  "format": "markdown"
}
```

**Supported Values**:
- `"markdown"` - Markdown with GFM (GitHub Flavored Markdown)
- `"pdf"` - PDF (not yet implemented in MVP)
- `"docx"` - Microsoft Word (not yet implemented in MVP)

---

#### `output`

Output directory for exported files.

- **Type**: `string`
- **Required**: No
- **Default**: `"./exports"`
- **Environment**: `CONFLUENCE_OUTPUT`
- **CLI Flag**: `-o, --output`

**Example**:
```json
{
  "output": "./my-exports"
}
```

**Path Resolution**:
- Relative paths: Resolved from current working directory
- Absolute paths: Used as-is
- `~`: Expands to home directory

**Examples**:
```json
"output": "./exports"           // Relative to CWD
"output": "/tmp/exports"         // Absolute path
"output": "~/Documents/exports"  // Home directory
```

---

#### `includeAttachments`

Download images and file attachments.

- **Type**: `boolean`
- **Required**: No
- **Default**: `false`
- **Environment**: `CONFLUENCE_INCLUDE_ATTACHMENTS` (`true`/`false`)
- **CLI Flag**: `--include-attachments`

**Example**:
```json
{
  "includeAttachments": true
}
```

**Behavior**:
- `true`: Downloads all page attachments to `{output}/{space}/assets/{pageId}/`
- `false`: Skips attachment downloads (faster, smaller exports)

---

### API Options

Configure API client behavior.

#### `api.timeout`

Request timeout in milliseconds.

- **Type**: `number`
- **Required**: No
- **Default**: `30000` (30 seconds)
- **Range**: `1000` - `600000` (1s - 10min)

**Example**:
```json
{
  "api": {
    "timeout": 60000
  }
}
```

**Recommendations**:
- Small pages: `15000` (15s)
- Large pages with attachments: `60000` (60s)
- Slow network: `120000` (2min)

---

#### `api.retries`

Number of retry attempts for failed requests.

- **Type**: `number`
- **Required**: No
- **Default**: `3`
- **Range**: `0` - `10`

**Example**:
```json
{
  "api": {
    "retries": 5
  }
}
```

**Retry Strategy**:
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Automatic for: Network errors, 429 (rate limit), 500+ errors
- No retry for: 401 (unauthorized), 404 (not found), 403 (forbidden)

---

#### `api.concurrency`

Maximum concurrent API requests.

- **Type**: `number`
- **Required**: No
- **Default**: `5`
- **Range**: `1` - `20`

**Example**:
```json
{
  "api": {
    "concurrency": 10
  }
}
```

**Recommendations**:
- Conservative: `3` (slower, safer)
- **Default**: `5` (balanced)
- Aggressive: `10` (faster, may hit rate limits)
- Enterprise with high limits: `15-20`

**Trade-offs**:
- Higher concurrency = faster exports but more risk of rate limiting
- Lower concurrency = slower but more reliable

---

### Conversion Options

#### `conversion.markdown.preserveMacros`

Preserve Confluence macro information in markdown.

- **Type**: `boolean`
- **Required**: No
- **Default**: `true`

**Example**:
```json
{
  "conversion": {
    "markdown": {
      "preserveMacros": true
    }
  }
}
```

**Behavior**:
- `true`: Extracts macro source code (e.g., Mermaid diagrams)
- `false`: Converts macros to closest markdown equivalent

---

#### `conversion.markdown.downloadImages`

Download images or keep as URLs.

- **Type**: `boolean`
- **Required**: No
- **Default**: `true`

**Example**:
```json
{
  "conversion": {
    "markdown": {
      "downloadImages": true
    }
  }
}
```

**Behavior**:
- `true`: Download images to `assets/` directory
- `false`: Keep as Confluence image URLs

---

## Environment Variables

All configuration options can be set via environment variables:

| Environment Variable | Config Key | Type | Example |
|---------------------|------------|------|---------|
| `CONFLUENCE_BASE_URL` | `baseUrl` | string | `https://company.atlassian.net` |
| `CONFLUENCE_EMAIL` | `email` | string | `user@company.com` |
| `CONFLUENCE_TOKEN` | `token` | string | `ATATT3xFfGF0T...` |
| `CONFLUENCE_FORMAT` | `format` | string | `markdown` |
| `CONFLUENCE_OUTPUT` | `output` | string | `./exports` |
| `CONFLUENCE_INCLUDE_ATTACHMENTS` | `includeAttachments` | boolean | `true` |

**Setting Environment Variables**:

**macOS/Linux**:
```bash
export CONFLUENCE_BASE_URL="https://company.atlassian.net"
export CONFLUENCE_EMAIL="user@company.com"
export CONFLUENCE_TOKEN="YOUR_TOKEN"
export CONFLUENCE_INCLUDE_ATTACHMENTS="true"
```

**Windows (PowerShell)**:
```powershell
$env:CONFLUENCE_BASE_URL="https://company.atlassian.net"
$env:CONFLUENCE_EMAIL="user@company.com"
$env:CONFLUENCE_TOKEN="YOUR_TOKEN"
$env:CONFLUENCE_INCLUDE_ATTACHMENTS="true"
```

---

## Default Values

Default configuration when no options are provided:

```json
{
  "format": "markdown",
  "output": "./exports",
  "includeAttachments": false,
  "api": {
    "timeout": 30000,
    "retries": 3,
    "concurrency": 5
  },
  "conversion": {
    "markdown": {
      "preserveMacros": true,
      "downloadImages": true
    }
  }
}
```

---

## Examples

### Minimal Configuration

**Environment variables only**:

```bash
export CONFLUENCE_BASE_URL="https://company.atlassian.net"
export CONFLUENCE_EMAIL="user@company.com"
export CONFLUENCE_TOKEN="YOUR_TOKEN"

conflu export page 123456
```

### Standard Configuration

**Config file** (`~/.conflurc`):

```json
{
  "baseUrl": "https://company.atlassian.net",
  "email": "user@company.com",
  "format": "markdown",
  "output": "./exports",
  "includeAttachments": true,
  "api": {
    "timeout": 30000,
    "retries": 3,
    "concurrency": 5
  }
}
```

**Environment** (token only for security):

```bash
export CONFLUENCE_TOKEN="YOUR_TOKEN"
```

### High-Performance Configuration

For fast, large-scale exports:

```json
{
  "baseUrl": "https://company.atlassian.net",
  "email": "user@company.com",
  "output": "./exports",
  "includeAttachments": false,
  "api": {
    "timeout": 60000,
    "retries": 5,
    "concurrency": 15
  }
}
```

### Conservative Configuration

For slow networks or rate-limited environments:

```json
{
  "baseUrl": "https://company.atlassian.net",
  "email": "user@company.com",
  "output": "./exports",
  "includeAttachments": true,
  "api": {
    "timeout": 120000,
    "retries": 5,
    "concurrency": 2
  }
}
```

### Project-Specific Configuration

**Project directory** (`./.conflurc`):

```json
{
  "format": "markdown",
  "output": "./docs/confluence",
  "includeAttachments": true,
  "conversion": {
    "markdown": {
      "preserveMacros": true,
      "downloadImages": true
    }
  }
}
```

**Global credentials** (`~/.conflurc` or environment):

```bash
export CONFLUENCE_BASE_URL="https://company.atlassian.net"
export CONFLUENCE_EMAIL="user@company.com"
export CONFLUENCE_TOKEN="YOUR_TOKEN"
```

### Multi-Instance Configuration

For users working with multiple Confluence instances:

**Instance A** (`~/.conflurc-a`):
```json
{
  "baseUrl": "https://company-a.atlassian.net",
  "email": "user-a@company.com",
  "output": "./exports/company-a"
}
```

**Instance B** (`~/.conflurc-b`):
```json
{
  "baseUrl": "https://company-b.atlassian.net",
  "email": "user-b@company.com",
  "output": "./exports/company-b"
}
```

**Usage**:
```bash
# Export from instance A
cp ~/.conflurc-a ~/.conflurc
export CONFLUENCE_TOKEN="TOKEN_A"
conflu export page 123

# Export from instance B
cp ~/.conflurc-b ~/.conflurc
export CONFLUENCE_TOKEN="TOKEN_B"
conflu export page 456
```

---

## Configuration Validation

The tool validates configuration at startup:

**Valid configuration**:
```
Configuration loaded: https://company.atlassian.net
API client initialized
```

**Missing required fields**:
```
✗ Missing required configuration: baseUrl, email, and token are required
Set them via CLI flags, environment variables, or config file
```

**Invalid format**:
```
✗ Invalid configuration: format must be one of: markdown, pdf, docx
```

---

## Next Steps

- **[Authentication Guide](AUTHENTICATION.md)** - Secure credential management
- **[Command Reference](COMMAND_REFERENCE.md)** - All available commands
- **[Use Cases](USE_CASES.md)** - Real-world configuration examples
- **[Best Practices](BEST_PRACTICES.md)** - Optimal configuration patterns
