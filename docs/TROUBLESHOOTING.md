# Troubleshooting Guide

Solutions to common issues when using `conflu-exporter`.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Authentication Issues](#authentication-issues)
- [Export Issues](#export-issues)
- [Performance Issues](#performance-issues)
- [File and Permission Issues](#file-and-permission-issues)
- [Network Issues](#network-issues)
- [Content Issues](#content-issues)

---

## Installation Issues

### "command not found: conflu"

**Symptom**: After installation, running `conflu` shows "command not found".

**Causes**:
- Global bin directory not in PATH
- Installation failed silently
- Using wrong shell/terminal

**Solutions**:

1. **Verify installation**:
   ```bash
   npm list -g conflu-exporter
   ```

2. **Check npm global bin directory**:
   ```bash
   npm config get prefix
   # Should show directory like /usr/local or ~/.npm-global
   ```

3. **Add to PATH** (macOS/Linux):
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   export PATH="$(npm config get prefix)/bin:$PATH"

   # Reload shell
   source ~/.zshrc
   ```

4. **Reinstall globally**:
   ```bash
   npm uninstall -g conflu-exporter
   npm install -g conflu-exporter
   ```

5. **Use npx** (alternative):
   ```bash
   npx conflu-exporter --version
   ```

---

### "EACCES: permission denied" (macOS/Linux)

**Symptom**: Installation fails with permission errors.

**Cause**: Trying to write to system directories without sudo.

**Solution**: Use nvm instead of global installation:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.zshrc

# Install Node.js
nvm install node

# Install conflu-exporter
npm install -g conflu-exporter
```

---

### "Cannot find module" after installation

**Symptom**: Tool installed but crashes with "Cannot find module" error.

**Solutions**:

1. **Clear npm cache**:
   ```bash
   npm cache clean --force
   ```

2. **Reinstall**:
   ```bash
   npm uninstall -g conflu-exporter
   npm install -g conflu-exporter
   ```

3. **Check Node.js version**:
   ```bash
   node --version
   # Should be 18.0.0 or higher
   ```

---

## Authentication Issues

### "Missing required configuration"

**Symptom**: Tool complains about missing baseUrl, email, or token.

**Solutions**:

1. **Check environment variables**:
   ```bash
   echo $CONFLUENCE_BASE_URL
   echo $CONFLUENCE_EMAIL
   echo $CONFLUENCE_TOKEN
   ```

2. **Set missing variables**:
   ```bash
   export CONFLUENCE_BASE_URL="https://your-company.atlassian.net"
   export CONFLUENCE_EMAIL="your-email@company.com"
   export CONFLUENCE_TOKEN="YOUR_TOKEN"
   ```

3. **Or use CLI flags**:
   ```bash
   conflu export page 123456 \
     -u https://your-company.atlassian.net \
     -e your-email@company.com \
     -t YOUR_TOKEN
   ```

---

### "Failed to connect to Confluence API"

**Symptom**: Connection test fails even with correct credentials.

**Common Causes & Solutions**:

#### 1. Wrong Base URL

**Problem**:
```bash
# Wrong - includes /wiki
export CONFLUENCE_BASE_URL="https://company.atlassian.net/wiki"

# Wrong - includes /spaces
export CONFLUENCE_BASE_URL="https://company.atlassian.net/wiki/spaces/TEAM"
```

**Solution**:
```bash
# Correct - just the domain
export CONFLUENCE_BASE_URL="https://company.atlassian.net"
```

#### 2. Invalid Token

**Symptoms**:
- "401 Unauthorized" error
- Authentication fails

**Solutions**:

1. **Verify token format**:
   - Should start with `ATATT3xFfGF0`
   - Should be 168-204 characters long

2. **Regenerate token**:
   - Go to https://id.atlassian.com/manage-profile/security/api-tokens
   - Delete old token
   - Create new token
   - Update environment variable

3. **Check for typos**:
   ```bash
   # Print token length
   echo -n "$CONFLUENCE_TOKEN" | wc -c
   ```

#### 3. Email Mismatch

**Problem**: Email doesn't match Atlassian account.

**Solution**:
```bash
# Use exact email from Atlassian account settings
export CONFLUENCE_EMAIL="exact-email@company.com"
```

#### 4. Network/Firewall Issues

**Test connection manually**:
```bash
curl -I https://your-company.atlassian.net
```

If this fails, check:
- VPN connection required?
- Firewall blocking access?
- Proxy configuration needed?

---

### "403 Forbidden"

**Symptom**: Authentication succeeds but export fails with 403 error.

**Causes**:
- No read permission for page/space
- Restricted content

**Solutions**:

1. **Verify access in browser**:
   - Can you view the page in Confluence web interface?
   - Are you logged in with the correct account?

2. **Check space permissions**:
   - Go to Space Settings → Permissions
   - Verify you have "View" permission

3. **Try different page**:
   ```bash
   # Test with page you created
   conflu export page <your-page-id> --dry-run
   ```

---

## Export Issues

### "Page not found" (404)

**Symptom**: Export fails with "Page not found" error.

**Solutions**:

1. **Verify page ID**:
   - Check URL in browser: `.../ pages/{PAGE_ID}/...`
   - Use correct page ID, not space key

2. **Check page status**:
   - Page might be deleted or archived
   - Verify in Confluence web interface

3. **Use correct instance**:
   ```bash
   # Make sure baseUrl matches where page exists
   conflu export page 123456 \
     -u https://correct-instance.atlassian.net
   ```

---

### Export Stalls or Hangs

**Symptom**: Export starts but never completes.

**Solutions**:

1. **Use verbose mode**:
   ```bash
   conflu export page 123456 --verbose
   ```

   Look for where it's stuck.

2. **Increase timeout**:
   ```bash
   # In ~/.conflurc
   {
     "api": {
       "timeout": 120000  # 2 minutes
     }
   }
   ```

3. **Reduce concurrency**:
   ```bash
   {
     "api": {
       "concurrency": 2  # Slower but more stable
     }
   }
   ```

4. **Check network**:
   ```bash
   ping your-company.atlassian.net
   ```

---

### Attachments Not Downloading

**Symptom**: `--include-attachments` flag doesn't download files.

**Solutions**:

1. **Verify flag is set**:
   ```bash
   conflu export page 123456 --include-attachments --verbose
   ```

2. **Check page has attachments**:
   - View page in Confluence
   - Look for "Attachments" section

3. **Check permissions**:
   - Ensure you can download attachments in web interface

4. **Check disk space**:
   ```bash
   df -h
   ```

---

### Incomplete Space Export

**Symptom**: Not all pages exported from space.

**Causes**:
- Permissions issues
- Network timeouts
- Rate limiting

**Solutions**:

1. **Check summary output**:
   ```
   Export summary:
     Total pages: 100
     Successful: 95
     Failed: 5
   ```

2. **Review error log**:
   ```bash
   conflu export space TEAM --verbose 2>&1 | tee export.log
   grep -i error export.log
   ```

3. **Export with retries**:
   ```json
   {
     "api": {
       "retries": 5,
       "timeout": 60000
     }
   }
   ```

4. **Use batch export for failed pages**:
   ```json
   [
     {"pageId": "failed-page-1"},
     {"pageId": "failed-page-2"}
   ]
   ```

---

## Performance Issues

### Slow Export Speed

**Symptom**: Export takes very long time.

**Solutions**:

1. **Increase concurrency**:
   ```json
   {
     "api": {
       "concurrency": 10
     }
   }
   ```

2. **Skip attachments** (if not needed):
   ```bash
   conflu export space TEAM  # Without --include-attachments
   ```

3. **Use flat structure**:
   ```bash
   conflu export space TEAM --flat
   ```

4. **Export in batches**:
   ```bash
   # Split large space into smaller batches
   conflu export batch pages-1-50.json
   conflu export batch pages-51-100.json
   ```

---

### High Memory Usage

**Symptom**: Node.js process uses excessive memory.

**Solutions**:

1. **Increase Node.js memory limit**:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   conflu export space LARGE_SPACE
   ```

2. **Reduce concurrency**:
   ```json
   {
     "api": {
       "concurrency": 3
     }
   }
   ```

3. **Export in smaller batches**

---

### Rate Limiting (429 errors)

**Symptom**: "Too Many Requests" errors.

**Solutions**:

1. **Reduce concurrency**:
   ```json
   {
     "api": {
       "concurrency": 2
     }
   }
   ```

2. **Increase retries** (automatic backoff):
   ```json
   {
     "api": {
       "retries": 5
     }
   }
   ```

3. **Add delays between batches**:
   ```bash
   #!/bin/bash
   for file in batch-*.json; do
     conflu export batch "$file"
     sleep 30  # Wait 30 seconds between batches
   done
   ```

---

## File and Permission Issues

### "ENOENT: no such file or directory"

**Symptom**: Export fails creating output files.

**Solutions**:

1. **Ensure parent directory exists**:
   ```bash
   mkdir -p ./exports
   conflu export page 123456 -o ./exports
   ```

2. **Use absolute paths**:
   ```bash
   conflu export page 123456 -o /full/path/to/exports
   ```

3. **Check permissions**:
   ```bash
   ls -la ./exports
   # Ensure you have write permission
   ```

---

### "EACCES: permission denied" (write)

**Symptom**: Cannot write to output directory.

**Solutions**:

1. **Check directory permissions**:
   ```bash
   ls -la ./exports
   ```

2. **Use different output directory**:
   ```bash
   conflu export page 123456 -o ~/Documents/exports
   ```

3. **Fix permissions**:
   ```bash
   chmod 755 ./exports
   ```

---

## Network Issues

### "ECONNREFUSED" or "ETIMEDOUT"

**Symptom**: Cannot connect to Confluence.

**Solutions**:

1. **Check network connectivity**:
   ```bash
   ping your-company.atlassian.net
   ```

2. **Check proxy settings**:
   ```bash
   echo $HTTP_PROXY
   echo $HTTPS_PROXY
   ```

   Set if needed:
   ```bash
   export HTTP_PROXY="http://proxy.company.com:8080"
   export HTTPS_PROXY="http://proxy.company.com:8080"
   ```

3. **Check VPN**:
   - Is VPN required?
   - Is VPN connected?

4. **Test with curl**:
   ```bash
   curl -I https://your-company.atlassian.net
   ```

---

### "SSL certificate problem"

**Symptom**: SSL/TLS verification fails.

**Solutions**:

1. **Update Node.js**:
   ```bash
   nvm install node
   ```

2. **Update CA certificates** (Linux):
   ```bash
   sudo update-ca-certificates
   ```

3. **Temporary workaround** (not recommended for production):
   ```bash
   export NODE_TLS_REJECT_UNAUTHORIZED=0
   ```

---

## Content Issues

### Mermaid Diagrams Not Preserved

**Symptom**: Mermaid diagrams exported as images instead of source code.

**Cause**: This should not happen - it's a bug.

**Solutions**:

1. **Verify markdown conversion**:
   ```bash
   conflu export page 123456 --verbose
   ```

   Check logs for "Processing Mermaid macros".

2. **Check page has Mermaid macro**:
   - View page source in Confluence
   - Look for `{mermaid}` macro

3. **Report issue** if problem persists:
   https://github.com/your-org/conflu-exporter/issues

---

### Missing Images in Markdown

**Symptom**: Images not showing in exported markdown.

**Solutions**:

1. **Use `--include-attachments`**:
   ```bash
   conflu export page 123456 --include-attachments
   ```

2. **Check image paths**:
   ```bash
   # In exported markdown, images should be:
   ![alt](./assets/123456/image.png)
   ```

3. **Verify images were downloaded**:
   ```bash
   ls -la exports/SPACE/assets/123456/
   ```

---

### Broken Internal Links

**Symptom**: Links between pages don't work in exported markdown.

**Current Limitation**: Internal link resolution is limited in MVP.

**Workarounds**:

1. **Check manifest.json** for page IDs:
   ```bash
   cat exports/manifest.json
   ```

2. **Manually update links** if needed

3. **Future enhancement**: Automatic link resolution is planned

---

## Getting Help

If your issue isn't covered here:

1. **Enable verbose logging**:
   ```bash
   conflu export page 123456 --verbose 2>&1 | tee debug.log
   ```

2. **Check existing issues**:
   https://github.com/your-org/conflu-exporter/issues

3. **Create new issue** with:
   - Command you ran
   - Full error message
   - `conflu --version` output
   - `node --version` output
   - Operating system

4. **Include debug log** (remove sensitive info first):
   ```bash
   # Remove tokens from log
   sed 's/ATATT[^"]*/<REDACTED>/g' debug.log > debug-safe.log
   ```

---

## Next Steps

- **[Best Practices](BEST_PRACTICES.md)** - Avoid common issues
- **[Configuration Reference](CONFIGURATION.md)** - Optimize settings
- **[Authentication Guide](AUTHENTICATION.md)** - Secure credential setup
