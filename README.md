# Title As Link Text

https://user-images.githubusercontent.com/1080552/230809814-ff8bc224-1455-420c-b363-a0d071ff801c.mp4

## Overview

Title As Link Text is an [Obsidian](https://obsidian.md/) plugin that automatically updates Markdown-style links with the page's title instead of the file name.

For this plugin to be useful, use Markdown links by setting off `Use [[Wikilinks]]`.

## Complementary Plugins

- [Wikilinks To Markdown](https://github.com/agathauy/wikilinks-to-mdlinks-obsidian) to convert existing Wikilinks to Markdown.
- [Front Matter Title](https://github.com/snezhig/obsidian-front-matter-title) to replace the title with filename throughout Obsidian.

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

When a file is updated, the plugin searches for back-references to the file. If the link text in the back reference does not match the note's title, the plugin updates the link text.

### On file rename

When we rename a file, the plugin searches for back-references to the update. Obsidian will update the URL as standard, and the plugin will update the link text to reflect the new title.

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
- Link result: `[Some Doc](./some-doc.md)`

2\. Use the first `# H1` on the page if it exists.

- File name: **path/to/another-doc.md**
- File contents:
  ```
  # Another Doc
  ```
- Link result: `[Another Doc](path/to/another-doc.md`

3\. Use the file name.

- File name: **no-title.md**
- File contents:
  ```
  No title in this file.
  ```
- Link result: `[no-title](no-title.md)`

## Comands

- `Update All Links` can be used to add the title as link text to all existing Markdown links in your vault.

## License

MIT
