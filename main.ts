import {
  Plugin,
  HeadingCache,
  FrontMatterCache,
  CachedMetadata,
  TFile,
  Notice,
  debounce,
  TAbstractFile
} from "obsidian";

function basename(path: string): string {
  let base = new String(path).substring(path.lastIndexOf("/") + 1);
  return base;
}

export interface VaultLike {
  getMarkdownFiles(): TFile[];
  read(file: TFile): Promise<string>;
  modify(file: TFile, content: string): Promise<void>;
  on(name: string, callback: (...args: any[]) => any): void;
}

export interface MetadataCacheLike {
  getFileCache(file: TFile): CachedMetadata | null;
  getCache(path: string): CachedMetadata | null;
  getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null;
  on(name: string, callback: (...args: any[]) => any): void;
}

export class LinkUpdater {
  constructor(
    private vault: VaultLike,
    private metadataCache: MetadataCacheLike
  ) { }

  async updateAllLinks() {
    const markdownFiles = this.vault.getMarkdownFiles();

    var updatedBacklinksCount = 0;
    for (const file of markdownFiles) {
      const oldPath = file.path;
      const backLinks = await this.updateBackLinks(file, oldPath, false);
      if (backLinks) {
        updatedBacklinksCount = backLinks + updatedBacklinksCount;
      }
    }

    return updatedBacklinksCount;
  }

  async updateLinksInNote(file: TFile): Promise<number> {
    const fileContent = await this.vault.read(file);
    const fileCache = this.metadataCache.getFileCache(file);
    if (!fileCache) {
      return 0;
    }

    let updatedCount = 0;
    const newFileContent = fileContent.replace(
      /\[(.*?)\]\((.*?)\)/g,
      (_, linkText, linkUrl) => {
        const linkUrlDecoded = decodeURIComponent(linkUrl);
        const linkedFile = this.metadataCache.getFirstLinkpathDest(linkUrlDecoded, file.path);
        if (linkedFile) {
          const linkedCache = this.metadataCache.getFileCache(linkedFile);
          if (linkedCache) {
            const aliases = this.getAliases(linkedCache);
            if (aliases.includes(linkText)) {
              return `[${linkText}](${linkUrl})`;
            }

            const title = this.getPageTitle(linkedCache, linkedFile.path);
            if (linkText !== title) {
              updatedCount++;
              return `[${title}](${linkUrl})`;
            }
          }
        }
        return `[${linkText}](${linkUrl})`;
      }
    );

    if (fileContent !== newFileContent) {
      await this.vault.modify(file, newFileContent);
    }
    return updatedCount;
  }

  async updateBackLinks(file: TFile, oldPath: string, notify: boolean) {
    if (
      !oldPath ||
      !file.path.toLocaleLowerCase().endsWith(".md") ||
      !(file instanceof TFile)
    ) {
      return;
    }

    const notes = this.getCachedNotesThatHaveLinkToFile(oldPath);
    let updatedBacklinksCount = 0;

    // Update backlinks in other notes
    for (let note of notes) {
      const count = await this.updateLinksInNote(note);
      updatedBacklinksCount += count;
    }

    // Also update links in the changed file itself
    const selfCount = await this.updateLinksInNote(file);
    updatedBacklinksCount += selfCount;

    if (notify && updatedBacklinksCount > 0) {
      new Notice(
        `Updated the link text of ${updatedBacklinksCount} Markdown link(s).`
      );
    }

    return updatedBacklinksCount;
  }

  private getCachedNotesThatHaveLinkToFile(filePath: string): TFile[] {
    let notesWithBacklinks: TFile[] = [];
    let allNotes = this.vault.getMarkdownFiles();

    if (allNotes) {
      for (let note of allNotes) {
        let notePath = note.path;

        if (note.path == filePath) {
          continue;
        }

        const noteCache = this.metadataCache.getCache(notePath);
        const embedsAndLinks = [
          ...(noteCache?.embeds || []),
          ...(noteCache?.links || []),
        ];
        if (embedsAndLinks) {
          for (let link_data of embedsAndLinks) {
            // getFirstLinkpathDest = Get the best match for a linkpath.
            // https://marcus.se.net/obsidian-plugin-docs/reference/typescript/classes/MetadataCache
            const firstLinkPath = this.metadataCache.getFirstLinkpathDest(
              link_data.link,
              note.path
            );
            if (firstLinkPath && firstLinkPath.path == filePath) {
              notesWithBacklinks.push(note);
            }
          }
        }
      }
    }

    return notesWithBacklinks;
  }

  private getPageTitle(cache: CachedMetadata, filePath: string): string {
    const frontMatterTitle =
      cache.frontmatter && (cache.frontmatter as FrontMatterCache).title;
    const firstHeading =
      cache.headings && (cache.headings[0] as HeadingCache).heading;
    return (
      frontMatterTitle || firstHeading || basename(filePath).replace(".md", "")
    );
  }

  private getAliases(cache: CachedMetadata): string[] {
    if (!cache.frontmatter || !cache.frontmatter.aliases) {
      return [];
    }

    const aliases = cache.frontmatter.aliases;
    if (Array.isArray(aliases)) {
      return aliases;
    } else if (typeof aliases === 'string') {
      return [aliases];
    }
    return [];
  }
}

export default class TitleAsLinkTextPlugin extends Plugin {
  private debouncedUpdateBackLinks: (
    file: TFile,
    oldPath: string,
    notify: boolean
  ) => void = () => { };

  private linkUpdater: LinkUpdater = new LinkUpdater(this.app.vault, this.app.metadataCache);

  async onload() {
    this.linkUpdater = new LinkUpdater(this.app.vault, this.app.metadataCache);

    this.debouncedUpdateBackLinks = debounce(
      this.linkUpdater.updateBackLinks.bind(this.linkUpdater),
      1000,
      true
    );

    this.registerEvent(
      this.app.vault.on("rename", async (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          this.debouncedUpdateBackLinks(file, oldPath, true);
        }
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", async (file: TFile) => {
        this.debouncedUpdateBackLinks(file, file.path, true);
      })
    );

    this.addCommand({
      id: "update-all-links",
      name: "Update All Links",
      callback: async () => {
        const count = await this.linkUpdater.updateAllLinks();
        new Notice(`Updated the link text of ${count} Markdown link(s).`);
      },
    });
  }
}