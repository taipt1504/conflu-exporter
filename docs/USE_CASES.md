# Use Cases & Examples

Real-world scenarios and solutions using `conflu-exporter`.

## Table of Contents

- [Documentation Backup](#documentation-backup)
- [Migration to Git-Based Docs](#migration-to-git-based-docs)
- [Offline Documentation](#offline-documentation)
- [Documentation Review & Audit](#documentation-review--audit)
- [Knowledge Base Export](#knowledge-base-export)
- [Compliance & Archival](#compliance--archival)
- [CI/CD Integration](#cicd-integration)
- [Multi-Team Collaboration](#multi-team-collaboration)

---

## Documentation Backup

**Scenario**: Regular automated backups of Confluence documentation.

### Daily Backup Script

Create `backup-confluence.sh`:

```bash
#!/bin/bash

# Configuration
DATE=$(date +%Y-%m-%d)
BACKUP_DIR="./backups/$DATE"
SPACES=("TEAM" "DEV" "API" "DOCS")
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Export each space
for SPACE in "${SPACES[@]}"; do
  echo "Backing up space: $SPACE"

  conflu export space "$SPACE" \
    --include-attachments \
    --include-children \
    -o "$BACKUP_DIR/$SPACE" \
    --quiet

  if [ $? -eq 0 ]; then
    echo "✓ Backup complete: $SPACE"
  else
    echo "✗ Backup failed: $SPACE"
  fi
done

# Compress backup
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

# Remove old backups
find ./backups -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup complete: $BACKUP_DIR.tar.gz"
```

### Automated Scheduling

**Using cron** (macOS/Linux):

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/backup-confluence.sh >> /path/to/backup.log 2>&1
```

**Using Windows Task Scheduler**:

```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\path\to\backup-confluence.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "ConfluenceBackup" -Action $action -Trigger $trigger
```

### Backup to Cloud Storage

```bash
#!/bin/bash

# Export to local directory
conflu export space TEAM --include-attachments -o ./temp-export

# Sync to S3
aws s3 sync ./temp-export s3://my-bucket/confluence-backups/$(date +%Y-%m-%d)/

# Clean up
rm -rf ./temp-export
```

---

## Migration to Git-Based Docs

**Scenario**: Migrate Confluence documentation to Git repository (MkDocs, Docusaurus, etc.)

### Step 1: Export Documentation

```bash
# Export all documentation spaces
conflu export space DOCS --include-children --include-attachments -o ./mkdocs/docs
conflu export space API --include-children --include-attachments -o ./mkdocs/docs/api
```

### Step 2: Initialize MkDocs Project

```bash
# Install MkDocs
pip install mkdocs mkdocs-material

# Create mkdocs.yml
cat > mkdocs.yml << 'EOF'
site_name: Documentation
theme:
  name: material
  features:
    - navigation.tabs
    - navigation.sections
    - toc.integrate

nav:
  - Home: index.md
  - Getting Started: DOCS/getting-started.md
  - API Reference: api/index.md

markdown_extensions:
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
EOF
```

### Step 3: Setup Git Repository

```bash
# Initialize git
git init
git add .
git commit -m "Initial migration from Confluence"

# Push to remote
git remote add origin https://github.com/company/docs.git
git push -u origin main
```

### Step 4: Deploy to GitHub Pages

```bash
# Build and deploy
mkdocs gh-deploy
```

### Continuous Sync Script

```bash
#!/bin/bash

# Export latest from Confluence
conflu export space DOCS --include-children -o ./docs

# Commit changes
git add docs/
git commit -m "Sync from Confluence: $(date +%Y-%m-%d)"
git push

# Deploy
mkdocs gh-deploy
```

---

## Offline Documentation

**Scenario**: Create offline documentation for field teams without internet access.

### Export with All Assets

```bash
# Export with full fidelity
conflu export space FIELD_GUIDE \
  --include-attachments \
  --include-children \
  -o ./offline-docs
```

### Create Portable Package

```bash
# Package with Markdown viewer
mkdir -p offline-package
cp -r ./offline-docs offline-package/docs

# Add simple HTML viewer
cat > offline-package/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Offline Documentation</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body>
  <div id="content"></div>
  <script>
    // Load and render markdown files
    fetch('docs/FIELD_GUIDE/index.md')
      .then(r => r.text())
      .then(text => {
        document.getElementById('content').innerHTML = marked.parse(text);
      });
  </script>
</body>
</html>
EOF

# Create distributable archive
zip -r offline-docs.zip offline-package/
```

### USB Distribution

```bash
# Create self-contained package
conflu export space MANUAL \
  --include-attachments \
  -o /Volumes/USB/documentation

# Add README
cat > /Volumes/USB/README.txt << 'EOF'
Documentation Package
====================
Open docs/MANUAL/index.md with any Markdown viewer.
Recommended: Typora, MarkdownPad, or VS Code
EOF
```

---

## Documentation Review & Audit

**Scenario**: Review and audit documentation quality.

### Export for Review

```bash
# Export documentation for review
conflu export space DOCS --include-children -o ./review

# Generate review report
find ./review -name "*.md" -exec wc -l {} + | sort -n > review/word-count.txt
```

### Extract Metadata

```python
#!/usr/bin/env python3
import json
import glob

# Load manifest
with open('./review/manifest.json') as f:
    manifest = json.load(f)

# Analyze pages
print("Documentation Audit Report")
print("=" * 50)
print(f"Total Pages: {len(manifest['pages'])}")
print(f"Export Date: {manifest['exportedAt']}")

# Find pages without labels
unlabeled = [p for p in manifest['pages'] if not p.get('metadata', {}).get('labels')]
print(f"Pages without labels: {len(unlabeled)}")

# Find outdated pages (not updated in 6 months)
import datetime
cutoff = datetime.datetime.now() - datetime.timedelta(days=180)
outdated = []
for page in manifest['pages']:
    updated = page.get('metadata', {}).get('updatedAt')
    if updated and datetime.datetime.fromisoformat(updated) < cutoff:
        outdated.append(page)

print(f"Outdated pages (>6 months): {len(outdated)}")
```

---

## Knowledge Base Export

**Scenario**: Extract company knowledge base for search indexing.

### Export All Knowledge Bases

```bash
#!/bin/bash

# Define KB spaces
KB_SPACES=("KB" "FAQ" "HOWTO" "TROUBLESHOOTING")

# Export each KB
for SPACE in "${KB_SPACES[@]}"; do
  conflu export space "$SPACE" \
    --include-children \
    -o "./kb-export/$SPACE"
done
```

### Index with Elasticsearch

```python
from elasticsearch import Elasticsearch
import json
import glob

es = Elasticsearch(['localhost:9200'])

# Load exported pages
for manifest_file in glob.glob('./kb-export/*/manifest.json'):
    with open(manifest_file) as f:
        manifest = json.load(f)

    for page in manifest['pages']:
        # Read markdown content
        with open(page['path']) as f:
            content = f.read()

        # Index document
        es.index(index='kb', document={
            'title': page['title'],
            'content': content,
            'space': page['spaceKey'],
            'pageId': page['id'],
            'url': page.get('metadata', {}).get('url'),
            'labels': page.get('metadata', {}).get('labels', [])
        })

print("Knowledge base indexed successfully")
```

---

## Compliance & Archival

**Scenario**: Export documentation for compliance audits and legal archival.

### Compliance Export

```bash
#!/bin/bash

# Configuration
AUDIT_DATE=$(date +%Y-%m-%d)
AUDIT_DIR="./compliance/audit-$AUDIT_DATE"

# Export all required spaces
SPACES=("POLICY" "PROCEDURES" "COMPLIANCE" "SOC2")

for SPACE in "${SPACES[@]}"; do
  conflu export space "$SPACE" \
    --include-attachments \
    --include-children \
    -o "$AUDIT_DIR/$SPACE"
done

# Generate audit manifest
cat > "$AUDIT_DIR/AUDIT_INFO.txt" << EOF
Confluence Documentation Export
Audit Date: $AUDIT_DATE
Exported By: $(whoami)
Exported Spaces: ${SPACES[@]}
Purpose: Compliance Audit
EOF

# Create tamper-proof archive
tar -czf "$AUDIT_DIR.tar.gz" "$AUDIT_DIR"
sha256sum "$AUDIT_DIR.tar.gz" > "$AUDIT_DIR.tar.gz.sha256"

# Sign (if required)
gpg --sign "$AUDIT_DIR.tar.gz"

echo "Compliance export complete: $AUDIT_DIR.tar.gz"
```

---

## CI/CD Integration

**Scenario**: Automated documentation exports in CI/CD pipeline.

### GitHub Actions Workflow

`.github/workflows/export-docs.yml`:

```yaml
name: Export Confluence Documentation

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:      # Manual trigger

jobs:
  export:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install conflu-exporter
      run: npm install -g conflu-exporter

    - name: Export Confluence spaces
      env:
        CONFLUENCE_BASE_URL: ${{ secrets.CONFLUENCE_BASE_URL }}
        CONFLUENCE_EMAIL: ${{ secrets.CONFLUENCE_EMAIL }}
        CONFLUENCE_TOKEN: ${{ secrets.CONFLUENCE_TOKEN }}
      run: |
        conflu export space DOCS --include-children -o ./docs
        conflu export space API --include-children -o ./docs/api

    - name: Commit changes
      run: |
        git config user.name "GitHub Actions"
        git config user.email "actions@github.com"
        git add docs/
        git commit -m "Update documentation from Confluence" || exit 0
        git push

    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: confluence-export
        path: docs/
```

### GitLab CI/CD

`.gitlab-ci.yml`:

```yaml
export-confluence:
  stage: deploy
  image: node:18

  script:
    - npm install -g conflu-exporter
    - conflu export space DOCS --include-children -o ./docs
    - conflu export space API --include-children -o ./docs/api

  artifacts:
    paths:
      - docs/
    expire_in: 30 days

  only:
    - schedules
```

---

## Multi-Team Collaboration

**Scenario**: Different teams exporting their spaces for collaboration.

### Team-Specific Exports

```bash
#!/bin/bash

# Team A exports their docs
conflu export space TEAM_A \
  --include-children \
  -o ./shared-docs/team-a

# Team B exports their docs
conflu export space TEAM_B \
  --include-children \
  -o ./shared-docs/team-b

# Merge into single documentation site
mkdir -p ./combined-docs
cp -r ./shared-docs/team-a/* ./combined-docs/
cp -r ./shared-docs/team-b/* ./combined-docs/
```

### Cross-Reference Generator

```python
#!/usr/bin/env python3
import json
import glob

# Collect all page IDs and titles
pages_index = {}

for manifest_file in glob.glob('./shared-docs/*/manifest.json'):
    with open(manifest_file) as f:
        manifest = json.load(f)

    for page in manifest['pages']:
        pages_index[page['id']] = {
            'title': page['title'],
            'path': page['path'],
            'space': page['spaceKey']
        }

# Save index for cross-referencing
with open('./combined-docs/pages-index.json', 'w') as f:
    json.dump(pages_index, f, indent=2)

print(f"Indexed {len(pages_index)} pages for cross-referencing")
```

---

## Next Steps

- **[Command Reference](COMMAND_REFERENCE.md)** - All available commands
- **[Best Practices](BEST_PRACTICES.md)** - Optimization and security tips
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
