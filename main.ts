import {
  Plugin,
  CachedMetadata,
  TFile,
  Notice,
  debounce,
  TAbstractFile,
  App,
  PluginSettingTab,
  Setting,
  Vault,
  MetadataCache
} from 'obsidian';

function basename(path: string): string {
  const base = new String(path).substring(path.lastIndexOf('/') + 1);
  return base;
}

export interface TitleAsLinkTextSettings {
  debounceDelay: number;
  similarityThreshold: number;
  useFrontmatterTitle: boolean;
  frontmatterTitleProperty: string;
  useFirstHeading: boolean;
  useAliases: boolean;
  autoUpdate: boolean;
}

const DEFAULT_SETTINGS: Partial<TitleAsLinkTextSettings> = {
  debounceDelay: 1000,
  similarityThreshold: 0.65,
  useFrontmatterTitle: true,
  frontmatterTitleProperty: 'title',
  useFirstHeading: true,
  useAliases: true,
  autoUpdate: true
};

export class LinkUpdater {
  private settings: TitleAsLinkTextSettings;

  constructor(
    private vault: Vault,
    private metadataCache: MetadataCache,
    settings: TitleAsLinkTextSettings
  ) {
    this.settings = settings;
  }

  async updateAllLinks() {
    const markdownFiles = this.vault.getMarkdownFiles();

    let updatedBacklinksCount = 0;
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

    // Markdown link regex breakdown:
    // \[                     - Match opening square bracket
    // ([^\]\n]+)            - Group 1: Match link text
    //                         [^\]\n] = any char except ] or newline
    //                         + = one or more (greedy)
    // \]                     - Match closing square bracket
    // \(                     - Match opening parenthesis
    // ([^)\n]+)             - Group 2: Match URL/path
    //                         [^)\n] = any char except ) or newline
    //                         + = one or more (greedy)
    // \)                     - Match closing parenthesis
    // g                      - Global flag: match all occurrences
    const markdownLinkRegex = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;

    let newFileContent = fileContent.replace(
      markdownLinkRegex,
      (match, linkText, linkUrl) => {
        // Skip if this is a checkbox pattern.
        if (match.startsWith('[ ]') || match.startsWith('[x]')) {
          return match;
        }

        const linkUrlDecoded = decodeURIComponent(linkUrl);
        // Remove any #subheading from the link before looking up the file
        const baseLinkUrl = linkUrlDecoded.split('#')[0];

        // If it's not a link to a file, don't update it.
        if (baseLinkUrl == '') {
          return match;
        }

        const linkedFile = this.metadataCache.getFirstLinkpathDest(baseLinkUrl, file.path);
        if (linkedFile && linkedFile.name.endsWith('.md')) {
          const linkedCache = this.metadataCache.getFileCache(linkedFile);
          if (linkedCache) {
            const title = this.getPageTitle(linkedCache, linkedFile.path);

            // If the current link text matches the title exactly, don't try to find an alias
            if (linkText === title) {
              return match;
            }

            // If it matches on case-insensitive, use the title
            if (linkText.toLowerCase() === title.toLowerCase()) {
              updatedCount++;
              return `[${title}](${linkUrl})`;
            }

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

    // Wikilinks regex breakdown:
    // \[\[              - Match literal opening double brackets
    // ([^\]\[\n]+?)     - Group 1: Match one or more chars that aren't brackets or newline (non-greedy)
    //                     This captures the main link path
    // (?:               - Start non-capturing group for optional subheading
    //   #([^\]\[\n]+?)  - Group 2: Match # followed by one or more non-bracket/newline chars (non-greedy)
    // )?                - End optional subheading group
    // (?:               - Start non-capturing group for optional alias
    //   \|([^\]\[\n]+?) - Group 3: Match | followed by one or more non-bracket/newline chars (non-greedy)
    // )?                - End optional alias group
    // \]\]              - Match literal closing double brackets
    const wikilinkRegex = /\[\[([^\][\n]+?)(?:#([^\][\n]+?))?(?:\|([^\][\n]+?))?]]/g;

    newFileContent = newFileContent.replace(
      wikilinkRegex,
      (match, linkPath, subheading, linkText) => {
        // Skip links with subheadings/anchors (e.g., [[Page#Header]], [[Page#^quote]])
        if (subheading) {
          return match;
        }

        const linkedFile = this.metadataCache.getFirstLinkpathDest(linkPath, file.path);
        if (linkedFile) {
          const linkedCache = this.metadataCache.getFileCache(linkedFile);
          if (linkedCache) {
            const title = this.getPageTitle(linkedCache, linkedFile.path);

            if (linkText) {
              // If the current link text matches the title exactly, don't try to find an alias
              if (linkText === title) {
                return match;
              }
              // Handle links with existing display text
              const aliases = this.getAliases(linkedCache);
              const similarAlias = this.findMostSimilarAlias(linkText, aliases);
              if (similarAlias && similarAlias !== linkText) {
                updatedCount++;
                return `[[${linkPath}|${similarAlias}]]`;
              }
              if (!similarAlias && linkText !== title) {
                updatedCount++;
                return linkPath !== title ? `[[${linkPath}|${title}]]` : `[[${linkPath}]]`;
              }
            } else {
              // Handle links without display text
              const baseLinkName = linkPath.split('/').pop()?.replace('.md', '') || '';
              if (title && title !== baseLinkName) {
                updatedCount++;
                return linkPath !== title ? `[[${linkPath}|${title}]]` : `[[${linkPath}]]`;
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
      !file.path.toLocaleLowerCase().endsWith('.md') ||
      !(file instanceof TFile)
    ) {
      return;
    }

    const notes = this.getCachedNotesThatHaveLinkToFile(oldPath);
    let updatedBacklinksCount = 0;

    // Update backlinks in other notes
    for (const note of notes) {
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
    const notesWithBacklinks: TFile[] = [];
    const allNotes = this.vault.getMarkdownFiles();

    if (allNotes) {
      for (const note of allNotes) {
        const notePath = note.path;

        if (note.path == filePath) {
          continue;
        }

        const noteCache = this.metadataCache.getCache(notePath);
        const embedsAndLinks = [
          ...(noteCache?.embeds || []),
          ...(noteCache?.links || []),
        ];
        if (embedsAndLinks) {
          for (const link_data of embedsAndLinks) {
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
      this.settings.useFrontmatterTitle && cache.frontmatter && cache.frontmatter[this.settings.frontmatterTitleProperty];
    const firstHeading =
      this.settings.useFirstHeading && cache.headings && cache.headings.length > 0 && cache.headings[0].heading;
    const title = frontMatterTitle || firstHeading || basename(filePath).replace('.md', '');
    return this.stripLinkElements(title);
  }

  private getAliases(cache: CachedMetadata): string[] {
    if (!this.settings.useAliases || !cache.frontmatter || !cache.frontmatter.aliases) {
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
    // First, check for exact match (case-insensitive)
    for (const alias of aliases) {
      if (alias.toLowerCase() === text.toLowerCase()) {
        return alias;
      }
    }

    // Then check for substring matches
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
      if (similarity > highestSimilarity && similarity >= this.settings.similarityThreshold) {
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

  private stripLinkElements(text: string): string {
    // Strip markdown links: [text](url) -> text
    let result = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Strip wikilinks: [[link|text]] -> text, [[link]] -> link
    result = result.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, link, displayText) => {
      return displayText || link;
    });

    return result;
  }
}

export default class TitleAsLinkTextPlugin extends Plugin {
  settings: TitleAsLinkTextSettings;
  private linkUpdater: LinkUpdater;
  private debouncedUpdateBackLinks: (file: TFile, oldPath: string, notify: boolean) => void;

  async onload() {
    await this.loadSettings();

    this.linkUpdater = new LinkUpdater(
      this.app.vault,
      this.app.metadataCache,
      this.settings
    );

    this.debouncedUpdateBackLinks = debounce(
      this.linkUpdater.updateBackLinks.bind(this.linkUpdater),
      this.settings.debounceDelay,
      true
    );

    this.registerEvent(
      this.app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
        if (this.settings.autoUpdate && file instanceof TFile) {
          this.debouncedUpdateBackLinks(file, oldPath, true);
        }
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', async (file: TFile) => {
        if (this.settings.autoUpdate) {
          this.debouncedUpdateBackLinks(file, file.path, true);
        }
      })
    );

    this.addCommand({
      id: 'update-all-links',
      name: 'Update all links',
      callback: async () => {
        const count = await this.linkUpdater.updateAllLinks();
        new Notice(`Updated the link text of ${count} Markdown link(s).`);
      },
    });

    this.addCommand({
      id: 'update-current-file-links',
      name: 'Update links for current file',
      callback: async () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
          const backLinks = await this.linkUpdater.updateBackLinks(activeFile, activeFile.path, false);
          if (backLinks) {
            new Notice(`Updated the link text of ${backLinks} Markdown link(s) in the current file.`);
          }
        } else {
          new Notice('No active markdown file found.');
        }
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
      .setName('Auto-update')
      .setDesc('Automatically update links when notes are saved or renamed')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoUpdate)
        .onChange(async (value) => {
          this.plugin.settings.autoUpdate = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Title source')
      .setHeading();

    new Setting(containerEl)
      .setName('Title from frontmatter')
      .setDesc('Use the title field from frontmatter as the link text (if available)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useFrontmatterTitle)
        .onChange(async (value) => {
          this.plugin.settings.useFrontmatterTitle = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Frontmatter property')
      .setDesc('The frontmatter property to use for getting the title')
      .addText(text => text
        .setPlaceholder('title')
        .setValue(this.plugin.settings.frontmatterTitleProperty)
        .onChange(async (value) => {
          if (value.trim()) {
            this.plugin.settings.frontmatterTitleProperty = value.trim();
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Title from first heading')
      .setDesc('Use the first heading in the note as the link text')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useFirstHeading)
        .onChange(async (value) => {
          this.plugin.settings.useFirstHeading = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Use aliases')
      .setDesc('Match link text against frontmatter aliases. When disabled, only the title will be used.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useAliases)
        .onChange(async (value) => {
          this.plugin.settings.useAliases = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Advanced')
      .setHeading();

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

    new Setting(containerEl)
      .setName('Similarity threshold')
      .setDesc('Minimum similarity score (0.0 to 1.0) required for alias matching. Higher values require closer matches.')
      .addText(text => text
        .setPlaceholder('0.65')
        .setValue(String(this.plugin.settings.similarityThreshold))
        .onChange(async (value) => {
          const threshold = Number(value);
          if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
            this.plugin.settings.similarityThreshold = threshold;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Reset to defaults')
      .setDesc('Reset all settings to their default values')
      .addButton(button => button
        .setButtonText('Reset')
        .setWarning()
        .onClick(async () => {
          this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS) as TitleAsLinkTextSettings;
          await this.plugin.saveSettings();
          this.display();
        }));
  }
}
