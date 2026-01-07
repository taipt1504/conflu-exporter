#!/bin/bash
# ==============================================================================
# Development Environment Setup Script
# ==============================================================================
# Purpose: Automate the setup of local development environment
# Usage: ./scripts/setup-dev.sh [--skip-install] [--skip-hooks]
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SKIP_INSTALL=false
SKIP_HOOKS=false
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --skip-hooks)
      SKIP_HOOKS=true
      shift
      ;;
    --help)
      echo "Usage: $0 [--skip-install] [--skip-hooks]"
      echo ""
      echo "Options:"
      echo "  --skip-install  Skip dependency installation"
      echo "  --skip-hooks    Skip git hooks setup"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run '$0 --help' for usage information"
      exit 1
      ;;
  esac
done

# ==============================================================================
# Helper Functions
# ==============================================================================

print_header() {
  echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${MAGENTA}║${NC} ${CYAN}$1${NC}"
  echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════════╝${NC}"
}

print_step() {
  echo -e "${BLUE}▶${NC} $1"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

check_command() {
  if command -v "$1" &> /dev/null; then
    print_success "$1 is installed ($(command -v "$1"))"
    return 0
  else
    print_error "$1 is not installed"
    return 1
  fi
}

# ==============================================================================
# Main Setup Steps
# ==============================================================================

main() {
  print_header "🚀 Setting up development environment for conflu-exporter"

  # Change to project root
  cd "$PROJECT_ROOT"

  # Step 1: Check prerequisites
  check_prerequisites

  # Step 2: Install dependencies
  if [ "$SKIP_INSTALL" = false ]; then
    install_dependencies
  else
    print_warning "Skipping dependency installation"
  fi

  # Step 3: Setup git hooks
  if [ "$SKIP_HOOKS" = false ]; then
    setup_git_hooks
  else
    print_warning "Skipping git hooks setup"
  fi

  # Step 4: Setup environment variables
  setup_environment

  # Step 5: Build the project
  build_project

  # Step 6: Run tests
  run_tests

  # Success message
  print_completion
}

# ==============================================================================
# Step 1: Check Prerequisites
# ==============================================================================

check_prerequisites() {
  print_header "📋 Step 1: Checking Prerequisites"

  local all_ok=true

  # Required tools
  print_step "Checking required tools..."

  if ! check_command "git"; then
    print_error "Git is required. Install from: https://git-scm.com/"
    all_ok=false
  fi

  if ! check_command "node"; then
    print_error "Node.js is required. Install from: https://nodejs.org/"
    all_ok=false
  else
    local node_version=$(node --version | sed 's/v//')
    local required_version="20.0.0"
    if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
      print_error "Node.js >= $required_version is required. Found: $node_version"
      all_ok=false
    else
      print_success "Node.js version $node_version meets requirements"
    fi
  fi

  if ! check_command "pnpm"; then
    print_error "pnpm is required. Install with: npm install -g pnpm"
    all_ok=false
  else
    local pnpm_version=$(pnpm --version)
    print_success "pnpm version $pnpm_version"
  fi

  if [ "$all_ok" = false ]; then
    print_error "Some prerequisites are missing. Please install them and try again."
    exit 1
  fi

  echo ""
}

# ==============================================================================
# Step 2: Install Dependencies
# ==============================================================================

install_dependencies() {
  print_header "📦 Step 2: Installing Dependencies"

  print_step "Running pnpm install..."
  pnpm install --frozen-lockfile

  print_success "Dependencies installed successfully"
  echo ""
}

# ==============================================================================
# Step 3: Setup Git Hooks
# ==============================================================================

setup_git_hooks() {
  print_header "🪝 Step 3: Setting up Git Hooks"

  print_step "Installing husky..."
  pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional

  print_step "Initializing husky..."
  pnpm exec husky install

  print_step "Making hooks executable..."
  if [ -d ".husky" ]; then
    chmod +x .husky/*
  fi

  # Add husky install to package.json prepare script if not exists
  if ! grep -q '"prepare"' package.json; then
    print_step "Adding prepare script to package.json..."
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      pkg.scripts = pkg.scripts || {};
      pkg.scripts.prepare = 'husky install';
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
  fi

  print_success "Git hooks configured successfully"
  print_warning "Git hooks will run on:"
  echo "  - pre-commit: lint-staged + type-check"
  echo "  - commit-msg: validate commit message format"
  echo ""
}

# ==============================================================================
# Step 4: Setup Environment Variables
# ==============================================================================

setup_environment() {
  print_header "🔧 Step 4: Setting up Environment Variables"

  if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
      print_step "Creating .env.local from .env.example..."
      cp .env.example .env.local
      print_success ".env.local created"
      print_warning "Please update .env.local with your Confluence credentials"
    else
      print_step "Creating .env.local template..."
      cat > .env.local << 'EOF'
# Confluence API Configuration
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_EMAIL=your-email@example.com
CONFLUENCE_TOKEN=your-api-token

# Export Configuration
EXPORT_FORMAT=markdown
EXPORT_OUTPUT=./exports
EOF
      print_success ".env.local template created"
      print_warning "Please update .env.local with your Confluence credentials"
    fi
  else
    print_success ".env.local already exists"
  fi

  echo ""
}

# ==============================================================================
# Step 5: Build Project
# ==============================================================================

build_project() {
  print_header "🔨 Step 5: Building Project"

  print_step "Running TypeScript compiler..."
  pnpm build

  if [ -d "dist" ]; then
    local file_count=$(find dist -type f | wc -l | tr -d ' ')
    print_success "Build completed ($file_count files generated)"
  else
    print_error "Build failed - dist directory not found"
    exit 1
  fi

  echo ""
}

# ==============================================================================
# Step 6: Run Tests
# ==============================================================================

run_tests() {
  print_header "✅ Step 6: Running Tests"

  print_step "Running unit tests..."
  if pnpm test -- --run --reporter=verbose 2>&1 | tee /tmp/test-output.log; then
    print_success "All tests passed"
  else
    print_warning "Some tests failed. Check output above for details."
  fi

  echo ""
}

# ==============================================================================
# Completion Message
# ==============================================================================

print_completion() {
  print_header "🎉 Development Environment Setup Complete!"

  echo ""
  echo -e "${GREEN}✓${NC} Prerequisites verified"
  echo -e "${GREEN}✓${NC} Dependencies installed"
  echo -e "${GREEN}✓${NC} Git hooks configured"
  echo -e "${GREEN}✓${NC} Environment variables set up"
  echo -e "${GREEN}✓${NC} Project built successfully"
  echo -e "${GREEN}✓${NC} Tests executed"
  echo ""

  print_header "📝 Next Steps"
  echo ""
  echo "1. Update your credentials in .env.local:"
  echo -e "   ${CYAN}nano .env.local${NC}"
  echo ""
  echo "2. Test the CLI:"
  echo -e "   ${CYAN}node bin/conflu.js --version${NC}"
  echo ""
  echo "3. Start development:"
  echo -e "   ${CYAN}pnpm dev${NC}         # Watch mode"
  echo -e "   ${CYAN}pnpm test${NC}        # Run tests in watch mode"
  echo ""
  echo "4. Make your first commit using conventional commits:"
  echo -e "   ${CYAN}git add .${NC}"
  echo -e "   ${CYAN}git commit -m 'feat: add new feature'${NC}"
  echo ""
  echo "5. Before committing, git hooks will:"
  echo "   • Lint and format your code"
  echo "   • Run type checking"
  echo "   • Validate commit message format"
  echo ""

  print_header "📚 Useful Commands"
  echo ""
  echo -e "${CYAN}Development:${NC}"
  echo "  pnpm dev              - Start development mode (watch)"
  echo "  pnpm build            - Build the project"
  echo "  pnpm test             - Run tests in watch mode"
  echo "  pnpm test -- --run    - Run tests once"
  echo ""
  echo -e "${CYAN}Code Quality:${NC}"
  echo "  pnpm lint             - Lint code"
  echo "  pnpm lint:fix         - Fix lint issues"
  echo "  pnpm format           - Format code"
  echo "  pnpm format:check     - Check code formatting"
  echo "  pnpm type-check       - Type check"
  echo ""
  echo -e "${CYAN}Git:${NC}"
  echo "  git status            - Check git status"
  echo "  git log --oneline     - View commit history"
  echo ""

  print_header "🔗 Helpful Links"
  echo ""
  echo "  📖 Documentation:     docs/"
  echo "  🐛 Report Issues:     https://github.com/taipt1504/conflu-exporter/issues"
  echo "  💬 Discussions:       https://github.com/taipt1504/conflu-exporter/discussions"
  echo "  📝 Commit Format:     https://www.conventionalcommits.org/"
  echo ""
}

# ==============================================================================
# Error Handler
# ==============================================================================

error_handler() {
  print_error "Setup failed at line $1"
  echo ""
  echo "Please check the error message above and try again."
  echo "If you need help, please open an issue at:"
  echo "https://github.com/taipt1504/conflu-exporter/issues"
  exit 1
}

trap 'error_handler $LINENO' ERR

# ==============================================================================
# Run Main Function
# ==============================================================================

main "$@"
