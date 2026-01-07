# Best Practices

Recommendations for optimal and secure usage of `conflu-exporter`.

## Table of Contents

- [Security](#security)
- [Performance Optimization](#performance-optimization)
- [Organization & Structure](#organization--structure)
- [Automation](#automation)
- [Content Quality](#content-quality)
- [Maintenance](#maintenance)

---

## Security

### Credential Management

#### ✅ DO

**Use environment variables for tokens**:
```bash
# Secure: Token not in files
export CONFLUENCE_TOKEN="YOUR_TOKEN"
conflu export page 123456
```

**Use password managers**:
- Store tokens in 1Password, LastPass, Bitward

**Restrict config file permissions**:
```bash
chmod 600 ~/.conflurc
```

**Use separate tokens per device**:
```
Work Laptop: "conflu-export-laptop-2026"
Home Desktop: "conflu-export-home-2026"
CI/CD: "conflu-export-ci-2026"
```

**Rotate tokens regularly**:
```bash
# Every 90 days
# 1. Generate new token
# 2. Update environment variable
# 3. Delete old token from Atlassian
```

#### ❌ DON'T

**Don't commit tokens to git**:
```bash
# Bad
git add .conflurc  # if contains token

# Good
echo ".conflurc" >> .gitignore
```

**Don't use production tokens in development**:
```bash
# Use separate instances/tokens
PROD_TOKEN="..." # Production
DEV_TOKEN="..."  # Development/Testing
```

**Don't log tokens**:
```bash
# Bad
echo "Using token: $CONFLUENCE_TOKEN" >> log.txt

# Good
conflu export page 123456 --verbose  # Tokens automatically redacted
```

---

### API Token Security

**Principle of Least Privilege**:
- Use read-only tokens if possible
- Limit token scope to required spaces
- Never use admin tokens for exports

**Token Rotation Schedule**:
```bash
#!/bin/bash
# token-rotation-reminder.sh

LAST_ROTATION_FILE=~/.conflu-token-rotation
ROTATION_DAYS=90

if [ -f "$LAST_ROTATION_FILE" ]; then
  LAST_DATE=$(cat "$LAST_ROTATION_FILE")
  DAYS_SINCE=$(( ($(date +%s) - $(date -d "$LAST_DATE" +%s)) / 86400 ))

  if [ $DAYS_SINCE -gt $ROTATION_DAYS ]; then
    echo "⚠️  Token rotation overdue! Last rotated $DAYS_SINCE days ago."
    echo "Visit: https://id.atlassian.com/manage-profile/security/api-tokens"
  fi
else
  date > "$LAST_ROTATION_FILE"
fi
```

---

## Performance Optimization

### Concurrency Settings

**Small spaces (< 50 pages)**:
```json
{
  "api": {
    "concurrency": 5,
    "timeout": 30000
  }
}
```

**Medium spaces (50-200 pages)**:
```json
{
  "api": {
    "concurrency": 8,
    "timeout": 45000
  }
}
```

**Large spaces (200+ pages)**:
```json
{
  "api": {
    "concurrency": 10,
    "timeout": 60000,
    "retries": 5
  }
}
```

**Rate-limited environments**:
```json
{
  "api": {
    "concurrency": 2,  // Conservative
    "timeout": 120000,
    "retries": 5
  }
}
```

---

### Selective Exports

**Export only what you need**:

```bash
# Good: Specific pages
conflu export batch critical-pages.json

# Avoid: Everything with attachments
conflu export space LARGE --include-attachments --include-children
```

**Use dry-run for large operations**:
```bash
# Preview before executing
conflu export space LARGE --dry-run

# Review page count, decide if needed
```

---

### Caching Strategy

**Local caching for repeated exports**:

```bash
#!/bin/bash
# cache-aware-export.sh

PAGE_ID="123456"
CACHE_DIR="./cache"
CACHE_FILE="$CACHE_DIR/page-$PAGE_ID.json"
CACHE_HOURS=24

# Check cache age
if [ -f "$CACHE_FILE" ]; then
  AGE_HOURS=$(( ($(date +%s) - $(date -r "$CACHE_FILE" +%s)) / 3600 ))

  if [ $AGE_HOURS -lt $CACHE_HOURS ]; then
    echo "Using cached version (${AGE_HOURS}h old)"
    exit 0
  fi
fi

# Export if cache expired
conflu export page "$PAGE_ID"
```

---

### Batch Processing

**Parallel batch processing**:

```bash
#!/bin/bash
# parallel-export.sh

# Split into batches
split -l 50 all-pages.csv batch-

# Export in parallel (max 3 concurrent)
ls batch-* | xargs -P 3 -I {} conflu export batch {}
```

**Sequential with progress**:

```bash
#!/bin/bash
TOTAL=$(wc -l < pages.csv)
CURRENT=0

while IFS=, read -r pageId title; do
  ((CURRENT++))
  echo "[$CURRENT/$TOTAL] Exporting: $title"

  conflu export page "$pageId" || echo "Failed: $pageId"
done < pages.csv
```

---

## Organization & Structure

### Output Directory Structure

**Recommended structure**:

```
exports/
├── by-space/
│   ├── TEAM/
│   ├── DEV/
│   └── API/
├── by-date/
│   ├── 2026-01-07/
│   └── 2026-01-06/
└── by-purpose/
    ├── backup/
    ├── migration/
    └── audit/
```

**Implementation**:

```bash
# By space
conflu export space TEAM -o ./exports/by-space/TEAM

# By date
DATE=$(date +%Y-%m-%d)
conflu export space TEAM -o "./exports/by-date/$DATE/TEAM"

# By purpose
conflu export space POLICY -o ./exports/by-purpose/audit/POLICY
```

---

### Naming Conventions

**Space keys**: Use consistent casing
```bash
# Good
export TEAM
export DEV
export API

# Avoid
export team
export Dev
export api
```

**Output directories**: Use descriptive names
```bash
# Good
./exports/team-documentation
./exports/api-reference
./exports/compliance-2026

# Avoid
./output
./temp
./stuff
```

**Batch files**: Include date and scope
```bash
# Good
pages-team-2026-01-07.json
critical-docs-weekly.csv

# Avoid
pages.json
export.csv
```

---

## Automation

### Scheduled Exports

**Best practices for automation**:

#### 1. Use absolute paths

```bash
# Good
conflu export space TEAM -o /full/path/to/exports

# Avoid
conflu export space TEAM -o ./exports
```

#### 2. Capture exit codes

```bash
#!/bin/bash

conflu export space TEAM

if [ $? -eq 0 ]; then
  echo "SUCCESS: Export completed"
else
  echo "FAILED: Export failed" >&2
  # Send alert (email, Slack, etc.)
  exit 1
fi
```

#### 3. Log everything

```bash
LOG_FILE="./logs/export-$(date +%Y%m%d).log"

conflu export space TEAM --verbose >> "$LOG_FILE" 2>&1
```

#### 4. Handle failures gracefully

```bash
#!/bin/bash

MAX_RETRIES=3
RETRY_COUNT=0

until conflu export space TEAM || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  echo "Retry $RETRY_COUNT/$MAX_RETRIES..."
  sleep 60
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "Export failed after $MAX_RETRIES attempts"
  # Send alert
fi
```

---

### CI/CD Integration

**GitHub Actions best practices**:

```yaml
name: Export Confluence

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily

jobs:
  export:
    runs-on: ubuntu-latest
    timeout-minutes: 30  # Prevent hanging

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install conflu-exporter
      run: npm install -g conflu-exporter

    - name: Export (with retry)
      uses: nick-invision/retry@v2
      with:
        timeout_minutes: 20
        max_attempts: 3
        command: |
          conflu export space DOCS \
            --include-children \
            -o ./docs

    - name: Upload artifacts
      if: success()
      uses: actions/upload-artifact@v3
      with:
        name: confluence-export
        path: docs/
        retention-days: 30

    - name: Notify on failure
      if: failure()
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Content Quality

### Validation

**Post-export validation**:

```bash
#!/bin/bash
# validate-export.sh

EXPORT_DIR="./exports"

# Check manifest exists
if [ ! -f "$EXPORT_DIR/manifest.json" ]; then
  echo "ERROR: manifest.json missing"
  exit 1
fi

# Validate JSON
if ! jq empty "$EXPORT_DIR/manifest.json" 2>/dev/null; then
  echo "ERROR: Invalid manifest JSON"
  exit 1
fi

# Count exported pages
PAGE_COUNT=$(find "$EXPORT_DIR" -name "*.md" | wc -l)
echo "Exported $PAGE_COUNT pages"

# Check for empty files
EMPTY_FILES=$(find "$EXPORT_DIR" -name "*.md" -empty)
if [ -n "$EMPTY_FILES" ]; then
  echo "WARNING: Empty markdown files found:"
  echo "$EMPTY_FILES"
fi

echo "Validation complete"
```

---

### Metadata Preservation

**Always include metadata for sync**:

```bash
# Good: Full metadata preserved
conflu export page 123456 --include-attachments

# Avoid: Minimal export (harder to sync back)
conflu export page 123456 --format markdown
```

**Verify frontmatter**:

```bash
# Check first exported page
head -n 20 exports/TEAM/page.md

# Should see:
# ---
# title: "Page Title"
# confluenceId: "123456"
# ...
# ---
```

---

## Maintenance

### Regular Backups

**Backup schedule**:

- **Daily**: Critical documentation
- **Weekly**: Active projects
- **Monthly**: Archive/reference material

**Backup rotation**:

```bash
#!/bin/bash
# backup-with-rotation.sh

BACKUP_DIR="./backups"
RETENTION_DAYS=30

# Create backup
DATE=$(date +%Y-%m-%d)
conflu export space CRITICAL -o "$BACKUP_DIR/$DATE"

# Rotate old backups
find "$BACKUP_DIR" -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} +

echo "Backup complete. Retained last $RETENTION_DAYS days."
```

---

### Monitoring

**Export health check**:

```bash
#!/bin/bash
# health-check.sh

# Test connection
if ! conflu export page 123456 --dry-run &> /dev/null; then
  echo "ALERT: Confluence connection failed"
  # Send alert
  exit 1
fi

# Check recent exports
LATEST=$(ls -t ./exports/*/manifest.json 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
  echo "WARNING: No recent exports found"
elif [ $(find "$LATEST" -mtime +1) ]; then
  echo "WARNING: Latest export older than 1 day"
fi
```

---

### Documentation

**Document your setup**:

Create `EXPORT_GUIDE.md` in your project:

```markdown
# Confluence Export Guide

## Setup

1. Install: `npm install -g conflu-exporter`
2. Set credentials: See `.env.example`
3. Run: `./scripts/export.sh`

## Spaces We Export

- TEAM: Team documentation (daily)
- API: API reference (weekly)
- POLICY: Compliance docs (monthly)

## Troubleshooting

- Check logs: `./logs/export-YYYYMMDD.log`
- Rerun failed: `./scripts/retry-failed.sh`
- Contact: docs-team@company.com
```

---

## Summary Checklist

### Security ✅
- [ ] Tokens in environment variables (not config files)
- [ ] Config files have restrictive permissions (600)
- [ ] `.conflurc` in `.gitignore`
- [ ] Tokens rotated every 90 days
- [ ] Separate tokens per device/environment

### Performance ✅
- [ ] Concurrency tuned for your environment
- [ ] Timeout set appropriately for page sizes
- [ ] Selective exports (not everything)
- [ ] Dry-run tested before large exports

### Organization ✅
- [ ] Consistent directory structure
- [ ] Descriptive naming conventions
- [ ] Manifests preserved
- [ ] Backups organized by date/purpose

### Automation ✅
- [ ] Scheduled exports configured
- [ ] Error handling implemented
- [ ] Logging enabled
- [ ] Alerts configured for failures
- [ ] Retry logic in place

### Content Quality ✅
- [ ] Metadata preserved (frontmatter)
- [ ] Attachments downloaded when needed
- [ ] Export validation script
- [ ] Post-export checks automated

### Maintenance ✅
- [ ] Backup rotation configured
- [ ] Health checks scheduled
- [ ] Documentation maintained
- [ ] Regular review of export quality

---

## Next Steps

- **[Use Cases](USE_CASES.md)** - Real-world examples
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues
- **[Configuration Reference](CONFIGURATION.md)** - All settings
