# Title As Link Text

https://user-images.githubusercontent.com/1080552/230809814-ff8bc224-1455-420c-b363-a0d071ff801c.mp4

## Overview

Title As Link Text is an [Obsidian](https://obsidian.md/) plugin that automatically updates Markdown-style links with the page's title instead of the file name.

For this plugin to be useful, use Markdown links by setting `Use [[Wikilinks]]` to off.

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

## Developing

### Installation

```bash
nvm use 16
npm install
tsc
```
