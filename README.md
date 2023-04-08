# Title As Link Text

**WARNING: this software has not been tested thoroughly. Do not use it without a backup of your vault.**

This [Obsidian](https://obsidian.md/) plugin adds some missing functionality for Markdown-style links (i.e. `[[Wikilinks]]` are turned off), allowing the `[Link Text]` component of a Markdown url to be set based on the page's title.

Useful for traditional Zettelkasten-style ID: **20230408102501.md** and to allow special characters in page title's.

## Example

**doc1.md**
```
---
title: Doc 1
---

See also [Doc 2 - Some Long Title](doc2.md)
```

**doc2.md**
```
----
title: Doc 2 - Some Long Title
---

See also [Doc 1](doc1.md)
```

## Installation

Installation via BRAT (for pre-releases or betas)

* Install [BRAT](https://github.com/TfTHacker/obsidian42-brat).
* Add "Title As Link Text" to BRAT:
    * Open "Obsidian42 - BRAT" via Settings → Community Plugins
    * Click "Add Beta plugin"
    * Use the repository address `lextoumbourou/obsidian-title-as-link-text`
    * Enable "Title As Link Text" under Settings → Options → Community Plugins

## How It Works

Runs when a file is renamed or saved. The vault is searched for back references and they're updated based on title of the file.

The title is inferred as follows:

1. Look for `title` in front matter:

```
---
title: Title
---
```

2. Use the first `# Heading` on the page.

```
# Title
```

3. Use the file name.

Disclaimer: I just learned how to make Obsidian plugins a few hours ago, so there's going to be some bugs.

## To Do

* [ ] Add command to process a Vault.
* [ ] Much more testing.
