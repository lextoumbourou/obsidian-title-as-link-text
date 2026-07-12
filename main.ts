import {
  Plugin,
  CachedMetadata,
  TFile,
  Notice,
  debounce,
  Debouncer,
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

const IGNORE_LINK_TEXT_MARKER = '%%talt:ignore%%';
const IGNORE_LINK_TEXT_DIRECTIVE = /^[ \t]*%%[ \t]*talt:ignore[ \t]*%%/;
const LINK_EXCLUSION_PROPERTY = 'title-as-link-text-ignore';

interface LinkExclusions {
  allTargetPaths: Set<string>;
  displayTextByTargetPath: Map<string, Set<string>>;
}

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

    // Updating each note's own links once covers every link in the vault;
    // no need for the per-file backlink scan, which made this O(N²).
    let updatedLinksCount = 0;
    for (const file of markdownFiles) {
      updatedLinksCount += await this.updateLinksInNote(file);
    }

    return updatedLinksCount;
  }

  async updateLinksInNote(file: TFile): Promise<number> {
    const fileCache = this.metadataCache.getFileCache(file);
    if (!fileCache) {
      return 0;
    }

    // Cheap pre-check on a plain read so unchanged notes are never written:
    // writing identical content still triggers the metadata 'changed' event
    // and would cause a rewrite loop.
    const fileContent = await this.vault.read(file);
    if (this.applyLinkUpdates(fileContent, file.path).content === fileContent) {
      return 0;
    }

    // Recompute inside vault.process so the written content derives from the
    // content at write time; read-then-modify would clobber edits made while
    // the update is in flight.
    let updatedCount = 0;
    await this.vault.process(file, (currentContent) => {
      const result = this.applyLinkUpdates(currentContent, file.path);
      updatedCount = result.count;
      return result.content;
    });

    return updatedCount;
  }

  private applyLinkUpdates(
    fileContent: string,
    sourcePath: string
  ): { content: string; count: number } {
    let updatedCount = 0;
    const linkExclusions = this.getLinkExclusions(sourcePath);

    // Markdown link regex breakdown:
    // \[                     - Match opening square bracket
    // ((?:\\[^\n]|[^\]\\[\n])*) - Group 1: Match optional link text,
    //                                including backslash-escaped delimiters
    // \]                     - Match closing square bracket
    // \(                     - Match opening parenthesis
    // ([^)\n]+)             - Group 2: Match URL/path
    //                         [^)\n] = any char except ) or newline
    //                         + = one or more (greedy)
    // \)                     - Match closing parenthesis
    // g                      - Global flag: match all occurrences
    const markdownLinkRegex = /\[((?:\\[^\n]|[^\]\\[\n])*)\]\(([^)\n]+)\)/g;

    const markdownProtectedRanges = this.getProtectedRanges(fileContent);

    let newFileContent = fileContent.replace(
      markdownLinkRegex,
      (match, linkText, linkUrl, offset) => {
        // Skip links inside protected code regions.
        if (this.isProtected(offset, markdownProtectedRanges)) {
          return match;
        }

        // Image alt text is not link display text.
        if (offset > 0 && fileContent[offset - 1] === '!') {
          return match;
        }

        if (this.hasIgnoreDirective(fileContent, offset + match.length)) {
          return match;
        }

        // Skip if this is a checkbox pattern.
        if (match.startsWith('[ ]') || match.startsWith('[x]')) {
          return match;
        }

        // A literal % in the URL (e.g. "100%-deals.md") makes decodeURIComponent
        // throw; treat the URL as already-decoded in that case.
        let linkUrlDecoded: string;
        try {
          linkUrlDecoded = decodeURIComponent(linkUrl);
        } catch {
          linkUrlDecoded = linkUrl;
        }
        const hasSubpath = linkUrlDecoded.includes('#');
        const baseLinkUrl = linkUrlDecoded.split('#')[0];
        // Preserve contextual display text for heading and block links, but
        // allow an empty label to be repaired with the page title.
        if (hasSubpath && linkText !== '') {
          return match;
        }

        // If it's not a link to a file, don't update it.
        if (baseLinkUrl == '') {
          return match;
        }

        const linkedFile = this.metadataCache.getFirstLinkpathDest(baseLinkUrl, sourcePath);
        if (linkedFile && linkedFile.name.endsWith('.md')) {
          const comparableLinkText = this.unescapeMarkdownLinkText(linkText);
          if (this.isLinkExcluded(linkExclusions, linkedFile.path, comparableLinkText)) {
            return match;
          }
          const linkedCache = this.metadataCache.getFileCache(linkedFile);
          if (linkedCache) {
            const title = this.getPageTitle(linkedCache, linkedFile.path);

            if (comparableLinkText === '') {
              updatedCount++;
              return `[${this.escapeMarkdownLinkText(title)}](${linkUrl})`;
            }

            // If the current link text matches the title exactly, don't try to find an alias
            if (comparableLinkText === title) {
              return match;
            }

            // If it matches on case-insensitive, use the title
            if (comparableLinkText.toLowerCase() === title.toLowerCase()) {
              updatedCount++;
              return `[${this.escapeMarkdownLinkText(title)}](${linkUrl})`;
            }

            const aliases = this.getAliases(linkedCache);
            // Find the most similar alias if one exists
            const similarAlias = this.findMostSimilarAlias(comparableLinkText, aliases);
            if (similarAlias && similarAlias !== comparableLinkText) {
              updatedCount++;
              return `[${this.escapeMarkdownLinkText(similarAlias)}](${linkUrl})`;
            }
            // Only use title if no similar alias exists. Preserve custom link
            // text when the note has no explicit title (the title would just
            // be the filename).
            if (!similarAlias && comparableLinkText !== title && this.hasExplicitTitle(linkedCache)) {
              updatedCount++;
              return `[${this.escapeMarkdownLinkText(title)}](${linkUrl})`;
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

    // Recompute on newFileContent: the markdown pass may have shifted offsets.
    const wikilinkProtectedRanges = this.getProtectedRanges(newFileContent);

    newFileContent = newFileContent.replace(
      wikilinkRegex,
      (match, linkPath, subheading, linkText, offset) => {
        // Skip links inside protected code regions.
        if (this.isProtected(offset, wikilinkProtectedRanges)) {
          return match;
        }

        if (this.hasIgnoreDirective(newFileContent, offset + match.length)) {
          return match;
        }

        // Skip links with subheadings/anchors (e.g., [[Page#Header]], [[Page#^quote]])
        if (subheading || linkPath.startsWith('#')) {
          return match;
        }

        const linkedFile = this.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
        if (linkedFile) {
          const comparableLinkText = linkText
            ? this.unescapeWikilinkDisplayText(linkText)
            : null;
          if (this.isLinkExcluded(linkExclusions, linkedFile.path, comparableLinkText)) {
            return match;
          }
          const linkedCache = this.metadataCache.getFileCache(linkedFile);
          if (linkedCache) {
            const title = this.getPageTitle(linkedCache, linkedFile.path);

            if (linkText) {
              const currentDisplayText = comparableLinkText || '';
              // If the current link text matches the title exactly, don't try to find an alias
              if (currentDisplayText === title) {
                return match;
              }
              // Handle links with existing display text
              const aliases = this.getAliases(linkedCache);
              const similarAlias = this.findMostSimilarAlias(currentDisplayText, aliases);
              if (similarAlias && similarAlias !== currentDisplayText) {
                updatedCount++;
                return `[[${linkPath}|${this.escapeWikilinkDisplayText(similarAlias)}]]`;
              }
              if (!similarAlias && currentDisplayText !== title && this.hasExplicitTitle(linkedCache)) {
                updatedCount++;
                return linkPath !== title
                  ? `[[${linkPath}|${this.escapeWikilinkDisplayText(title)}]]`
                  : `[[${linkPath}]]`;
              }
            } else {
              // Handle links without display text
              const baseLinkName = linkPath.split('/').pop()?.replace(/\.md$/, '') || '';
              if (title && title !== baseLinkName) {
                updatedCount++;
                return linkPath !== title
                  ? `[[${linkPath}|${this.escapeWikilinkDisplayText(title)}]]`
                  : `[[${linkPath}]]`;
              }
            }
          }
        }
        return match;
      }
    );

    return { content: newFileContent, count: updatedCount };
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
              break;
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
    // YAML can parse a title as a non-string (e.g. `title: 2024`), so coerce.
    const title = frontMatterTitle || firstHeading || basename(filePath).replace(/\.md$/, '');
    return this.stripLinkElements(String(title));
  }

  private hasExplicitTitle(cache: CachedMetadata): boolean {
    const frontMatterTitle =
      this.settings.useFrontmatterTitle && cache.frontmatter && cache.frontmatter[this.settings.frontmatterTitleProperty];
    const firstHeading =
      this.settings.useFirstHeading && cache.headings && cache.headings.length > 0 && cache.headings[0].heading;
    return !!(frontMatterTitle || firstHeading);
  }

  private getAliases(cache: CachedMetadata): string[] {
    if (!this.settings.useAliases || !cache.frontmatter || !cache.frontmatter.aliases) {
      return [];
    }

    // Aliases may contain non-string YAML values (numbers, nulls); drop nulls
    // and coerce the rest so similarity matching doesn't throw.
    const aliases = cache.frontmatter.aliases;
    if (Array.isArray(aliases)) {
      return aliases.filter((alias) => alias != null).map(String);
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

  // Returns [start, end) offsets of code regions where link-looking text
  // should not be rewritten.
  private getProtectedRanges(content: string): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];

    // Fenced code blocks (``` or ~~~). A fence closes only on a matching
    // character with at least the opening fence's length; an unclosed fence
    // protects through to the end of the file.
    let fence: { char: string; length: number; start: number } | null = null;
    let offset = 0;
    for (const rawLine of content.split('\n')) {
      const line = rawLine.replace(/\r$/, '');
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fenceMatch) {
        const char = fenceMatch[1][0];
        const length = fenceMatch[1].length;
        const rest = fenceMatch[2];
        if (!fence && (char !== '`' || !rest.includes('`'))) {
          fence = { char, length, start: offset };
        } else if (fence && char === fence.char && length >= fence.length && /^[ \t]*$/.test(rest)) {
          ranges.push([fence.start, offset + rawLine.length]);
          fence = null;
        }
      }
      offset += rawLine.length + 1;
    }
    if (fence) {
      ranges.push([fence.start, content.length]);
    }

    // Inline code spans close on a backtick run of exactly the opening run's
    // length. Their content may contain shorter or longer backtick runs.
    let cursor = 0;
    while (cursor < content.length) {
      const protectedRange = ranges.find(([start, end]) => cursor >= start && cursor < end);
      if (protectedRange) {
        cursor = protectedRange[1];
        continue;
      }

      if (content[cursor] !== '`') {
        cursor++;
        continue;
      }

      const openingStart = cursor;
      while (content[cursor] === '`') {
        cursor++;
      }
      const openingLength = cursor - openingStart;
      let searchCursor = cursor;
      let closingEnd: number | null = null;

      while (searchCursor < content.length) {
        const searchProtectedRange = ranges.find(
          ([start, end]) => searchCursor >= start && searchCursor < end
        );
        if (searchProtectedRange) {
          searchCursor = searchProtectedRange[1];
          continue;
        }

        if (content[searchCursor] !== '`') {
          searchCursor++;
          continue;
        }

        const closingStart = searchCursor;
        while (content[searchCursor] === '`') {
          searchCursor++;
        }
        if (searchCursor - closingStart === openingLength) {
          closingEnd = searchCursor;
          break;
        }
      }

      if (closingEnd !== null) {
        ranges.push([openingStart, closingEnd]);
        cursor = closingEnd;
      }
    }

    return ranges;
  }

  private isProtected(offset: number, ranges: Array<[number, number]>): boolean {
    return ranges.some(([start, end]) => offset >= start && offset < end);
  }

  private hasIgnoreDirective(content: string, linkEnd: number): boolean {
    return IGNORE_LINK_TEXT_DIRECTIVE.test(content.slice(linkEnd));
  }

  private getLinkExclusions(sourcePath: string): LinkExclusions {
    const sourceCache = this.metadataCache.getCache(sourcePath);
    const configuredExclusions = sourceCache?.frontmatter?.[LINK_EXCLUSION_PROPERTY];
    const exclusions = Array.isArray(configuredExclusions)
      ? configuredExclusions
      : configuredExclusions == null
        ? []
        : [configuredExclusions];
    const linkExclusions: LinkExclusions = {
      allTargetPaths: new Set<string>(),
      displayTextByTargetPath: new Map<string, Set<string>>()
    };

    for (const exclusion of exclusions) {
      if (typeof exclusion !== 'string') {
        continue;
      }

      const parsedExclusion = this.parseLinkExclusion(exclusion);
      if (!parsedExclusion.linkPath) {
        continue;
      }

      const target = this.metadataCache.getFirstLinkpathDest(
        parsedExclusion.linkPath,
        sourcePath
      );
      if (target) {
        if (parsedExclusion.displayText === null) {
          linkExclusions.allTargetPaths.add(target.path);
        } else {
          const displayTexts = linkExclusions.displayTextByTargetPath.get(target.path)
            || new Set<string>();
          displayTexts.add(parsedExclusion.displayText);
          linkExclusions.displayTextByTargetPath.set(target.path, displayTexts);
        }
      }
    }

    return linkExclusions;
  }

  private parseLinkExclusion(
    exclusion: string
  ): { linkPath: string; displayText: string | null } {
    const trimmed = exclusion.trim();
    const wikilink = trimmed.match(/^\[\[([^\]]+)]]$/);
    if (wikilink) {
      const separatorIndex = wikilink[1].indexOf('|');
      const destination = separatorIndex === -1
        ? wikilink[1]
        : wikilink[1].slice(0, separatorIndex);
      const displayText = separatorIndex === -1
        ? null
        : this.unescapeWikilinkDisplayText(wikilink[1].slice(separatorIndex + 1));
      return {
        linkPath: destination.split('#')[0].trim(),
        displayText
      };
    }

    const markdownLink = trimmed.match(
      /^\[((?:\\[^\n]|[^\]\\[\n])*)]\(([^)]+)\)$/
    );
    const destination = markdownLink ? markdownLink[2] : trimmed;
    let decodedDestination: string;
    try {
      decodedDestination = decodeURIComponent(destination);
    } catch {
      decodedDestination = destination;
    }
    return {
      linkPath: decodedDestination.split('#')[0].trim(),
      displayText: markdownLink
        ? this.unescapeMarkdownLinkText(markdownLink[1])
        : null
    };
  }

  private isLinkExcluded(
    exclusions: LinkExclusions,
    targetPath: string,
    displayText: string | null
  ): boolean {
    if (exclusions.allTargetPaths.has(targetPath)) {
      return true;
    }
    return displayText !== null
      && !!exclusions.displayTextByTargetPath.get(targetPath)?.has(displayText);
  }

  private escapeMarkdownLinkText(text: string): string {
    return text.replace(/([\\[\]])/g, '\\$1');
  }

  private unescapeMarkdownLinkText(text: string): string {
    return text.replace(/\\([\\[\]])/g, '$1');
  }

  private escapeWikilinkDisplayText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/\[/g, '&#91;')
      .replace(/\]/g, '&#93;')
      .replace(/\|/g, '&#124;');
  }

  private unescapeWikilinkDisplayText(text: string): string {
    return text
      .replace(/&#91;/g, '[')
      .replace(/&#93;/g, ']')
      .replace(/&#124;/g, '|')
      .replace(/&amp;/g, '&');
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
  // One debouncer per file path: a single shared debouncer would drop the
  // update for file A when file B changes inside the debounce window.
  private debouncedUpdaters = new Map<string, Debouncer<[TFile, string, boolean], void>>();

  async onload() {
    await this.loadSettings();

    this.linkUpdater = new LinkUpdater(
      this.app.vault,
      this.app.metadataCache,
      this.settings
    );

    this.registerEvent(
      this.app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
        if (this.settings.autoUpdate && file instanceof TFile) {
          this.queueUpdate(file, oldPath, true);
        }
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', async (file: TFile) => {
        if (this.settings.autoUpdate) {
          this.queueUpdate(file, file.path, true);
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
          const count = await this.linkUpdater.updateLinksInNote(activeFile);
          if (count) {
            new Notice(`Updated the link text of ${count} Markdown link(s) in the current file.`);
          }
        } else {
          new Notice('No active markdown file found.');
        }
      },
    });

    this.addCommand({
      id: 'toggle-link-text-updates',
      name: 'Toggle link text updates',
      editorCheckCallback: (checking, editor) => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const linkRange = this.findLinkRangeAtCursor(line, cursor.ch);
        if (!linkRange) {
          return false;
        }

        if (!checking) {
          const suffix = line.slice(linkRange.end);
          const existingDirective = suffix.match(IGNORE_LINK_TEXT_DIRECTIVE);
          if (existingDirective) {
            const directiveStart = linkRange.end + existingDirective[0].indexOf('%%');
            const directiveEnd = linkRange.end + existingDirective[0].length;
            editor.replaceRange(
              '',
              { line: cursor.line, ch: directiveStart },
              { line: cursor.line, ch: directiveEnd }
            );
          } else {
            editor.replaceRange(
              IGNORE_LINK_TEXT_MARKER,
              { line: cursor.line, ch: linkRange.end }
            );
          }
          editor.setCursor(cursor);
        }

        return true;
      }
    });

    this.addSettingTab(new TitleAsLinkTextSettingTab(this.app, this));
  }

  private findLinkRangeAtCursor(
    line: string,
    cursorCh: number
  ): { start: number; end: number } | null {
    const linkPatterns = [
      /\[\[[^\][\n]+?]]/g,
      /\[((?:\\[^\n]|[^\]\\[\n])+)\]\(([^)\n]+)\)/g
    ];

    for (const pattern of linkPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (cursorCh >= start && cursorCh <= end) {
          return { start, end };
        }
      }
    }

    return null;
  }

  onunload() {
    for (const debounced of this.debouncedUpdaters.values()) {
      debounced.cancel();
    }
    this.debouncedUpdaters.clear();
  }

  private queueUpdate(file: TFile, oldPath: string, notify: boolean) {
    let debounced = this.debouncedUpdaters.get(file.path);
    if (!debounced) {
      debounced = debounce(
        (f: TFile, op: string, n: boolean) => {
          void this.linkUpdater.updateBackLinks(f, op, n);
        },
        this.settings.debounceDelay,
        true
      );
      this.debouncedUpdaters.set(file.path, debounced);
    }
    debounced(file, oldPath, notify);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Drop cached debouncers so new ones pick up a changed debounce delay.
    // Pending timers still fire with the old delay; no updates are lost.
    this.debouncedUpdaters.clear();
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
          // Mutate in place: LinkUpdater holds a reference to this object, so
          // replacing it would disconnect settings from the updater.
          Object.assign(this.plugin.settings, DEFAULT_SETTINGS);
          await this.plugin.saveSettings();
          this.display();
        }));
  }
}
