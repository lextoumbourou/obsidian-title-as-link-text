# Title As Link Text

![Tests](https://github.com/lextoumbourou/obsidian-title-as-link-text/actions/workflows/test.yml/badge.svg)

<https://user-images.githubusercontent.com/1080552/230809814-ff8bc224-1455-420c-b363-a0d071ff801c.mp4>

## Overview

Title As Link Text is an [Obsidian](https://obsidian.md/) plugin that automatically updates both Markdown-style links and Wikilinks with the page's title instead of the file name.

The plugin works with both standard Markdown links and Wikilinks.

### Wikilinks style aliases:

`[file-name|Doc Title]`

### Markdown style:

`[Doc Title](./file-name.md)`

To use Markdown links by setting "Use [[Wikilinks]] to off", also see [Complementary Plugins for Markdown-style](#complementary-plugins-for-markdown-style).

## Use cases

- Use traditional Zettelkasten-style IDs for filenames **20230408102501.md**
- Allow special characters in the page's title that would otherwise not work in the filename (`?`, `,` etc.)

## Installation

Installation via BRAT (for pre-releases or betas)

- Install [BRAT](https://github.com/TfTHacker/obsidian42-brat).
- Add "Title As Link Text" to BRAT:

  - Open "Obsidian42 - BRAT" via Settings → Community Plugins
  - Click "Add Beta plugin."
  - Use the repository address `lextoumbourou/obsidian-title-as-link-text`
  - Enable "Title As Link Text" under Settings → Options → Community Plugins

## How It Works

### On file save

When a file is updated, the plugin:

1. Searches for back-references to the file and updates their link text if needed
2. Updates any links within the modified file to ensure they use the current titles of their target files

### On file rename

When we rename a file:

1. Obsidian updates all URLs to the file as standard
2. The plugin updates the link text in all references to reflect the new title
3. The plugin also updates any links within the renamed file itself

### Title inference

The plugin infers the title as follows:

1\. Look for `title` in the frontmatter, if it exists:

- File name: **some-doc.md**
- File contents

  ```
  ---
  title: Some Doc
  ---
  ```

- Markdown link result: `[Some Doc](./some-doc.md)`

- Wikilink result: `[[some-doc|Some Doc]]`

2\. Use the first `# H1` on the page if it exists.

- File name: **path/to/another-doc.md**
- File contents:

  ```
  # Another Doc
  ```

- Markdown link result: `[Another Doc](path/to/another-doc.md)`
- Wikilink result: `[[path/to/another-doc|Another Doc]]`

3\. Use the file name.

- File name: **no-title.md**
- File contents:

  ```
  No title in this file.
  ```

- Markdown link result: `[no-title](no-title.md)`
- Wikilink result: `[[no-title]]`

### Aliases Support

The plugin respects aliases defined in the frontmatter. If a link's text matches any of the target file's aliases, it won't be updated to the title.

Example:

```markdown
---
title: Page Title
aliases:
- Alternative Title
---
```

If you link to this file using any of its aliases, the link text will be preserved:
- `[Page Title](file.md)` stays as is
- `[[file|Alternative Title]]` stays as is

#### Alias Matching

The plugin uses smart matching to find the most appropriate alias:

1\. **Substring Matching**: If the link text is part of an alias (or vice versa), it will update to use that alias
   - If alias is "Hello 2", then `[Hello](file.md)` becomes `[Hello 2](file.md)`
   - If alias is "My Project Name", then `[Project](file.md)` becomes `[My Project Name](file.md)`

2\. **Fuzzy Matching**: For cases without exact substring matches, the plugin uses similarity matching to find close matches

This helps maintain consistent naming across your vault while respecting intentional variations in how you refer to notes.

### Subheading Support

The plugin maintains the correct title even when linking to specific sections of a document:
- Markdown: `[Main Title](file.md#section)`
- Wikilinks: `[[file#section|Main Title]]`

## Complementary Plugins for Markdown-style

For Markdown style I recommend these complementary plugins:

- [Wikilinks To Markdown](https://github.com/agathauy/wikilinks-to-mdlinks-obsidian) to convert existing Wikilinks to Markdown.
- [Front Matter Title](https://github.com/snezhig/obsidian-front-matter-title) to replace the title with filename throughout Obsidian.

## Commands

- `Update All Links` can be used to add the title as link text to all existing Markdown links in your vault.

## License

MIT

## Developing

### Installation

```bash
nvm use 16
npm install
npm run build
```
