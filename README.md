# Better Markdown Links

An Obsidian plugin for people using Markdown links (**[[Wikilinks]]** to **Off**) that allows for using either front mattter or a heading, instead of the file name when maintain linking.

Normally in Obsidian, Markdown links have the following format:

[Some Idea](Some Idea.md)

When the `Some Idea.md` file is renamed, the link is updated:

Some Idea.md -> Some Other Idea.md

`[Some Idea](Some Idea.md)` -> `[Some Other Idea](Some Other Idea.md)`

But, if you prefer to keep the filename separate from the page's title:

```
cat some-idea.md
---
title: Some Idea
---
```
It would be preferrable if the [link text] part of a url could be set using a page's front matter or using the first `# Heading` on the page.

This plugin intercepts the link updating functionality of Obsidian, and uses the page title for the link text page of a Markdown link, and the filename for the URL part.
