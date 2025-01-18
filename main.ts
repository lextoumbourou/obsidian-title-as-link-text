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
            // Find the most similar alias if one exists
            const similarAlias = this.findMostSimilarAlias(linkText, aliases);
            if (similarAlias && similarAlias !== linkText) {
              updatedCount++;
              return `[${similarAlias}](${linkUrl})`;
            }
            // Only use title if no similar alias exists
            if (!similarAlias) {
              const title = this.getPageTitle(linkedCache, linkedFile.path);
              if (linkText !== title) {
                updatedCount++;
                return `[${title}](${linkUrl})`;
              }
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
        const linkedFile = this.metadataCache.getFirstLinkpathDest(linkPath, file.path);
        if (linkedFile) {
          const linkedCache = this.metadataCache.getFileCache(linkedFile);
          if (linkedCache) {
            const title = this.getPageTitle(linkedCache, linkedFile.path);

            if (linkText) {
              // Handle links with existing display text (existing behavior)
              const aliases = this.getAliases(linkedCache);
              const similarAlias = this.findMostSimilarAlias(linkText, aliases);
              if (similarAlias && similarAlias !== linkText) {
                updatedCount++;
                const subheadingPart = subheading ? `#${subheading}` : '';
                return `[[${linkPath}${subheadingPart}|${similarAlias}]]`;
              }
              if (!similarAlias && linkText !== title) {
                updatedCount++;
                const subheadingPart = subheading ? `#${subheading}` : '';
                return `[[${linkPath}${subheadingPart}|${title}]]`;
              }
            } else {
              // Handle links without display text
              const baseLinkName = linkPath.split('/').pop()?.replace('.md', '') || '';
              if (title.toLowerCase() !== baseLinkName.toLowerCase()) {
                updatedCount++;
                const subheadingPart = subheading ? `#${subheading}` : '';
                return `[[${linkPath}${subheadingPart}|${title}]]`;
              }
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
      cache.headings && cache.headings.length > 0 && (cache.headings[0] as HeadingCache).heading;
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

  private findMostSimilarAlias(text: string, aliases: string[]): string | null {
    // First check for exact substring matches
    for (const alias of aliases) {
      if (alias.toLowerCase().includes(text.toLowerCase()) ||
        text.toLowerCase().includes(alias.toLowerCase())) {
        return alias;
      }
    }

    // Fall back to Levenshtein distance for fuzzy matching
    let mostSimilarAlias = null;
    let highestSimilarity = 0;

    for (const alias of aliases) {
      const similarity = this.calculateSimilarity(text, alias);
      if (similarity > highestSimilarity && similarity >= 0.8) {
        highestSimilarity = similarity;
        mostSimilarAlias = alias;
      }
    }

    return mostSimilarAlias;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,   // insertion
            matrix[i - 1][j] + 1    // deletion
          );
        }
      }
    }

    const distance = matrix[str1.length][str2.length];
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
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