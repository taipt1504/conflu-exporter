# Authentication Guide

Complete guide to authenticating with Confluence API using `conflu-exporter`.

## Table of Contents

- [Overview](#overview)
- [Getting Your API Token](#getting-your-api-token)
- [Authentication Methods](#authentication-methods)
  - [Method 1: Environment Variables (Recommended)](#method-1-environment-variables-recommended)
  - [Method 2: Configuration File](#method-2-configuration-file)
  - [Method 3: Command-Line Flags](#method-3-command-line-flags)
- [Priority and Precedence](#priority-and-precedence)
- [Security Best Practices](#security-best-practices)
- [Testing Your Authentication](#testing-your-authentication)
- [Troubleshooting](#troubleshooting)

## Overview

`conflu-exporter` requires three pieces of information to authenticate with Confluence:

| Credential | Description | Example |
|------------|-------------|---------|
| **Base URL** | Your Confluence instance URL (without `/wiki`) | `https://your-company.atlassian.net` |
| **Email** | Your Atlassian account email | `your-email@company.com` |
| **API Token** | Personal API token for authentication | `ATATT3xFfGF0...` |

The tool supports three authentication methods, and you can mix and match them based on your needs.

## Getting Your API Token

### Step-by-Step Guide

1. **Go to Atlassian Account Settings**

   Visit: https://id.atlassian.com/manage-profile/security/api-tokens

2. **Click "Create API token"**

   ![Create Token Button](https://i.imgur.com/example.png)

3. **Enter a Label**

   Give your token a descriptive name:
   ```
   conflu-exporter - My Laptop
   ```

   This helps you identify and manage tokens later.

4. **Click "Create"**

   The token will be generated.

5. **Copy the Token**

   **⚠️ IMPORTANT**: Copy the token now! You won't be able to see it again.

   ```
   ATATT3xFfGF0T_example_token_abc123xyz
   ```

6. **Store Securely**

   Save the token in a password manager or secure location.

### Token Format

Confluence API tokens start with `ATATT3xFfGF0` and are typically 168-204 characters long:

```
✅ Valid:   ATATT3xFfGF0T1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0...
❌ Invalid: my-password
❌ Invalid: 123456
```

## Authentication Methods

### Method 1: Environment Variables (Recommended)

**Best for**: Personal use, development, CI/CD pipelines

**Pros**:
- ✅ Secure (no files to accidentally commit)
- ✅ Easy to update
- ✅ Works across all projects
- ✅ CI/CD friendly

**Cons**:
- ❌ Need to set for each terminal session (unless made permanent)

#### Setting Environment Variables

**macOS/Linux (bash/zsh)**:

Temporary (current session only):
```bash
export CONFLUENCE_BASE_URL="https://your-company.atlassian.net"
export CONFLUENCE_EMAIL="your-email@company.com"
export CONFLUENCE_TOKEN="ATATT3xFfGF0T_your_token_here"
```

Permanent (add to `~/.zshrc` or `~/.bashrc`):
```bash
# Open your shell config file
nano ~/.zshrc  # or ~/.bashrc for bash

# Add these lines at the end:
export CONFLUENCE_BASE_URL="https://your-company.atlassian.net"
export CONFLUENCE_EMAIL="your-email@company.com"
export CONFLUENCE_TOKEN="ATATT3xFfGF0T_your_token_here"

# Save and reload
source ~/.zshrc  # or source ~/.bashrc
```

**Windows (PowerShell)**:

Temporary (current session only):
```powershell
$env:CONFLUENCE_BASE_URL="https://your-company.atlassian.net"
$env:CONFLUENCE_EMAIL="your-email@company.com"
$env:CONFLUENCE_TOKEN="ATATT3xFfGF0T_your_token_here"
```

Permanent (PowerShell profile):
```powershell
# Open PowerShell profile
notepad $PROFILE

# Add these lines:
$env:CONFLUENCE_BASE_URL="https://your-company.atlassian.net"
$env:CONFLUENCE_EMAIL="your-email@company.com"
$env:CONFLUENCE_TOKEN="ATATT3xFfGF0T_your_token_here"

# Save and reload
. $PROFILE
```

Permanent (System Environment Variables):
```powershell
# Run as Administrator
[System.Environment]::SetEnvironmentVariable('CONFLUENCE_BASE_URL', 'https://your-company.atlassian.net', 'User')
[System.Environment]::SetEnvironmentVariable('CONFLUENCE_EMAIL', 'your-email@company.com', 'User')
[System.Environment]::SetEnvironmentVariable('CONFLUENCE_TOKEN', 'ATATT3xFfGF0T_your_token_here', 'User')
```

#### Verification

Check that variables are set:

```bash
echo $CONFLUENCE_BASE_URL
echo $CONFLUENCE_EMAIL
echo $CONFLUENCE_TOKEN
```

#### Usage

Once set, you can run commands without additional flags:

```bash
conflu export page 123456
conflu export space TEAM
```

### Method 2: Configuration File

**Best for**: Project-specific settings, sharing non-sensitive config with team

**Pros**:
- ✅ Persistent configuration
- ✅ Project-specific settings
- ✅ Easy to share (without token)
- ✅ Supports additional options (format, output, etc.)

**Cons**:
- ❌ Risk of committing token to git
- ❌ File needs to be secured

#### Creating Config File

**Location**: `~/.conflurc` (home directory) or `./.conflurc` (project directory)

**Format**: JSON

```json
{
  "baseUrl": "https://your-company.atlassian.net",
  "email": "your-email@company.com",
  "token": "ATATT3xFfGF0T_your_token_here",
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

#### Quick Setup

```bash
# Create config in home directory
cat > ~/.conflurc << 'EOF'
{
  "baseUrl": "https://your-company.atlassian.net",
  "email": "your-email@company.com",
  "token": "ATATT3xFfGF0T_your_token_here",
  "format": "markdown",
  "output": "./exports",
  "includeAttachments": true
}
EOF
```

#### Security Considerations

**⚠️ IMPORTANT: Protect your config file!**

1. **Set proper file permissions**:
   ```bash
   chmod 600 ~/.conflurc  # Only you can read/write
   ```

2. **Add to .gitignore** (if in project directory):
   ```bash
   echo ".conflurc" >> .gitignore
   ```

3. **Use environment variable for token** (recommended):
   ```json
   {
     "baseUrl": "https://your-company.atlassian.net",
     "email": "your-email@company.com",
     "format": "markdown",
     "output": "./exports"
   }
   ```

   Then set token via environment:
   ```bash
   export CONFLUENCE_TOKEN="ATATT3xFfGF0T_your_token_here"
   ```

#### Shareable Config Template

Create a `.conflurc.example` for team members (without token):

```json
{
  "baseUrl": "https://your-company.atlassian.net",
  "format": "markdown",
  "output": "./exports",
  "includeAttachments": true,
  "api": {
    "timeout": 30000,
    "retries": 3
  }
}
```

Team members copy and add their credentials:
```bash
cp .conflurc.example ~/.conflurc
# Then edit ~/.conflurc to add email and token
```

### Method 3: Command-Line Flags

**Best for**: One-off exports, scripts, different credentials per command

**Pros**:
- ✅ Explicit and clear
- ✅ No file or environment setup needed
- ✅ Different credentials per command
- ✅ Easy to script

**Cons**:
- ❌ Verbose
- ❌ Token visible in command history
- ❌ Tedious for frequent use

#### Available Flags

| Flag | Short | Description | Required |
|------|-------|-------------|----------|
| `--base-url` | `-u` | Confluence base URL | Yes* |
| `--email` | `-e` | Your email address | Yes* |
| `--token` | `-t` | Your API token | Yes* |

*Required if not set via environment or config file

#### Usage Examples

**Basic export**:
```bash
conflu export page 123456 \
  -u https://your-company.atlassian.net \
  -e your-email@company.com \
  -t ATATT3xFfGF0T_your_token_here
```

**With additional options**:
```bash
conflu export space TEAM \
  -u https://your-company.atlassian.net \
  -e your-email@company.com \
  -t ATATT3xFfGF0T_your_token_here \
  -o ./team-exports \
  --include-attachments \
  --include-children
```

**Using different credentials**:
```bash
# Export from one instance
conflu export page 123 \
  -u https://company-a.atlassian.net \
  -e user-a@company.com \
  -t TOKEN_A

# Export from another instance
conflu export page 456 \
  -u https://company-b.atlassian.net \
  -e user-b@company.com \
  -t TOKEN_B
```

#### Security Warning

⚠️ **Tokens in command history**: When using command-line flags, your token is stored in shell history.

**Mitigation**:

1. **Clear command history**:
   ```bash
   history -c  # Clear current session
   ```

2. **Prefix with space** (in some shells):
   ```bash
   # Note the leading space
    conflu export page 123 -t TOKEN
   ```

3. **Use environment variable for token**:
   ```bash
   export CONFLUENCE_TOKEN="ATATT3xFfGF0T_your_token_here"
   conflu export page 123 -u URL -e EMAIL
   ```

## Priority and Precedence

When multiple authentication methods are configured, `conflu-exporter` uses this priority:

```
1. Command-Line Flags (highest priority)
   ↓
2. Environment Variables
   ↓
3. Configuration File
   ↓
4. Defaults (lowest priority)
```

### Examples

**Example 1: Mixed Methods**

```bash
# Environment variables
export CONFLUENCE_BASE_URL="https://company-a.atlassian.net"
export CONFLUENCE_EMAIL="user@company-a.com"

# Config file (~/.conflurc)
{
  "token": "TOKEN_FROM_CONFIG"
}

# Command
conflu export page 123 -u https://company-b.atlassian.net

# Result:
# baseUrl: https://company-b.atlassian.net (CLI flag wins)
# email: user@company-a.com (from env var)
# token: TOKEN_FROM_CONFIG (from config file)
```

**Example 2: Override Config with Environment**

```bash
# Config file
{
  "baseUrl": "https://old-instance.atlassian.net",
  "email": "old@example.com",
  "token": "OLD_TOKEN"
}

# Environment (overrides config)
export CONFLUENCE_BASE_URL="https://new-instance.atlassian.net"
export CONFLUENCE_TOKEN="NEW_TOKEN"

# Command (no flags)
conflu export page 123

# Result:
# baseUrl: https://new-instance.atlassian.net (env wins)
# email: old@example.com (from config, not overridden)
# token: NEW_TOKEN (env wins)
```

## Security Best Practices

### ✅ DO

1. **Use environment variables for tokens**
   ```bash
   export CONFLUENCE_TOKEN="your_token"
   ```

2. **Store tokens in password managers**
   - 1Password
   - LastPass
   - KeePass
   - macOS Keychain

3. **Set restrictive file permissions**
   ```bash
   chmod 600 ~/.conflurc
   ```

4. **Add config files to .gitignore**
   ```bash
   echo ".conflurc" >> .gitignore
   ```

5. **Use separate tokens per device/purpose**
   ```
   Token 1: "Work Laptop - conflu-exporter"
   Token 2: "Home Desktop - conflu-exporter"
   Token 3: "CI/CD Pipeline"
   ```

6. **Rotate tokens regularly**
   - Every 90 days recommended
   - Immediately if compromised

7. **Use read-only tokens if possible**
   - `conflu-exporter` only needs read access
   - Check Confluence permissions

### ❌ DON'T

1. **DON'T commit tokens to Git**
   ```bash
   # Bad:
   git add .conflurc  # if it contains token
   ```

2. **DON'T share tokens**
   - Each user should have their own token

3. **DON'T use tokens in scripts without protection**
   ```bash
   # Bad:
   TOKEN="my-token"  # visible in ps, process list

   # Good:
   read -s TOKEN  # prompt for token, hidden input
   ```

4. **DON'T log tokens**
   ```bash
   # Bad:
   echo "Using token: $CONFLUENCE_TOKEN" >> log.txt
   ```

5. **DON'T use production tokens in development**
   - Use separate Confluence instances if possible

## Testing Your Authentication

### Test Connection

Use a dry run to test authentication without exporting:

```bash
conflu export page 123456 --dry-run
```

Expected output if successful:
```
Testing API connection...
✓ Connected to Confluence API
Fetching page 123456...
✓ Fetched page: "Page Title"

--- DRY RUN MODE ---
Would export page: Page Title
```

### Verbose Mode

Get detailed authentication information:

```bash
conflu export page 123456 --dry-run --verbose
```

Look for:
```
Configuration loaded: https://your-company.atlassian.net
API client initialized
Testing API connection...
✓ Connected to Confluence API
```

## Troubleshooting

### "Missing required configuration"

**Problem**: Credentials not provided.

**Solution**: Verify credentials are set:

```bash
# Check environment variables
echo $CONFLUENCE_BASE_URL
echo $CONFLUENCE_EMAIL
echo $CONFLUENCE_TOKEN

# Check config file
cat ~/.conflurc

# Or provide via CLI flags
conflu export page 123 -u URL -e EMAIL -t TOKEN
```

### "Failed to connect to Confluence API"

**Problem**: Invalid credentials or network issue.

**Solutions**:

1. **Verify base URL** (no `/wiki`):
   ```bash
   # Correct:
   export CONFLUENCE_BASE_URL="https://company.atlassian.net"

   # Wrong:
   export CONFLUENCE_BASE_URL="https://company.atlassian.net/wiki"
   ```

2. **Test token manually**:
   ```bash
   curl -u your-email@company.com:YOUR_TOKEN \
     https://your-company.atlassian.net/wiki/rest/api/content/123456
   ```

3. **Check token hasn't expired**:
   - Go to https://id.atlassian.com/manage-profile/security/api-tokens
   - Verify token still exists
   - Regenerate if needed

4. **Verify network access**:
   ```bash
   ping your-company.atlassian.net
   curl -I https://your-company.atlassian.net
   ```

### "401 Unauthorized"

**Problem**: Invalid email or token.

**Solutions**:

1. **Verify email matches Atlassian account**
2. **Regenerate token**
3. **Check for typos in credentials**

### "403 Forbidden"

**Problem**: No access to page/space.

**Solutions**:

1. **Verify permissions**: Can you view the page in your browser?
2. **Check space permissions**: Do you have read access to the space?
3. **Try a different page**: Test with a page you created

## Next Steps

- **[Configuration Reference](CONFIGURATION.md)** - All configuration options
- **[Command Reference](COMMAND_REFERENCE.md)** - All available commands
- **[Best Practices](BEST_PRACTICES.md)** - Security and usage tips
