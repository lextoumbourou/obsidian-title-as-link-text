# Changelog

All notable changes to the Title As Link Text plugin will be documented in this file.

## [Unreleased] - 🐛 Bug Fixes

- **Performance**: The "Update all links" command now processes each note once instead of rescanning the whole vault per note, making it dramatically faster on large vaults.
- **Bug fix**: Links inside fenced code blocks (``` or `~~~`) and inline code spans are no longer rewritten.
- **Bug fix**: Fixed a crash when a link URL contains a literal `%` (e.g. `[deals](100%-deals.md)`), which previously aborted all link updates in the note.
- **Bug fix**: Fixed a crash when a frontmatter title or alias is a non-string YAML value (e.g. `title: 2024` or `aliases: [2024]`).
- **Bug fix**: Markdown links with custom display text are now preserved when the linked note has no frontmatter title or headings, matching the existing wikilink behavior. Previously the custom text was replaced with the filename.
- **Bug fix**: Fixed the "Reset to defaults" button so that reset (and subsequent) settings changes take effect immediately instead of requiring a plugin reload.
- **Bug fix**: Filenames containing `.md` mid-name (e.g. `intro.md-notes.md`) no longer have the wrong part stripped when deriving the title.

## [1.1.11] - 🐛 Bug Fixes

- **Bug fix**: Fixed an issue where an unclosed `[[` before a markdown link would cause the link text and preceding content to be corrupted.
- **Bug fix**: Fixed an issue where wikilinks with custom display text would have that text stripped when the linked note has no frontmatter title or headings.

## [1.1.10] - ⚙️ Settings & Bug Fix

- **Use aliases setting**: Added a toggle to enable/disable alias matching. When disabled, the plugin will only use the title for link text and ignore frontmatter aliases.
- **Bug fix**: Fixed an issue where link text exactly matching one of multiple aliases would be incorrectly updated to a different alias due to substring matching taking precedence over exact matches.

## [1.1.9] - ⚙️  Enhanced Settings

- **Configurable Frontmatter Property**: You can now specify which frontmatter property to use for getting the title (defaults to `title`). This allows you to use custom properties like `name`, `heading`, or any other field in your frontmatter.
- **Reset to Defaults Button**: Added a button in settings to quickly reset all configuration options to their default values.

## [1.1.8] - ⚙️  Settings toggle and bug fix

- Skip updating links with subheadings/anchors (e.g., `[[Page#Heading]]`, `[[Page#^quote]]`) (#6)
- Add auto-update toggle to disable automatic link updates on save/rename (#7)
- Add settings toggle to turn off front matter and/or first heading as title source. (#8)
- Handle links in headings. (#10)

## [1.1.7] - ✨ Features and Fixes

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
