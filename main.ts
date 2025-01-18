import {
  Plugin,
  HeadingCache,
  FrontMatterCache,
  CachedMetadata,
  TFile,
  Notice,
  debounce,
  TAbstractFile,
  App,
  PluginSettingTab,
  Setting,
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

    // First handle Markdown links
    let newFileContent = fileContent.replace(
      /\[(.*?)\]\((.*?)\)/g,
      (_, linkText, linkUrl) => {
        const linkUrlDecoded = decodeURIComponent(linkUrl);
        // Remove any #subheading from the link before looking up the file
        const baseLinkUrl = linkUrlDecoded.split('#')[0];
        const linkedFile = this.metadataCache.getFirstLinkpathDest(baseLinkUrl, file.path);
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

    // Then handle wikilinks
    newFileContent = newFileContent.replace(
      /\[\[(.*?)(?:#(.*?))?(?:\|(.*?))?\]\]/g,
      (match, linkPath, subheading, linkText) => {
        if (!linkText) return match; // Skip wikilinks without aliases

        const linkedFile = this.metadataCache.getFirstLinkpathDest(linkPath, file.path);
        if (linkedFile) {
          const linkedCache = this.metadataCache.getFileCache(linkedFile);
          if (linkedCache) {
            const aliases = this.getAliases(linkedCache);
            if (aliases.includes(linkText)) {
              return match;
            }

            const title = this.getPageTitle(linkedCache, linkedFile.path);
            if (linkText !== title) {
              updatedCount++;
              const subheadingPart = subheading ? `#${subheading}` : '';
              return `[[${linkPath}${subheadingPart}|${title}]]`;
            }
          }
        }
        return match;
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

interface TitleAsLinkTextSettings {
  debounceDelay: number;
}

const DEFAULT_SETTINGS: Partial<TitleAsLinkTextSettings> = {
  debounceDelay: 1000
};

export default class TitleAsLinkTextPlugin extends Plugin {
  settings: TitleAsLinkTextSettings;
  private linkUpdater: LinkUpdater;
  private debouncedUpdateBackLinks: (file: TFile, oldPath: string, notify: boolean) => void;

  async onload() {
    await this.loadSettings();

    this.linkUpdater = new LinkUpdater(this.app.vault, this.app.metadataCache);

    this.debouncedUpdateBackLinks = debounce(
      this.linkUpdater.updateBackLinks.bind(this.linkUpdater),
      this.settings.debounceDelay,
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

    this.addSettingTab(new TitleAsLinkTextSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Recreate debounced function with new delay
    this.debouncedUpdateBackLinks = debounce(
      this.linkUpdater.updateBackLinks.bind(this.linkUpdater),
      this.settings.debounceDelay,
      true
    );
  }
}

class TitleAsLinkTextSettingTab extends PluginSettingTab {
  plugin: TitleAsLinkTextPlugin;

  constructor(app: App, plugin: TitleAsLinkTextPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Debounce delay')
      .setDesc('How long to wait (in milliseconds) before updating links after a change')
      .addText(text => text
        .setPlaceholder('1000')
        .setValue(String(this.plugin.settings.debounceDelay))
        .onChange(async (value) => {
          const delay = Number(value);
          if (!isNaN(delay) && delay > 0) {
            this.plugin.settings.debounceDelay = delay;
            await this.plugin.saveSettings();
          }
        }));
  }
}