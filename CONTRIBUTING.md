# Contributing to Confluence Exporter

Thank you for your interest in contributing to `conflu-exporter`! 🎉

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment.

## How Can I Contribute?

### 1. Reporting Bugs

Found a bug? Please create a [Bug Report](https://github.com/taipt1504/conflu-exporter/issues/new?template=bug_report.yml).

**Before submitting**:
- Search existing issues to avoid duplicates
- Check if the bug exists in the latest version
- Gather as much information as possible

**Include**:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node.js version, etc.)
- Error logs or screenshots

### 2. Suggesting Features

Have an idea? Create a [Feature Request](https://github.com/taipt1504/conflu-exporter/issues/new?template=feature_request.yml).

**Before submitting**:
- Check if the feature has already been requested
- Consider if it fits the project's scope
- Think about the implementation approach

**Include**:
- Problem statement
- Proposed solution
- Use cases and examples
- Alternative approaches considered

### 3. Contributing Code

#### Prerequisites

- Node.js 18+ installed
- pnpm 10.21.0+ installed
- Git knowledge
- TypeScript familiarity

#### Development Setup

```bash
# 1. Fork the repository on GitHub
# Click "Fork" button at https://github.com/taipt1504/conflu-exporter

# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/conflu-exporter.git
cd conflu-exporter

# 3. Add upstream remote
git remote add upstream https://github.com/taipt1504/conflu-exporter.git

# 4. Install dependencies
pnpm install

# 5. Create a feature branch
git checkout -b feature/my-new-feature
```

#### Development Workflow

```bash
# Run development build with watch mode
pnpm dev

# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Check formatting
pnpm format:check

# Type check
pnpm type-check

# Build
pnpm build
```

#### Making Changes

1. **Create a Branch**
   ```bash
   git checkout -b feature/amazing-feature
   # or
   git checkout -b fix/bug-description
   ```

2. **Write Code**
   - Follow the existing code style
   - Write clear, self-documenting code
   - Add JSDoc comments for public APIs
   - Keep functions small and focused

3. **Write Tests**
   - Add unit tests for new features
   - Ensure existing tests pass
   - Aim for >80% code coverage
   - Use descriptive test names

4. **Commit Changes**
   
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   
   ```bash
   git add .
   git commit -m "feat: add support for custom export formats"
   ```
   
   **Commit Types**:
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation changes
   - `style`: Code style changes (formatting)
   - `refactor`: Code refactoring
   - `test`: Adding or updating tests
   - `chore`: Maintenance tasks
   - `perf`: Performance improvements
   - `ci`: CI/CD changes

5. **Push to GitHub**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Create Pull Request**
   - Go to your fork on GitHub
   - Click "Compare & pull request"
   - Fill out the PR template
   - Link related issues

#### Pull Request Guidelines

**Before submitting**:
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated and passing
- [ ] No linting or type errors
- [ ] Build succeeds locally

**PR Title Format**:
```
feat: add batch export via CSV files
fix: resolve table parsing issue in markdown converter
docs: update API documentation for exportPage method
```

**PR Description Should Include**:
- Summary of changes
- Related issue(s)
- Type of change (bug fix, feature, etc.)
- How it was tested
- Screenshots (if applicable)

#### Code Review Process

1. **Automated Checks**: CI pipeline must pass
   - Tests
   - Linting
   - Type checking
   - Build

2. **Peer Review**: Maintainer will review your code
   - Code quality
   - Design decisions
   - Test coverage
   - Documentation

3. **Feedback**: Address review comments
   - Make requested changes
   - Push updates to the same branch
   - Respond to comments

4. **Approval & Merge**: Once approved, your PR will be merged!

### 4. Improving Documentation

Documentation improvements are always welcome!

**Areas to contribute**:
- Fix typos or unclear explanations
- Add examples and use cases
- Improve API documentation
- Translate documentation
- Create tutorials or guides

**Process**:
1. Fork and clone the repository
2. Edit markdown files in `docs/` or `README.md`
3. Preview changes locally
4. Submit PR with descriptive title

## Project Structure

```
conflu-exporter/
├── .github/              # GitHub configuration
│   ├── workflows/        # CI/CD workflows
│   └── ISSUE_TEMPLATE/   # Issue templates
├── docs/                 # Documentation
├── src/                  # Source code
│   ├── cli/              # CLI implementation
│   ├── core/             # Core functionality
│   ├── converters/       # Format converters
│   ├── storage/          # File operations
│   ├── errors/           # Error classes
│   └── config/           # Configuration management
├── tests/                # Test files
├── examples/             # Usage examples
└── dist/                 # Build output
```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Define interfaces for public APIs
- Use `unknown` instead of `any`
- Prefer `const` over `let`
- Use arrow functions for callbacks

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`

### Code Style

```typescript
// ✅ Good
export async function exportPage(pageId: string): Promise<ConfluencePage> {
  const page = await apiClient.getPage(pageId)
  return convertToMarkdown(page)
}

// ❌ Avoid
export async function export(id: any) {
  let p = await api.get(id)
  return convert(p)
}
```

### Testing

```typescript
// Use descriptive test names
describe('MarkdownConverter', () => {
  it('should convert Confluence tables to GFM format', () => {
    const html = '<table class="confluence-table">...</table>'
    const markdown = converter.convert(html)
    expect(markdown).toContain('| Header |')
  })
})
```

### Documentation

```typescript
/**
 * Export a Confluence page to markdown format
 * 
 * @param pageId - The Confluence page ID
 * @param options - Export options
 * @returns The exported page with metadata
 * @throws {NotFoundError} If page doesn't exist
 * 
 * @example
 * ```typescript
 * const page = await exporter.exportPage('123456')
 * console.log(page.title)
 * ```
 */
export async function exportPage(
  pageId: string,
  options?: ExportOptions
): Promise<ConfluencePage> {
  // Implementation
}
```

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/taipt1504/conflu-exporter/discussions)
- **Bugs**: Create an [Issue](https://github.com/taipt1504/conflu-exporter/issues)
- **Chat**: Comment on existing issues or PRs

## Recognition

Contributors will be:
- Listed in the project's contributors section
- Credited in release notes
- Thanked in the community

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to `conflu-exporter`! Every contribution, no matter how small, makes a difference. 🙏
