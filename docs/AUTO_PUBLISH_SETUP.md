# Auto-Publish Setup Guide

## 🎯 Overview

The workflow automatically publishes your package to **npm** and **GitHub Packages** when:
- You push a version tag (e.g., `v0.1.0`)
- You push to `main` branch (if `PUBLISH_ON_MAIN=true`)
- You manually trigger with "Publish" option checked

## 🔐 Required Secrets

### 1. NPM_TOKEN (Required for npm publishing)

#### Step 1: Create npm Token

1. **Login to npm:**
   ```bash
   npm login
   ```

2. **Go to npm tokens page:**
   https://www.npmjs.com/settings/YOUR_USERNAME/tokens

3. **Generate New Token:**
   - Click "Generate New Token"
   - Select **"Automation"** type (recommended for CI/CD)
   - Copy the token immediately (won't be shown again)

#### Step 2: Add Token to GitHub Secrets

**Via GitHub UI:**
1. Go to your repository: https://github.com/taipt1504/conflu-exporter
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. **Name:** `NPM_TOKEN`
5. **Value:** Paste your npm token
6. Click **Add secret**

**Via GitHub CLI:**
```bash
gh secret set NPM_TOKEN
# Paste your token when prompted
```

### 2. GITHUB_TOKEN (Auto-provided ✅)

`GITHUB_TOKEN` is automatically provided by GitHub Actions. No setup needed!

---

## 🚀 Publishing Methods

### Method 1: Tag-Based Release (Recommended) ⭐

Push a version tag to auto-publish:

```bash
# Update version in package.json
npm version patch  # 0.1.0 → 0.1.1
# or
npm version minor  # 0.1.0 → 0.2.0
# or
npm version major  # 0.1.0 → 1.0.0

# Push tag
git push --follow-tags
```

**What happens:**
1. ✅ Builds on Node 20, 22
2. ✅ Publishes to npm
3. ✅ Publishes to GitHub Packages
4. ✅ Creates GitHub Release

---

### Method 2: Auto-Publish on Main Push

Enabled by default (`PUBLISH_ON_MAIN=true`).

```bash
# Just push to main
git push origin main
```

**What happens:**
1. ✅ Builds package
2. ✅ Publishes to npm
3. ✅ Publishes to GitHub Packages
4. ❌ No GitHub Release (only for tags)

**To disable:**
Edit `.github/workflows/build.yml`:
```yaml
env:
  PUBLISH_ON_MAIN: false  # Change to false
```

---

### Method 3: Manual Trigger via GitHub UI

1. Go to **Actions** tab
2. Select **Build & Publish** workflow
3. Click **Run workflow**
4. **Check "Publish"** option ✅
5. Click **Run workflow**

---

### Method 4: Manual Trigger via GitHub CLI

```bash
gh workflow run build.yml -f publish=true
```

---

## 📦 Where Your Package Is Published

### npm Registry
- **URL:** https://www.npmjs.com/package/conflu-exporter
- **Install:** `npm install -g conflu-exporter`
- **Public:** Anyone can install

### GitHub Packages
- **URL:** https://github.com/taipt1504?tab=packages
- **Package:** `@taipt1504/conflu-exporter`
- **Install:** Requires GitHub authentication

---

## 🧪 Testing Before Publishing

Before pushing a tag:

```bash
# 1. Build locally
pnpm build

# 2. Test CLI
node bin/conflu.js --version

# 3. Dry run (see what will be published)
pnpm publish --dry-run

# 4. If all good, create tag
npm version patch
git push --follow-tags
```

---

## 📝 Version Naming

Follow [Semantic Versioning](https://semver.org/):

| Type | Command | Example |
|------|---------|---------|
| Bug fix | `npm version patch` | 0.1.0 → 0.1.1 |
| New feature | `npm version minor` | 0.1.0 → 0.2.0 |
| Breaking change | `npm version major` | 0.1.0 → 1.0.0 |
| Beta release | `npm version prerelease --preid=beta` | 0.1.0 → 0.1.1-beta.0 |

---

## 🔍 Verify Published Package

### Check npm

```bash
# View package info
npm view conflu-exporter

# View specific version
npm view conflu-exporter@0.1.0

# View all versions
npm view conflu-exporter versions

# Install and test
npm install -g conflu-exporter@latest
conflu --version
```

### Check GitHub Packages

```bash
# View via browser
open https://github.com/taipt1504?tab=packages

# Or via API
gh api /users/taipt1504/packages
```

---

## 🐛 Troubleshooting

### Problem: "npm publish failed: 403 Forbidden"

**Cause:** Invalid or expired `NPM_TOKEN`

**Solution:**
1. Generate new token on npmjs.com
2. Update GitHub secret:
   ```bash
   gh secret set NPM_TOKEN
   ```
3. Re-run workflow

---

### Problem: "Version already exists"

**Cause:** Version `0.1.0` already published to npm

**Solution:**
```bash
# Check current version
npm view conflu-exporter version

# Bump to next version
npm version patch  # or minor/major
git push --follow-tags
```

---

### Problem: "Publish skipped"

**Cause:** Publish conditions not met

**Check workflow logs:**
```bash
gh run view --log | grep "should-publish"
# Must show: should-publish: true
```

**Solutions:**
- For tag push: Ensure tag format is `v*.*.*`
- For main push: Ensure `PUBLISH_ON_MAIN=true`
- For manual: Check "Publish" checkbox

---

## 📊 Monitoring

### View Workflow Runs

```bash
# List recent runs
gh run list --workflow=build.yml --limit=5

# Watch current run
gh run watch

# View specific run
gh run view <run-id>
```

### Check Publish Status

After workflow completes:

1. **npm:** https://www.npmjs.com/package/conflu-exporter
2. **GitHub Packages:** https://github.com/taipt1504?tab=packages
3. **GitHub Release:** https://github.com/taipt1504/conflu-exporter/releases

---

## 🎯 Quick Reference

```bash
# Standard release flow
npm version patch          # Bump version
git push --follow-tags     # Push tag → auto-publish

# Check if published
npm view conflu-exporter@latest

# Install and verify
npm install -g conflu-exporter@latest
conflu --version
```

---

## 🔗 Links

- **Workflow File:** [.github/workflows/build.yml](../.github/workflows/build.yml)
- **npm Package:** https://www.npmjs.com/package/conflu-exporter
- **GitHub Packages:** https://github.com/taipt1504?tab=packages
- **npm Token Guide:** https://docs.npmjs.com/creating-and-viewing-access-tokens

---

*Last updated: January 2026*

