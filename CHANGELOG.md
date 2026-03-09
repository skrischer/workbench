# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Improved CLI help text for `fix-tests --max-attempts` option with clearer description
- Enhanced README.md with comprehensive CLI usage examples

### Deprecated
- `--max-iterations` parameter for `fix-tests` command (use `--max-attempts` instead)
  - The old parameter still works but shows a deprecation warning
  - Will be removed in a future major version

### Added
- CLI usage section in README.md with examples for all workflow commands
