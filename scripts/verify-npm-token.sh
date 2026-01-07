#!/bin/bash

# verify-npm-token.sh
# Verify NPM token is valid before running workflow
# Usage: ./scripts/verify-npm-token.sh [token]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if token provided
TOKEN="$1"
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}📋 No token provided as argument${NC}"
    echo -e "${BLUE}ℹ️  Checking GitHub secret instead...${NC}"
    
    # Try to get from GitHub secret
    if command -v gh &> /dev/null; then
        echo -e "${BLUE}ℹ️  Verifying GitHub secret exists...${NC}"
        if gh secret list | grep -q "NPM_TOKEN"; then
            echo -e "${GREEN}✅ NPM_TOKEN secret exists in GitHub${NC}"
            echo ""
            echo -e "${YELLOW}⚠️  Cannot verify token value from GitHub secrets${NC}"
            echo -e "${BLUE}ℹ️  To test locally, provide token:${NC}"
            echo -e "   ${BLUE}./scripts/verify-npm-token.sh YOUR_TOKEN${NC}"
            exit 0
        else
            echo -e "${RED}❌ NPM_TOKEN secret not found in GitHub${NC}"
            echo ""
            echo -e "${YELLOW}Setup instructions:${NC}"
            echo -e "   1. Generate token: ${BLUE}https://www.npmjs.com/settings/tokens${NC}"
            echo -e "   2. Set secret: ${BLUE}gh secret set NPM_TOKEN${NC}"
            echo -e "   3. Or see: ${BLUE}docs/NPM_TOKEN_SETUP.md${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ GitHub CLI not installed and no token provided${NC}"
        echo ""
        echo -e "${YELLOW}Options:${NC}"
        echo -e "   1. Install gh: ${BLUE}brew install gh${NC}"
        echo -e "   2. Or provide token: ${BLUE}./scripts/verify-npm-token.sh YOUR_TOKEN${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}🔍 Verifying NPM token...${NC}"
echo ""

# Backup existing .npmrc if exists
NPMRC_BACKUP=""
if [ -f "$HOME/.npmrc" ]; then
    NPMRC_BACKUP="$HOME/.npmrc.backup.$(date +%s)"
    echo -e "${YELLOW}⚠️  Backing up existing .npmrc to ${NPMRC_BACKUP}${NC}"
    cp "$HOME/.npmrc" "$NPMRC_BACKUP"
fi

# Create temporary .npmrc
echo -e "${BLUE}📝 Creating temporary .npmrc...${NC}"
cat > "$HOME/.npmrc" << EOF
//registry.npmjs.org/:_authToken=${TOKEN}
registry=https://registry.npmjs.org/
EOF

# Test 1: Check token format
echo -e "${BLUE}1️⃣  Checking token format...${NC}"
if [[ ! "$TOKEN" =~ ^npm_[a-zA-Z0-9]{36}$ ]]; then
    echo -e "${YELLOW}⚠️  Token doesn't match standard format (npm_xxxxx...)${NC}"
    echo -e "${BLUE}ℹ️  This might be okay for legacy tokens${NC}"
else
    echo -e "${GREEN}✅ Token format looks valid${NC}"
fi
echo ""

# Test 2: Verify authentication
echo -e "${BLUE}2️⃣  Testing authentication...${NC}"
if NPM_USER=$(npm whoami 2>&1); then
    echo -e "${GREEN}✅ Authentication successful${NC}"
    echo -e "${GREEN}   Logged in as: ${NPM_USER}${NC}"
else
    echo -e "${RED}❌ Authentication failed${NC}"
    echo -e "${RED}   Error: ${NPM_USER}${NC}"
    
    # Cleanup
    rm "$HOME/.npmrc"
    if [ -n "$NPMRC_BACKUP" ]; then
        mv "$NPMRC_BACKUP" "$HOME/.npmrc"
    fi
    
    echo ""
    echo -e "${YELLOW}Possible causes:${NC}"
    echo -e "   - Token expired or revoked"
    echo -e "   - Wrong token type (need 'Automation')"
    echo -e "   - Network issues"
    echo ""
    echo -e "${BLUE}Fix: See docs/NPM_TOKEN_SETUP.md${NC}"
    exit 1
fi
echo ""

# Test 3: Check package name availability
echo -e "${BLUE}3️⃣  Checking package name availability...${NC}"
PACKAGE_NAME=$(node -p "require('./package.json').name" 2>/dev/null || echo "unknown")
if [ "$PACKAGE_NAME" != "unknown" ]; then
    echo -e "${BLUE}   Package name: ${PACKAGE_NAME}${NC}"
    
    if npm view "$PACKAGE_NAME" &> /dev/null; then
        echo -e "${YELLOW}⚠️  Package already exists on npm${NC}"
        
        # Check if user can publish
        PACKAGE_OWNER=$(npm view "$PACKAGE_NAME" --json 2>/dev/null | node -p "JSON.parse(require('fs').readFileSync(0, 'utf-8')).maintainers[0].name" 2>/dev/null || echo "unknown")
        if [ "$PACKAGE_OWNER" = "$NPM_USER" ]; then
            echo -e "${GREEN}✅ You own this package (can publish updates)${NC}"
        else
            echo -e "${RED}❌ Package owned by: ${PACKAGE_OWNER}${NC}"
            echo -e "${YELLOW}⚠️  You cannot publish to this package${NC}"
            echo ""
            echo -e "${BLUE}Options:${NC}"
            echo -e "   1. Rename package in package.json"
            echo -e "   2. Use scoped name: @${NPM_USER}/${PACKAGE_NAME}"
            echo -e "   3. Contact ${PACKAGE_OWNER} to add you as maintainer"
        fi
    else
        echo -e "${GREEN}✅ Package name available (first publish)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not read package.json${NC}"
fi
echo ""

# Test 4: Dry run publish
echo -e "${BLUE}4️⃣  Testing publish (dry-run)...${NC}"
if npm publish --dry-run 2>&1 | grep -q "npm notice"; then
    echo -e "${GREEN}✅ Dry-run publish successful${NC}"
    echo -e "${GREEN}   Package is ready to be published${NC}"
else
    echo -e "${YELLOW}⚠️  Dry-run had warnings (might be okay)${NC}"
fi
echo ""

# Cleanup
echo -e "${BLUE}🧹 Cleaning up...${NC}"
rm "$HOME/.npmrc"
if [ -n "$NPMRC_BACKUP" ]; then
    echo -e "${BLUE}📋 Restoring original .npmrc${NC}"
    mv "$NPMRC_BACKUP" "$HOME/.npmrc"
fi
echo ""

# Summary
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ NPM TOKEN VERIFICATION COMPLETE${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Your NPM token is valid and ready to use!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "   1. Set GitHub secret:"
echo -e "      ${BLUE}gh secret set NPM_TOKEN --repo taipt1504/conflu-exporter${NC}"
echo ""
echo -e "   2. Trigger workflow:"
echo -e "      ${BLUE}git tag -a v0.1.0 -m 'Release v0.1.0'${NC}"
echo -e "      ${BLUE}git push origin v0.1.0${NC}"
echo ""
echo -e "   3. Monitor workflow:"
echo -e "      ${BLUE}gh run watch${NC}"
echo ""
echo -e "${GREEN}Happy publishing! 🚀${NC}"

