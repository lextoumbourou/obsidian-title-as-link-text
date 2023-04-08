# Obsidian Plugin: Title As Link Text

For people using Markdown links (**[[Wikilinks]]** to **Off**), the `[Link Text]` component of a Markdown url is set based on the title of the link's page.

```
[Some Title][a-different-filename.md]
```

This is useful for people that do not want to use page titles as file names. For example:

**some-idea.md**
```
---
title: Some Idea
---
```

Especially useful for people using traditional Zettelkasten-style ID.

**20230408102501.md**
```
# Some Idea
```

The title is inferred as follows:

1. Look for `title` in front matter.
2. Use the first `# Heading` on the page.
3. Use the file name.

Runs on file rename and when a file is saved.

Disclaimer: I just learned how to make Obsidian plugins a few hours ago, so there's going to be some bugs.

## To do:

* [ ] Add a command to run across an entire vault.
* [ ] Test behaviour with related plugins: https://github.com/dy-sh/obsidian-consistent-attachments-and-links etc
