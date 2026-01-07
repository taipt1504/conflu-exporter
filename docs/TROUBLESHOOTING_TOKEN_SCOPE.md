# Troubleshooting: NPM_TOKEN Scope Issue in GitHub Actions

## 🐛 The Bug

### Symptoms

```
npm error code E401
npm error 401 Unauthorized - GET https://registry.npmjs.org/-/whoami
npm error Access token expired or revoked

npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/conflu-exporter
```

Even though `NPM_TOKEN` was set in GitHub Secrets, the workflow couldn't authenticate with npm.

### Root Cause

**Environment variable scope issue in GitHub Actions!**

The `NPM_TOKEN` was only set at the **step level**, not **job level**:

```yaml
# ❌ WRONG: Token only available in ONE step
- name: Setup npm authentication
  run: |
    cat > $HOME/.npmrc << EOF
    //registry.npmjs.org/:_authToken=${NPM_TOKEN}
    EOF
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}  # Only this step can see it!

- name: Publish to npm
  run: |
    npm publish  # ❌ NPM_TOKEN is undefined here!
```

**What happened:**

1. In "Setup npm authentication" step:
   - `NPM_TOKEN` exists → `.npmrc` created with valid token
   
2. In "Publish to npm" step:
   - `NPM_TOKEN` is **undefined** (different step!)
   - If script references `${NPM_TOKEN}`, it's **empty string**
   - npm can't authenticate → 401 Unauthorized

### Why `.npmrc` Was Invalid

When the script ran:
```bash
cat > $HOME/.npmrc << EOF
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
EOF
```

In the second step, `${NPM_TOKEN}` was empty, creating:
```
//registry.npmjs.org/:_authToken=
```

This is an **invalid token** → authentication failed!

## ✅ The Fix

### Move `env` to Job Level

```yaml
# ✅ CORRECT: Token available to ALL steps in the job
publish-npm:
  name: Publish to npm
  runs-on: ubuntu-latest
  
  # Set env at JOB level
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
  
  steps:
    - name: Setup npm authentication
      run: |
        cat > $HOME/.npmrc << EOF
        //registry.npmjs.org/:_authToken=${NPM_TOKEN}
        EOF
        # ✅ NPM_TOKEN is available here
    
    - name: Publish to npm
      run: |
        npm publish
        # ✅ NPM_TOKEN is available here too!
```

### Key Difference

| Scope | Availability | When to Use |
|-------|-------------|-------------|
| **Step level** | Only that step | When secret needed in ONE step only |
| **Job level** | All steps in job | When secret needed across MULTIPLE steps |
| **Workflow level** | All jobs | When secret needed everywhere |

## 🔍 How to Debug This Issue

### 1. Check Environment Variable Availability

Add debug step:
```yaml
- name: Debug environment
  run: |
    echo "NPM_TOKEN is set: ${{ env.NPM_TOKEN != '' }}"
    echo "NPM_TOKEN length: ${#NPM_TOKEN}"
    # Don't echo the actual token!
```

### 2. Verify `.npmrc` Content

```yaml
- name: Verify .npmrc
  run: |
    if [ -f "$HOME/.npmrc" ]; then
      echo "✅ .npmrc exists"
      # Check if token is set (don't show actual value)
      if grep -q "_authToken=npm_" "$HOME/.npmrc"; then
        echo "✅ Token appears valid"
      else
        echo "❌ Token missing or invalid"
      fi
    else
      echo "❌ .npmrc not found"
    fi
```

### 3. Test npm Authentication

```yaml
- name: Test npm auth
  run: |
    if npm whoami; then
      echo "✅ npm authentication works"
    else
      echo "❌ npm authentication failed"
      exit 1
    fi
```

## 📚 GitHub Actions Environment Scopes

### Step Level (`env` in step)

```yaml
- name: My step
  run: echo $MY_VAR
  env:
    MY_VAR: value  # Only available in THIS step
```

**Use when:**
- Variable only needed in one step
- Different values needed per step
- Minimizing secret exposure

### Job Level (`env` in job)

```yaml
my-job:
  env:
    MY_VAR: value  # Available to ALL steps in THIS job
  steps:
    - run: echo $MY_VAR  # ✅ Available
    - run: echo $MY_VAR  # ✅ Available
```

**Use when:**
- Variable needed across multiple steps
- Setting up credentials/tokens
- Common configuration for job

### Workflow Level (`env` at root)

```yaml
env:
  MY_VAR: value  # Available to ALL jobs

jobs:
  job1:
    steps:
      - run: echo $MY_VAR  # ✅ Available
  
  job2:
    steps:
      - run: echo $MY_VAR  # ✅ Available
```

**Use when:**
- Variable needed everywhere
- Global constants
- Workflow-wide configuration

## 🎓 Best Practices

### 1. Set Secrets at Appropriate Level

```yaml
# ❌ Too broad - secret exposed to all jobs
env:
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

jobs:
  test:  # ❌ Test job doesn't need NPM_TOKEN
    steps: ...
  
  publish:  # ✅ Only publish needs it
    steps: ...

# ✅ Better - secret only where needed
jobs:
  test:
    steps: ...
  
  publish:
    env:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
    steps: ...
```

### 2. Minimize Secret Exposure

**Principle of Least Privilege:**
- Set secrets at the **narrowest scope** needed
- Job level > Step level when multiple steps need it
- Never echo/log actual secret values

### 3. Always Verify Authentication

```yaml
- name: Setup authentication
  run: |
    # Create auth file
    cat > $HOME/.npmrc << EOF
    //registry.npmjs.org/:_authToken=${NPM_TOKEN}
    EOF

- name: Verify authentication
  run: |
    # Test before using
    npm whoami || {
      echo "❌ Authentication failed"
      exit 1
    }

- name: Use authenticated command
  run: npm publish
```

### 4. Add Debugging (Without Leaking Secrets)

```yaml
- name: Debug (safe)
  run: |
    echo "Token is set: ${{ env.NPM_TOKEN != '' }}"
    echo "Token length: ${#NPM_TOKEN}"
    echo "Token prefix: ${NPM_TOKEN:0:4}..."  # Show only first 4 chars
    # ❌ NEVER: echo "Token: $NPM_TOKEN"
```

## 🔐 Security Considerations

### What NOT to Do

```yaml
# ❌ NEVER echo secrets
- run: echo "Token: ${{ secrets.NPM_TOKEN }}"

# ❌ NEVER log to files
- run: echo "$NPM_TOKEN" > debug.txt

# ❌ NEVER commit .npmrc with tokens
- run: git add .npmrc  # If contains real token

# ❌ NEVER expose in pull requests
- run: echo "Token: $NPM_TOKEN"
  # This will be visible in PR logs!
```

### Safe Practices

```yaml
# ✅ Check if set (boolean only)
- run: echo "Has token: ${{ secrets.NPM_TOKEN != '' }}"

# ✅ Use in controlled environment
- run: npm whoami  # npm handles token internally

# ✅ Clean up after use
- run: |
    npm publish
    rm $HOME/.npmrc  # Remove token file
```

## 📊 Common Patterns

### Pattern 1: Publishing Packages

```yaml
publish:
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}  # Job level
  steps:
    - name: Setup auth
      run: |
        cat > $HOME/.npmrc << EOF
        //registry.npmjs.org/:_authToken=${NPM_TOKEN}
        EOF
    
    - name: Verify
      run: npm whoami
    
    - name: Publish
      run: npm publish
```

### Pattern 2: Multiple Registries

```yaml
publish:
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  steps:
    - name: Setup auth
      run: |
        cat > $HOME/.npmrc << EOF
        //registry.npmjs.org/:_authToken=${NPM_TOKEN}
        //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
        EOF
    
    - name: Publish to npm
      run: npm publish --registry https://registry.npmjs.org
    
    - name: Publish to GitHub
      run: npm publish --registry https://npm.pkg.github.com
```

### Pattern 3: Conditional Secrets

```yaml
publish:
  steps:
    - name: Publish to npm
      if: secrets.NPM_TOKEN != ''
      env:
        NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      run: |
        # Setup and publish
```

## 🎯 Quick Checklist

When you see authentication errors:

- [ ] Is secret set in GitHub repository settings?
- [ ] Is secret name exactly matching (case-sensitive)?
- [ ] Is `env` at job level (not just step level)?
- [ ] Does the step actually have access to the variable?
- [ ] Is the variable used in the same job/step?
- [ ] Is `.npmrc` created correctly with token?
- [ ] Does `npm whoami` pass before publish?

## 📞 Related Issues

### Issue: "Token is set but still fails"

**Check:**
1. Token at wrong scope level ← **Most common!**
2. Token type wrong (not "Automation")
3. Token expired/revoked
4. Secret name mismatch

### Issue: "Works locally but fails in Actions"

**Reason:**
- Local: Uses `$HOME/.npmrc` with token
- Actions: Needs explicit `env` setup in workflow

### Issue: "First step works, second step fails"

**Reason:**
- `env` set at step level, not job level
- ← **This is exactly what we fixed!**

## 📚 Further Reading

- [GitHub Actions: Environment variables](https://docs.github.com/en/actions/learn-github-actions/environment-variables)
- [GitHub Actions: Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [npm: Authentication](https://docs.npmjs.com/cli/v9/configuring-npm/npmrc)

---

**Fixed in commit:** `6759068`  
**Date:** 2026-01-08  
**Impact:** Critical - Blocks all npm publishing  
**Status:** ✅ Resolved

