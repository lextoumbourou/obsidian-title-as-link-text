# Changelog

All notable changes to the Title As Link Text plugin will be documented in this file.

## [1.1.4] - 🚀 Release version

- Mainly just a code cleanup, and ensuring the all platforms are supported.

## [1.1.3] - 🐛 Bug Fix

### Fixed

- Resolved an issue where text would get erased when having an open Wikilinks-style link (`[[`) within Markdown lists

## [1.1.2] - ✨ Feature Update

### Added

#### Wikilinks Support

- Added support for Wikilinks with display names
- Syntax: `[[cool-page|Cool Page]]`

#### Aliases Support

- Implemented fuzzy matching for aliases
- Links will now use matching aliases when available

**Example:**

```markdown
# File: cool-page.md
---
title: Cool Page
aliases:
- Super Cool Page
---

# Link
[[cool-page|Super Cool Page]]
```

## [1.0.10] - 🔧 Performance Update

### Changed

- Added 1-second timeout for better performance

---

📝 **Note**: Versions are listed from newest to oldest
