# Changelog

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.3.2](https://github.com/taipt1504/conflu-exporter/compare/v1.3.1...v1.3.2) (2026-01-09)


### 🐛 Bug Fixes

* Implement TOC generation and enhance code macro handling ([d927958](https://github.com/taipt1504/conflu-exporter/commit/d927958eed98ac5fd51e0e4ce0173cd13eb623b9))

## [1.3.1](https://github.com/taipt1504/conflu-exporter/compare/v1.3.0...v1.3.1) (2026-01-08)


### 🐛 Bug Fixes

* Merge images from view content when storage has macros ([7a85243](https://github.com/taipt1504/conflu-exporter/commit/7a852435988f6f6fcc07052ebbbdab90f730a49e))

## [1.3.0](https://github.com/taipt1504/conflu-exporter/compare/v1.2.0...v1.3.0) (2026-01-08)


### ✨ Features

* Implement automatic image/attachment download during export ([cabe22c](https://github.com/taipt1504/conflu-exporter/commit/cabe22c7802d0b8b0f782b2f93aae0d2342563f4))


### 🐛 Bug Fixes

* Wrap image and attachment URLs in angle brackets for proper rendering ([bc6dfe4](https://github.com/taipt1504/conflu-exporter/commit/bc6dfe4aba8ac2b38d84723cea4ecded55befaac))

## [1.2.0](https://github.com/taipt1504/conflu-exporter/compare/v1.1.0...v1.2.0) (2026-01-08)


### ✨ Features

* support all Mermaid macro variants and fix HTML entity handling ([4d6d9cf](https://github.com/taipt1504/conflu-exporter/commit/4d6d9cf3480deb678bf059965888e235a8f16501))

## [1.1.0](https://github.com/taipt1504/conflu-exporter/compare/v1.0.1...v1.1.0) (2026-01-07)


### ✨ Features

* complete mermaid diagram source extraction to markdown ([99e6878](https://github.com/taipt1504/conflu-exporter/commit/99e687831735708e40d51d2b19b9d9c591491223))
* **macros:** enhance macro parsing with attachment support and validation ([fb362de](https://github.com/taipt1504/conflu-exporter/commit/fb362deb3f0501df457190209453e698d32ca887))
* support Mermaid for Confluence plugin text/plain attachments ([502478e](https://github.com/taipt1504/conflu-exporter/commit/502478e4fc829ce2f4a6ff2551c8f52f4128f529))


### 🐛 Bug Fixes

* confluence cloud attachment downloads and mermaid macro support ([61437e5](https://github.com/taipt1504/conflu-exporter/commit/61437e5eccdcd0116313c8d9bda3e57dd6d463eb))

## [1.0.1](https://github.com/taipt1504/conflu-exporter/compare/v1.0.0...v1.0.1) (2026-01-07)


### 🐛 Bug Fixes

* **ci:** capture semantic-release outputs for workflow summary ([2ffdb73](https://github.com/taipt1504/conflu-exporter/commit/2ffdb735e2bf59733cb086a2f87e9dafcbed94bd))

## [1.0.0](https://github.com/taipt1504/conflu-exporter/compare/v0.1.0...v1.0.0) (2026-01-07)


### ⚠ BREAKING CHANGES

* **ci:** Removed legacy build.yml workflow in favor of semantic-release workflow

### ✨ Features

* **ci:** add comprehensive workflow automation ([e9dcc55](https://github.com/taipt1504/conflu-exporter/commit/e9dcc553a5442c9cc083087729cc760427fc5902))


### 🐛 Bug Fixes

* **deps:** add semantic-release and automation dependencies ([5b02b07](https://github.com/taipt1504/conflu-exporter/commit/5b02b07b90162f1154b4f243be01b7ba144e3629))
* continue with test error ([3c63fd7](https://github.com/taipt1504/conflu-exporter/commit/3c63fd71ea88e356cc1577e315a6ecab8be8a937))


### 📚 Documentation

* add detailed troubleshooting guide for NPM_TOKEN scope issue ([66f1b28](https://github.com/taipt1504/conflu-exporter/commit/66f1b285f9bc96b53086d01e5737736b35776e9c))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup
- Core exporter functionality
- Type definitions for Confluence pages and export results
- Utility functions for date formatting, filename sanitization, and URL parsing
- Comprehensive test suite with Vitest
- ESLint and Prettier configuration
- TypeScript configuration with strict mode
- README with usage examples and API documentation

## [0.1.0] - 2024-01-07

### Added
- Initial release
- Basic project structure
- Placeholder implementation for Confluence API integration
