import {
  Plugin,
  HeadingCache,
  FrontMatterCache,
  CachedMetadata,
  TFile,
  Notice,
} from "obsidian";

const path = require("path");

interface BetterMarkdownLinksSettings {}

export default class BetterMarkdownLinksPlugin extends Plugin {
  settings: BetterMarkdownLinksSettings;

  async onload() {
    this.registerEvent(
      this.app.vault.on("rename", async (file: TFile, oldPath) => {
        this.updateBackLinks(file, oldPath);
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", async (file: TFile) => {
        this.updateBackLinks(file, file.path);
      })
    );

    this.addCommand({
      id: "update-all-links",
      name: "Update All Links",
      callback: async () => {
        await this.updateAllLinks();
        new Notice("All links have been updated.");
      },
    });
  }

  async updateAllLinks() {
    const markdownFiles = this.app.vault.getMarkdownFiles();

    for (const file of markdownFiles) {
      const oldPath = file.path;
      await this.updateBackLinks(file, oldPath);
    }
  }

  async updateBackLinks(file: TFile, oldPath: string) {
    if (
      !oldPath ||
      !file.path.toLocaleLowerCase().endsWith(".md") ||
      !(file instanceof TFile)
    ) {
      return;
    }

    const cachedFile = this.app.metadataCache.getFileCache(file);
    if (!cachedFile) {
      return;
    }
    const title = this.getPageTitle(cachedFile, file.path);
    const notes = this.getCachedNotesThatHaveLinkToFile(oldPath);

    if (notes.length == 0) {
      return;
    }

    let updatedBacklinksCount = 0;

    for (let note of notes) {
      const fileContent = await this.app.vault.read(note);
      const newFileContent = fileContent.replace(
        /\[(.*?)\]\((.*?)\)/g,
        (_, linkText, linkUrl) => {
          linkUrl = decodeURIComponent(linkUrl);
          if (path.basename(linkUrl) === path.basename(oldPath)) {
            const normedLink = this.normalizePathForLink(
              file.path,
              // @ts-ignore
              this.app.vault.getConfig("newLinkFormat"),
              path.dirname(note.path)
            );
            return `[${title}](${normedLink})`;
          }
          return `[${linkText}](${linkUrl})`;
        }
      );

      if (fileContent !== newFileContent) {
        await this.app.vault.modify(note, newFileContent);
        updatedBacklinksCount++;
      }
    }

    if (updatedBacklinksCount > 0) {
      new Notice(`${updatedBacklinksCount} backlink(s) updated.`);
    }
  }

  getCachedNotesThatHaveLinkToFile(filePath: string): TFile[] {
    let notes: TFile[] = [];
    let allNotes = this.app.vault.getMarkdownFiles();

    if (allNotes) {
      for (let note of allNotes) {
        let notePath = note.path;

        if (note.path == filePath) {
          continue;
        }

        let embeds = this.app.metadataCache.getCache(notePath)?.embeds;
        if (embeds) {
          for (let link_data of embeds) {
            let linkPath = link_data.link;

            const isSamePath = this.comparePaths(
              linkPath,
              filePath,
              path.dirname(notePath),
              //@ts-ignore
              this.app.vault.getConfig("newLinkFormat")
            );
            if (isSamePath) {
              notes.push(note);
            }
          }
        }

        let links = this.app.metadataCache.getCache(notePath)?.links;
        if (links) {
          for (let link_data of links) {
            let linkPath = link_data.link;

            const isSamePath = this.comparePaths(
              linkPath,
              filePath,
              path.dirname(notePath),
              //@ts-ignore
              this.app.vault.getConfig("newLinkFormat")
            );
            if (isSamePath) {
              notes.push(note);
            }
          }
        }
      }
    }

    return notes;
  }

  comparePaths(
    linkPath: string,
    filePath: string,
    linkDir: string,
    linkFormat: string
  ) {
    const basePath = (this.app.vault.adapter as any).basePath;

    filePath = path.resolve(basePath, filePath);
    linkDir = path.resolve(basePath, linkDir);

    if (linkFormat == "relative") {
      linkPath = path.resolve(linkDir, linkPath);
    }

    linkPath = path.resolve(basePath, linkPath);

    return linkPath == filePath;
  }

  getPageTitle(cache: CachedMetadata, filePath: string): string {
    const frontMatterTitle =
      cache.frontmatter && (cache.frontmatter as FrontMatterCache).title;
    const firstHeading =
      cache.headings && (cache.headings[0] as HeadingCache).heading;
    return (
      frontMatterTitle ||
      firstHeading ||
      path.basename(filePath).replace(".md", "")
    );
  }

  normalizePathForLink(
    pathToNorm: string,
    linkFormat: string,
    noteDir: string
  ): string {
    if (linkFormat == "relative") {
      const basePath = (this.app.vault.adapter as any).basePath;
      noteDir = path.resolve(basePath, noteDir);
      pathToNorm = path.resolve(basePath, pathToNorm);
      pathToNorm = path.relative(noteDir, pathToNorm);
    }

    pathToNorm = pathToNorm.replace(/\\/gi, "/"); //replace \ to /
    pathToNorm = pathToNorm.replace(/ /gi, "%20"); //replace space to %20

    return pathToNorm;
  }
}
