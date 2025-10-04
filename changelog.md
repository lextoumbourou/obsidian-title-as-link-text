# Changelog

All notable changes to the Title As Link Text plugin will be documented in this file.

## [1.1.8] - ⚙️ Settings toggle and bug fix

- Add auto-update toggle to disable automatic link updates on save/rename
- Add settings toggle to turn off front matter and/or first heading as title source. (#8)
- Skip updating links with subheadings/anchors (e.g., `[[Page#Heading]]`, `[[Page#^quote]]`)
- Handle links in headings. (#10)

## [1.1.7] - ✨ Features and Fixes

### Added

- Added new command: `Update links for current file`<br>
  Updates only the currently active note instead of the entire vault -- useful for large vaults or making isolated changes.<br>
  _(Note that this is the command that runs automatically when editing a note.)_
- In Markdown mode, ensure that exact title matching always wins over aliases.


## [1.1.6] - 🐛 Bug Fix

- Prevent updating of image alt text when using `![Alt text](some-img.jpg)`.
- Don't change link text if pointing to a header within the same document. (#3)

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

--------------------------------------------------------------------------------

📝 **Note**: Versions are listed from newest to oldest
