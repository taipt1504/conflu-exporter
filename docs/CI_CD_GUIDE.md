# CI/CD Guide

This guide explains the Continuous Integration and Continuous Deployment setup for `conflu-exporter`.

## Overview

The project uses **GitHub Actions** for automated CI/CD workflows:

- ✅ **CI Pipeline**: Automated testing, linting, and building
- 🚀 **Release Pipeline**: Automated npm publishing and GitHub releases
- 🔒 **Security Analysis**: CodeQL security scanning
- 📦 **Dependency Management**: Automated dependency updates via Dependabot

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Trigger**: Push to `main` branch or Pull Requests

**Jobs**:

1. **Code Quality** - Type checking, linting, format checking
   - Runs on: Ubuntu Latest
   - Node.js: 20
   
2. **Test** - Unit and integration tests
   - Runs on: Ubuntu Latest
   - Node.js: 18, 20, 22 (matrix)
   - Coverage reporting to Codecov
   
3. **Build** - Compile TypeScript to JavaScript
   - Runs on: Ubuntu Latest
   - Node.js: 20
   - Artifacts uploaded for 7 days

**Usage**:
- Automatically runs on every push and PR
- All checks must pass before merging
- View results at: https://github.com/taipt1504/conflu-exporter/actions

### 2. Release Workflow (`.github/workflows/release.yml`)

**Trigger**: Push tags matching `v*.*.*` (e.g., `v0.1.0`, `v1.2.3`)

**Jobs**:

1. **Build Package** - Build and test before publishing
2. **Publish to npm** - Deploy to npm registry
3. **Create GitHub Release** - Auto-generate release notes
4. **Publish to GitHub Packages** - Deploy to GitHub registry

**Setup Required**:

#### A. Create npm Access Token

1. Go to [npmjs.com](https://www.npmjs.com/) and login
2. Click your profile → **Access Tokens** → **Generate New Token**
3. Choose **Automation** token type
4. Copy the token

#### B. Add npm Token to GitHub Secrets

1. Go to your repo: https://github.com/taipt1504/conflu-exporter
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click **Add secret**

#### C. Publish a Release

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Update CHANGELOG.md with release notes
## [0.1.1] - 2026-01-07

### Added
- New feature X

### Fixed
- Bug Y

# 3. Commit changes
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.1.1"

# 4. Create and push tag
git tag v0.1.1
git push origin main --tags

# The release workflow will automatically:
# - Run all tests
# - Build the package
# - Publish to npm
# - Create GitHub Release
# - Publish to GitHub Packages
```

**Release Checklist**:
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Run `pnpm build` and `pnpm test` locally
- [ ] Commit changes
- [ ] Create git tag (e.g., `v0.1.1`)
- [ ] Push tag to GitHub
- [ ] Monitor workflow at GitHub Actions
- [ ] Verify package on [npmjs.com](https://www.npmjs.com/package/conflu-exporter)

### 3. CodeQL Security Analysis (`.github/workflows/codeql.yml`)

**Trigger**:
- Push to `main` branch
- Pull Requests
- Scheduled: Every Monday at 00:00 UTC

**Purpose**:
- Detect security vulnerabilities
- Find code quality issues
- Check for common coding errors

**View Results**:
- Go to: https://github.com/taipt1504/conflu-exporter/security/code-scanning

### 4. Dependabot (`.github/dependabot.yml`)

**Configuration**:
- **npm dependencies**: Updated weekly on Mondays
- **GitHub Actions**: Updated weekly on Mondays
- Max open PRs: 10 for npm, 5 for actions

**Auto-merge Dependabot PRs**:

```bash
# Install GitHub CLI
brew install gh

# Auto-merge minor/patch updates
gh pr merge --auto --squash <PR-NUMBER>
```

## Monitoring

### CI Status Badges

The README displays real-time status badges:

- ![CI Badge](https://github.com/taipt1504/conflu-exporter/actions/workflows/ci.yml/badge.svg) - CI Pipeline Status
- ![CodeQL Badge](https://github.com/taipt1504/conflu-exporter/actions/workflows/codeql.yml/badge.svg) - Security Analysis

### GitHub Actions Dashboard

View all workflow runs:
- https://github.com/taipt1504/conflu-exporter/actions

### npm Package Status

Check published versions:
- https://www.npmjs.com/package/conflu-exporter

### GitHub Packages

View packages:
- https://github.com/taipt1504?tab=packages

## Troubleshooting

### CI Workflow Fails

**Problem**: Tests fail on CI but pass locally

**Solutions**:
1. Check Node.js version mismatch
   ```bash
   node --version  # Should match CI version (18, 20, or 22)
   ```

2. Clear cache and reinstall
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   pnpm test
   ```

3. Check environment variables
   - CI doesn't have access to local `.env` files
   - Use GitHub Secrets for sensitive data

### Release Workflow Fails

**Problem**: npm publish fails with authentication error

**Solutions**:
1. Verify `NPM_TOKEN` secret is set correctly
2. Check token hasn't expired (regenerate if needed)
3. Verify npm account has publish permissions

**Problem**: Package already exists at this version

**Solutions**:
1. Bump version in `package.json`
2. Create new tag matching the version
3. Cannot republish existing versions to npm

### CodeQL Analysis Warnings

**Problem**: Security vulnerabilities detected

**Solutions**:
1. Review findings at Security tab
2. Update vulnerable dependencies
   ```bash
   pnpm update
   ```
3. Fix code issues identified by CodeQL

## Best Practices

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new export format
fix: resolve table parsing issue
docs: update API documentation
chore: bump dependencies
ci: update workflow configuration
test: add unit tests for converter
refactor: simplify error handling
perf: optimize batch export
```

### Branch Protection

Recommended settings for `main` branch:

1. Go to **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `main`
3. Enable:
   - ✅ Require pull request reviews (1 approval)
   - ✅ Require status checks to pass (CI workflow)
   - ✅ Require branches to be up to date
   - ✅ Require linear history
   - ✅ Include administrators

### Release Strategy

**Semantic Versioning**:
- `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

**Release Schedule**:
- Patch releases: As needed for critical bugs
- Minor releases: Every 2-4 weeks
- Major releases: When breaking changes are necessary

## Advanced Configuration

### Custom Workflow Triggers

Add manual workflow dispatch:

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release'
        required: true
```

### Matrix Testing

Test on multiple OS:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [18, 20, 22]
runs-on: ${{ matrix.os }}
```

### Caching

Speed up builds with caching:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
```

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Publishing Guide](https://docs.npmjs.com/cli/v9/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [CodeQL Documentation](https://codeql.github.com/docs/)

## Support

For CI/CD issues:
- Check [GitHub Actions Status](https://www.githubstatus.com/)
- Review workflow logs
- Open an issue: https://github.com/taipt1504/conflu-exporter/issues
