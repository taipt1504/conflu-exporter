# Installation Guide

This guide covers installing `conflu-exporter` on different platforms and environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Global Installation (Recommended for CLI)](#global-installation-recommended-for-cli)
- [Local Installation (For Library Usage)](#local-installation-for-library-usage)
- [Installation from Source](#installation-from-source)
- [Verifying Installation](#verifying-installation)
- [Platform-Specific Notes](#platform-specific-notes)
- [Updating](#updating)
- [Uninstalling](#uninstalling)

## Prerequisites

### Required

- **Node.js**: Version 18.0.0 or higher
  - Check your version: `node --version`
  - Download from: https://nodejs.org/

### Recommended

- **Package Manager**: Choose one:
  - **npm** (comes with Node.js)
  - **pnpm** (faster, more efficient): `npm install -g pnpm`
  - **yarn** (alternative): `npm install -g yarn`

### For Confluence Access

- **Confluence Account** with API access
- **API Token** from Atlassian account settings
- **Base URL** of your Confluence instance (e.g., `https://your-domain.atlassian.net`)

## Global Installation (Recommended for CLI)

Global installation makes the `conflu` command available system-wide.

### Using npm

```bash
npm install -g conflu-exporter
```

### Using pnpm

```bash
pnpm add -g conflu-exporter
```

### Using yarn

```bash
yarn global add conflu-exporter
```

### Verification

After installation, verify the command is available:

```bash
conflu --version
# Should output: 0.1.0

conflu --help
# Should display help information
```

## Local Installation (For Library Usage)

If you want to use `conflu-exporter` as a library in your project:

### Using npm

```bash
# Navigate to your project directory
cd your-project

# Install as dependency
npm install conflu-exporter

# Or as dev dependency
npm install --save-dev conflu-exporter
```

### Using pnpm

```bash
pnpm add conflu-exporter

# Or as dev dependency
pnpm add -D conflu-exporter
```

### Using yarn

```bash
yarn add conflu-exporter

# Or as dev dependency
yarn add -D conflu-exporter
```

### Usage in Code

```typescript
import { ConfluenceExporter } from 'conflu-exporter'

const exporter = new ConfluenceExporter({
  baseUrl: 'https://your-domain.atlassian.net',
  auth: {
    username: 'your-email@example.com',
    token: 'your-api-token'
  }
})
```

## Installation from Source

For development or to use the latest features:

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/conflu-exporter.git
cd conflu-exporter
```

### 2. Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install

# Or using yarn
yarn install
```

### 3. Build the Project

```bash
# Using pnpm
pnpm build

# Or using npm
npm run build

# Or using yarn
yarn build
```

### 4. Link Globally (Optional)

To use the development version as a global command:

```bash
# Using pnpm
pnpm link --global

# Or using npm
npm link

# Or using yarn
yarn link
```

### 5. Run from Source

You can also run directly without linking:

```bash
node bin/conflu.js --help
```

## Verifying Installation

### Check Version

```bash
conflu --version
```

Expected output:
```
0.1.0
```

### Display Help

```bash
conflu --help
```

Expected output:
```
Usage: conflu [options] [command]

Export Confluence pages to multiple formats

Options:
  -V, --version   output the version number
  -v, --verbose   Enable verbose logging
  -q, --quiet     Suppress all output except errors
  -h, --help      display help for command

Commands:
  export          Export Confluence content
  config          Manage configuration
  help [command]  display help for command
```

### Test Export Command

```bash
conflu export --help
```

If you see the export command options, installation was successful!

## Platform-Specific Notes

### macOS

**Using Homebrew (Alternative)**:

While not officially supported yet, you can install from source:

```bash
# Install Node.js via Homebrew
brew install node

# Then follow global installation steps
npm install -g conflu-exporter
```

**Permission Issues**:

If you encounter permission errors with npm:

```bash
# Option 1: Use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
npm install -g conflu-exporter

# Option 2: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
npm install -g conflu-exporter
```

### Linux

**Ubuntu/Debian**:

```bash
# Install Node.js from NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install conflu-exporter
sudo npm install -g conflu-exporter

# Or without sudo using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
npm install -g conflu-exporter
```

**CentOS/RHEL/Fedora**:

```bash
# Install Node.js from NodeSource
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install conflu-exporter
sudo npm install -g conflu-exporter
```

### Windows

**Using Node.js Installer**:

1. Download Node.js installer from https://nodejs.org/
2. Run the installer and follow the wizard
3. Open Command Prompt or PowerShell as Administrator
4. Install conflu-exporter:

```powershell
npm install -g conflu-exporter
```

**Using Chocolatey**:

```powershell
# Install Node.js
choco install nodejs

# Install conflu-exporter
npm install -g conflu-exporter
```

**Using Windows Subsystem for Linux (WSL)**:

Follow the Linux installation instructions within WSL.

### Docker (Containerized Installation)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

# Install conflu-exporter
RUN npm install -g conflu-exporter

# Set working directory
WORKDIR /exports

# Default command
ENTRYPOINT ["conflu"]
CMD ["--help"]
```

Build and run:

```bash
# Build image
docker build -t conflu-exporter .

# Run command
docker run -v $(pwd)/exports:/exports conflu-exporter export page 123456 \
  -e your-email@example.com \
  -t your-api-token \
  -u https://your-domain.atlassian.net
```

## Updating

### Global Installation

```bash
# Using npm
npm update -g conflu-exporter

# Using pnpm
pnpm update -g conflu-exporter

# Using yarn
yarn global upgrade conflu-exporter
```

### Local Installation

```bash
# Using npm
npm update conflu-exporter

# Using pnpm
pnpm update conflu-exporter

# Using yarn
yarn upgrade conflu-exporter
```

### From Source

```bash
# Pull latest changes
git pull origin main

# Reinstall dependencies
pnpm install

# Rebuild
pnpm build
```

## Uninstalling

### Global Installation

```bash
# Using npm
npm uninstall -g conflu-exporter

# Using pnpm
pnpm remove -g conflu-exporter

# Using yarn
yarn global remove conflu-exporter
```

### Local Installation

```bash
# Using npm
npm uninstall conflu-exporter

# Using pnpm
pnpm remove conflu-exporter

# Using yarn
yarn remove conflu-exporter
```

### Cleanup

Remove configuration files (optional):

```bash
# Remove config file
rm ~/.conflurc

# Remove cache (if any)
rm -rf ~/.cache/conflu-exporter
```

## Troubleshooting Installation

### "command not found: conflu"

**Cause**: The global installation directory is not in your PATH.

**Solution**:

```bash
# Find npm global bin directory
npm config get prefix

# Add to PATH (macOS/Linux - add to ~/.zshrc or ~/.bashrc)
export PATH="$PATH:$(npm config get prefix)/bin"

# Reload shell
source ~/.zshrc  # or source ~/.bashrc
```

### "Permission denied" on macOS/Linux

**Cause**: Trying to install globally without proper permissions.

**Solution**: Use nvm or fix npm permissions (see Platform-Specific Notes above).

### "EACCES: permission denied" on Windows

**Cause**: Running Command Prompt without administrator privileges.

**Solution**: Run Command Prompt or PowerShell as Administrator.

### "Cannot find module"

**Cause**: Incomplete installation or build.

**Solution**:

```bash
# Reinstall
npm uninstall -g conflu-exporter
npm install -g conflu-exporter

# Or from source
cd conflu-exporter
rm -rf node_modules dist
pnpm install
pnpm build
```

## Next Steps

After successful installation:

1. **[Quick Start Guide](QUICK_START.md)** - Set up authentication and run your first export
2. **[Authentication Guide](AUTHENTICATION.md)** - Configure credentials securely
3. **[Command Reference](COMMAND_REFERENCE.md)** - Learn all available commands

## Support

If you encounter issues not covered here:

- Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
- Open an issue on GitHub: https://github.com/your-org/conflu-exporter/issues
- Review existing issues for solutions
