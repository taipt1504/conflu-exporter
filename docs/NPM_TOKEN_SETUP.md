# NPM Token Setup Guide

## 🚨 Important: Why You Need This

Your workflow failed with:
```
npm error Access token expired or revoked
npm error 404 Not Found - PUT https://registry.npmjs.org/conflu-exporter
```

This means your `NPM_TOKEN` is either:
- ❌ Expired or revoked
- ❌ Has wrong type (not "Automation")
- ❌ Missing publish permissions
- ❌ Not set in GitHub Secrets

## ✅ Complete Setup Guide

### Step 1: Generate New NPM Token

#### 1.1 Login to npm

Go to: https://www.npmjs.com/login

Login with your credentials.

#### 1.2 Navigate to Tokens Page

Go to: https://www.npmjs.com/settings/YOUR_USERNAME/tokens

Replace `YOUR_USERNAME` with your actual npm username.

#### 1.3 Create Automation Token

1. Click **"Generate New Token"**
2. Select **"Automation"** type (CRITICAL!)
   
   **⚠️ Important:** 
   - ❌ NOT "Granular Access Token"
   - ❌ NOT "Publish" token
   - ✅ USE "Automation" token

3. Token will have these permissions automatically:
   - ✅ Read and publish to any package
   - ✅ Install any package
   - ✅ Access public registry

4. Click **"Generate Token"**

5. **COPY THE TOKEN IMMEDIATELY** (you can't see it again!)

   Example format: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 2: Set GitHub Secret

#### Option A: Using GitHub CLI (Recommended)

```bash
# Set NPM_TOKEN secret
gh secret set NPM_TOKEN --repo taipt1504/conflu-exporter

# Paste your token when prompted
# Then press Enter
```

Verify:
```bash
gh secret list --repo taipt1504/conflu-exporter
```

Should show:
```
NPM_TOKEN      Updated 2026-01-08
```

#### Option B: Using GitHub Web UI

1. Go to: https://github.com/taipt1504/conflu-exporter/settings/secrets/actions

2. If `NPM_TOKEN` exists:
   - Click on it
   - Click **"Update"**
   - Paste new token
   - Click **"Update secret"**

3. If `NPM_TOKEN` doesn't exist:
   - Click **"New repository secret"**
   - Name: `NPM_TOKEN`
   - Value: Paste your token
   - Click **"Add secret"**

### Step 3: Verify Setup

#### 3.1 Check Secret Exists

```bash
gh secret list --repo taipt1504/conflu-exporter
```

Should show `NPM_TOKEN` in the list.

#### 3.2 Test Locally (Optional)

```bash
# Test token works
echo "//registry.npmjs.org/:_authToken=YOUR_TOKEN" > ~/.npmrc
npm whoami
# Should print your npm username

# Clean up
rm ~/.npmrc
```

### Step 4: Re-trigger Workflow

#### Option A: Update Tag (Recommended)

```bash
cd /Users/taiphan/Documents/Projects/lab/conflu-exporter

# Delete and recreate tag
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0

# Create new tag
git tag -a v0.1.0 -m "Release v0.1.0 - Initial release"
git push origin v0.1.0
```

#### Option B: Manual Dispatch

```bash
gh workflow run build.yml \
  --ref main \
  --field publish=true
```

## 🔍 Troubleshooting

### Issue 1: Token Still Not Working

**Symptoms:**
```
npm error code ENEEDAUTH
npm error need auth
```

**Solutions:**

1. **Verify token type:**
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Check token says "Automation" not "Granular" or "Publish"

2. **Regenerate token:**
   - Delete old token on npm
   - Create new "Automation" token
   - Update GitHub secret

3. **Check token hasn't expired:**
   - Automation tokens don't expire by default
   - But can be manually revoked
   - Regenerate if needed

### Issue 2: 404 Not Found Error

**Symptoms:**
```
npm error 404 Not Found - PUT https://registry.npmjs.org/conflu-exporter
npm error 404  'conflu-exporter@0.1.0' is not in this registry
```

**This is NORMAL for first publish!** It means:
- ✅ Package doesn't exist yet (expected)
- ✅ npm will create it on first publish

**If persists:**

1. **Check package name availability:**
   ```bash
   npm view conflu-exporter
   # Should return: 404 Not Found (good!)
   ```

2. **If package exists and you don't own it:**
   - Someone else owns `conflu-exporter`
   - Rename your package in `package.json`
   - Use scoped name: `@taipt1504/conflu-exporter`

3. **If you own it but still fails:**
   - Token might not have publish permission
   - Use "Automation" token type
   - Or add yourself as maintainer on npm web UI

### Issue 3: Workflow Passes But Package Not Published

**Symptoms:**
- ✅ Workflow shows success
- ❌ `npm view conflu-exporter` returns 404

**Causes:**

1. **continue-on-error: true**
   - Workflow continues even if publish fails
   - Check "Publish to npm" job logs

2. **Check actual logs:**
   ```bash
   gh run view --log | grep -A 20 "Publish to npm"
   ```

3. **Look for:**
   - Authentication errors
   - Permission errors
   - Registry errors

## 📊 Token Types Comparison

| Type | Use Case | Publish | Expires | Best For |
|------|----------|---------|---------|----------|
| **Automation** | CI/CD | ✅ Yes | ❌ No | GitHub Actions |
| Granular | Fine-grained | ⚠️ Maybe | ✅ Yes | Advanced users |
| Publish | Legacy | ✅ Yes | ❌ No | Deprecated |

**Always use "Automation" for GitHub Actions!**

## ✅ Verification Checklist

After setup, verify:

- [ ] Token type is "Automation" on npm website
- [ ] `gh secret list` shows NPM_TOKEN
- [ ] Workflow file has `secrets.NPM_TOKEN`
- [ ] `.npmrc` is created in `$HOME` during workflow
- [ ] `npm whoami` passes in workflow logs
- [ ] `npm publish` succeeds in workflow logs
- [ ] Package visible on https://www.npmjs.com/package/conflu-exporter

## 🎯 Success Indicators

When everything works, you'll see:

**In Workflow Logs:**
```
🔐 Setting up npm authentication...
✅ .npmrc configured at /home/runner/.npmrc
npm whoami
> your-npm-username

📦 Publishing to npm...
  Package: conflu-exporter
  Version: 0.1.0
  Registry: https://registry.npmjs.org/

npm notice Publishing to https://registry.npmjs.org/
npm notice Uploading tarball...
npm notice package uploaded
+ conflu-exporter@0.1.0
```

**On npm:**
- https://www.npmjs.com/package/conflu-exporter
- Package info visible
- Version 0.1.0 published
- Install button works

## 🔐 Security Best Practices

1. **Never commit tokens:**
   - ❌ Don't put in `.npmrc` and commit
   - ❌ Don't put in workflow file directly
   - ✅ Always use GitHub Secrets

2. **Rotate tokens regularly:**
   - Every 6-12 months
   - When team members leave
   - If token might be compromised

3. **Use minimum permissions:**
   - Automation token is enough
   - Don't use personal tokens
   - Don't share tokens

4. **Monitor token usage:**
   - Check npm token activity
   - Review workflow logs
   - Set up security alerts

## 📞 Need Help?

If still having issues:

1. **Check workflow logs:**
   ```bash
   gh run list --workflow=build.yml --limit=1
   gh run view --log
   ```

2. **Re-run with debug:**
   ```bash
   gh workflow run build.yml --ref main -f publish=true
   ```

3. **Check package.json:**
   - Ensure `name` is available on npm
   - Ensure `version` is correct
   - Ensure `publishConfig` if needed

4. **Test token manually:**
   ```bash
   npm login --auth-type=legacy
   # Or use token directly
   ```

## 📚 Additional Resources

- [npm Tokens Documentation](https://docs.npmjs.com/about-access-tokens)
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [npm Publishing Guide](https://docs.npmjs.com/cli/v9/commands/npm-publish)
- [Troubleshooting npm publish](https://docs.npmjs.com/troubleshooting-registry-issues)

---

**Last Updated:** 2026-01-08  
**Status:** ✅ Ready to use

